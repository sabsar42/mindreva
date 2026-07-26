import "server-only";
import {
  getLLMProvider,
  resolveSummaryPrompt,
  parseTaskBlock,
} from "@mindreva/llm";
import {
  EmbeddingsRepository,
  EntriesRepository,
  EntryTasksRepository,
  ProfilesRepository,
  SummariesRepository,
  TranscriptsRepository,
} from "@mindreva/database";
import { stripFormatting } from "@mindreva/types";

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
 * unset, and replaces the entry's task checklist with whatever the model
 * extracted this run (see EntryTasksRepository.replaceForEntry — a regenerate
 * always reflects the current confirmed text, same as summary_text itself).
 * Never called synchronously inside the save that creates the entry; callers
 * trigger this as a fast follow-up and should not let it fail the primary
 * save (see docs/roadmap.md Phase 5 Common mistakes).
 *
 * editedText may contain RichTextEditor's bold/italic Markdown — stripped to
 * plain text before it reaches the model or the embedding, since neither
 * should see `**`/`*` syntax (see @mindreva/types#stripFormatting).
 */
export async function summarizeEntry(
  entryId: string,
  userId: string,
): Promise<void> {
  const transcript = await TranscriptsRepository.getByEntry(entryId, userId);
  const rawConfirmedText = (
    transcript?.editedText ?? transcript?.rawText
  )?.trim();
  if (!rawConfirmedText) return;
  const confirmedText = stripFormatting(rawConfirmedText);

  const profile = await ProfilesRepository.getById(userId);
  const template = resolveSummaryPrompt(profile?.summaryStyle ?? "general");
  const messages = template.buildMessages(confirmedText);

  const provider = getLLMProvider();
  const rawResponse = await provider.complete(messages);
  const { summaryText, tasks } = parseTaskBlock(rawResponse);

  await SummariesRepository.create({
    entryId,
    userId,
    summaryText,
    promptVersion: template.promptVersion,
    provider: provider.name,
  });

  try {
    await EntryTasksRepository.replaceForEntry(entryId, userId, tasks);
  } catch (err) {
    console.error(`Task extraction failed for entry ${entryId}:`, err);
  }

  let entry = await EntriesRepository.getByIdForUser(entryId, userId);
  if (entry && !entry.title) {
    entry = await EntriesRepository.update(entryId, userId, {
      title: deriveTitle(confirmedText),
    });
  }

  // Embed for Phase 6's past-self retrieval. Never blocks a successful
  // summary — a failed embed just means this entry won't surface in chat
  // until the next successful summarize/regenerate.
  try {
    const embedInput = entry?.title
      ? `${entry.title}\n\n${confirmedText}`
      : confirmedText;
    const embedding = await provider.embed(embedInput);
    await EmbeddingsRepository.upsertForEntry({
      entryId,
      userId,
      chunkText: confirmedText,
      embedding,
    });
  } catch (err) {
    console.error(`Embedding failed for entry ${entryId}:`, err);
  }
}
