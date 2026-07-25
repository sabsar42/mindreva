import "server-only";
import { getLLMProvider, resolveSummaryPrompt } from "@mindreva/llm";
import {
  EntriesRepository,
  ProfilesRepository,
  SummariesRepository,
  TranscriptsRepository,
} from "@mindreva/database";

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
 * Given an entry, summarizes its confirmed text (edited transcript, or raw if
 * never edited — for typed entries these are the same value) using the
 * owner's chosen summary style, and stores the result. Always inserts a new
 * summaries row (never overwrites) so prompt_version history is preserved —
 * see SummariesRepository.getByEntry. Also auto-derives entries.title when
 * unset. Never called synchronously inside the save that creates the entry;
 * callers trigger this as a fast follow-up and should not let it fail the
 * primary save (see docs/roadmap.md Phase 5 Common mistakes).
 */
export async function summarizeEntry(
  entryId: string,
  userId: string,
): Promise<void> {
  const transcript = await TranscriptsRepository.getByEntry(entryId, userId);
  const confirmedText = (transcript?.editedText ?? transcript?.rawText)?.trim();
  if (!confirmedText) return;

  const profile = await ProfilesRepository.getById(userId);
  const template = resolveSummaryPrompt(profile?.summaryStyle ?? "general");
  const messages = template.buildMessages(confirmedText);

  const provider = getLLMProvider();
  const summaryText = await provider.complete(messages);

  await SummariesRepository.create({
    entryId,
    userId,
    summaryText,
    promptVersion: template.promptVersion,
    provider: provider.name,
  });

  const entry = await EntriesRepository.getByIdForUser(entryId, userId);
  if (entry && !entry.title) {
    await EntriesRepository.update(entryId, userId, {
      title: deriveTitle(confirmedText),
    });
  }
}
