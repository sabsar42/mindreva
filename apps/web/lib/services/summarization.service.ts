import "server-only";
import {
  getLLMProvider,
  resolveSummaryPrompt,
  parseTaskBlock,
  parseTitleLine,
  parseEventBlock,
  type ParsedEvent,
} from "@mindreva/llm";
import {
  EntriesRepository,
  EntryEventsRepository,
  EntryTasksRepository,
  ProfilesRepository,
  SummariesRepository,
  TranscriptsRepository,
} from "@mindreva/database";
import { stripFormatting, titleFromWords } from "@mindreva/types";
import { addDays } from "../day-key";
import { nextDailyReset, refundDaily, tryUseDaily } from "./usage.service";
import { isLimitError } from "../limit-error";
import {
  SUMMARY_GRACE_MS,
  SUMMARY_PROVIDER_LIMIT_DELAY_MS,
  SUMMARY_RETRY_DELAY_MS,
  SUMMARY_RETRY_LEASE_MS,
} from "../usage-limits";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** "2026-11-11 (Wednesday)": lets the model turn "Thursday" or "tomorrow" into a real date. */
function describeDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  return `${dateKey} (${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

/** Events worth suggesting: not before the entry's own day, within two years. */
function usableEvents(events: ParsedEvent[], entryDate: string): ParsedEvent[] {
  const last = addDays(entryDate, 730);
  return events
    .filter((e) => e.date >= entryDate && e.date <= last)
    .slice(0, 5);
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

  const entryRow = await EntriesRepository.getByIdForUser(entryId, userId);
  const entryDate =
    entryRow?.entryDate ??
    (entryRow?.createdAt ?? new Date()).toISOString().slice(0, 10);

  const template = resolveSummaryPrompt(profile?.summaryStyle ?? "general");
  const messages = template.buildMessages(confirmedText);
  // The entry's date, so relative dates in the entry ("Thursday") resolve.
  const last = messages[messages.length - 1];
  if (last && last.role === "user") {
    messages[messages.length - 1] = {
      ...last,
      content: `${last.content}\n\nEntry date (for resolving relative dates): ${describeDate(entryDate)}.`,
    };
  }

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
  const { title: modelTitle, rest: afterTitle } = parseTitleLine(
    completion.text,
  );
  const { rest, events } = parseEventBlock(afterTitle);
  const { summaryText, tasks } = parseTaskBlock(rest);

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

  try {
    await EntryEventsRepository.replaceSuggestions(
      entryId,
      userId,
      usableEvents(events, entryDate).map((e) => ({
        title: e.title,
        startDate: e.date,
        startTime: e.time,
      })),
    );
  } catch (err) {
    console.error(`Event extraction failed for entry ${entryId}:`, err);
  }

  const entry = await EntriesRepository.getByIdForUser(entryId, userId);
  if (entry && !entry.title) {
    await EntriesRepository.update(entryId, userId, {
      // The model's short title; if it gave none, the first few words said.
      title: modelTitle ?? titleFromWords(confirmedText) ?? "Untitled entry",
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
