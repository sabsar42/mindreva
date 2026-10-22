import "server-only";
import {
  getLLMProvider,
  resolveSummaryPrompt,
  parseTaskBlock,
} from "@mindreva/llm";
import {
  EntriesRepository,
  EntryTasksRepository,
  ProfilesRepository,
  SummariesRepository,
  TranscriptsRepository,
} from "@mindreva/database";
import { stripFormatting } from "@mindreva/types";
import { nextDailyReset, refundDaily, tryUseDaily } from "./usage.service";
import { isLimitError } from "../limit-error";
import {
  SUMMARY_GRACE_MS,
  SUMMARY_PROVIDER_LIMIT_DELAY_MS,
  SUMMARY_RETRY_DELAY_MS,
  SUMMARY_RETRY_LEASE_MS,
} from "../usage-limits";

const MAX_TITLE_LENGTH = 120;

/** First sentence if short enough, else the first non-empty line, hard-capped. */
function deriveTitle(text: string): string {
  const firstLine = text
    .split("\n")
    .find((l) => l.trim().length > 0)
    ?.trim();
  if (!firstLine) return "Untitled entry";

  const sentenceMatch = firstLine.match(/^.*?[.!?](?:\s|$)/);
  const candidate = (sentenceMatch?.[0] ?? firstLine).trim();

  if (candidate.length <= MAX_TITLE_LENGTH) return candidate;
  return candidate.slice(0, MAX_TITLE_LENGTH - 1).trimEnd() + "…";
}

/**
 * What happened to one summarize attempt. Summarizing never throws for an AI
 * problem: the entry is already saved, so a failure just marks the summary
 * as pending retry (entries.summary_retry_at) and the caller decides how to
 * tell the user.
 */
export type SummarizeOutcome =
  | { status: "done" }
  /** Nothing to summarize yet (or ever, e.g. a failed transcription). */
  | { status: "skipped" }
  | {
      status: "pending";
      /** daily-limit: this user's own cap. provider-limit: the shared AI
       * quota. error: any other AI failure. */
      reason: "daily-limit" | "provider-limit" | "error";
      retryAt: Date;
    };

async function markPending(
  entryId: string,
  userId: string,
  reason: "daily-limit" | "provider-limit" | "error",
  retryAt: Date,
): Promise<SummarizeOutcome> {
  try {
    await EntriesRepository.setSummaryRetry(entryId, userId, retryAt);
  } catch (err) {
    console.error(`Couldn't mark entry ${entryId} for summary retry:`, err);
  }
  return { status: "pending", reason, retryAt };
}

/**
 * Given an entry, summarizes its confirmed text (edited transcript, or raw if
 * never edited — for typed entries these are the same value) using the
 * owner's chosen summary style, and stores the result. Always inserts a new
 * summaries row (never overwrites) so prompt_version history is preserved —
 * see SummariesRepository.getByEntry. Also auto-derives entries.title when
 * unset, and replaces the entry's task checklist with whatever the model
 * extracted this run (see EntryTasksRepository.replaceForEntry — a regenerate
 * always reflects the current confirmed text, same as summary_text itself).
 * Never called synchronously inside the save that creates the entry; callers
 * trigger this as a fast follow-up and should not let it fail the primary
 * save (see docs/roadmap.md Phase 5 Common mistakes).
 *
 * Each attempt counts against the user's daily summary limit; an attempt
 * that produces nothing is refunded. Over the limit, or when every AI
 * provider fails, the entry is marked for retry instead (see SummarizeOutcome).
 *
 * editedText may contain RichTextEditor's bold/italic Markdown — stripped to
 * plain text before it reaches the model or the embedding, since neither
 * should see `**`/`*` syntax (see @mindreva/types#stripFormatting).
 */
export async function summarizeEntry(
  entryId: string,
  userId: string,
): Promise<SummarizeOutcome> {
  const transcript = await TranscriptsRepository.getByEntry(entryId, userId);
  const rawConfirmedText = (
    transcript?.editedText ?? transcript?.rawText
  )?.trim();
  if (!rawConfirmedText) {
    // Still transcribing: check back later. Otherwise there is nothing to
    // summarize, so stop retrying.
    const transcribing =
      transcript?.status === "pending" || transcript?.status === "processing";
    await EntriesRepository.setSummaryRetry(
      entryId,
      userId,
      transcribing ? new Date(Date.now() + SUMMARY_GRACE_MS) : null,
    );
    return { status: "skipped" };
  }
  const confirmedText = stripFormatting(rawConfirmedText);

  const profile = await ProfilesRepository.getById(userId);
  if (!(await tryUseDaily(userId, profile?.timezone, "summaries"))) {
    return markPending(
      entryId,
      userId,
      "daily-limit",
      nextDailyReset(profile?.timezone),
    );
  }

  const template = resolveSummaryPrompt(profile?.summaryStyle ?? "general");
  const messages = template.buildMessages(confirmedText);

  const provider = getLLMProvider();
  let completion;
  try {
    completion = await provider.complete(messages);
  } catch (err) {
    console.error(`Summary generation failed for entry ${entryId}:`, err);
    await refundDaily(userId, "summaries");
    const limited = isLimitError(err);
    return markPending(
      entryId,
      userId,
      limited ? "provider-limit" : "error",
      new Date(
        Date.now() +
          (limited ? SUMMARY_PROVIDER_LIMIT_DELAY_MS : SUMMARY_RETRY_DELAY_MS),
      ),
    );
  }
  const { summaryText, tasks } = parseTaskBlock(completion.text);

  await SummariesRepository.create({
    entryId,
    userId,
    summaryText,
    promptVersion: template.promptVersion,
    provider: completion.provider,
    model: completion.model,
  }); // also clears the entry's pending-retry mark, atomically

  try {
    await EntryTasksRepository.replaceForEntry(entryId, userId, tasks);
  } catch (err) {
    console.error(`Task extraction failed for entry ${entryId}:`, err);
  }

  const entry = await EntriesRepository.getByIdForUser(entryId, userId);
  if (entry && !entry.title) {
    await EntriesRepository.update(entryId, userId, {
      title: deriveTitle(confirmedText),
    });
  }

  // Embedding (and the mindmap refresh that follows it) is no longer done
  // here: it runs off the entry's own embedding job, which every text save
  // arms (see embedding-index.service.ts). A summary failing or hitting its
  // daily limit therefore never leaves an entry unsearchable.

  return { status: "done" };
}

/**
 * Background catch-up: claims this user's oldest entry whose summary retry is
 * due and tries it once. One per call keeps each page load's after() short;
 * the claim (a lease pushed SUMMARY_RETRY_LEASE_MS out) stops two concurrent
 * loads from summarizing the same entry. Null when nothing was due.
 */
export async function retryDueSummary(
  userId: string,
): Promise<SummarizeOutcome | null> {
  const entryId = await EntriesRepository.claimDueSummaryRetry(
    userId,
    new Date(Date.now() + SUMMARY_RETRY_LEASE_MS),
  );
  if (!entryId) return null;
  return summarizeEntry(entryId, userId);
}
