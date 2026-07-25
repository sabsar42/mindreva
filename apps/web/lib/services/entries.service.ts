import "server-only";
import {
  EntriesRepository,
  SummariesRepository,
  TranscriptsRepository,
  type Entry,
  type EntryListItem,
  type EntryType,
  type Summary,
  type Transcript,
} from "@mindreva/database";
import { getUser, createClient } from "@mindreva/auth/server";
import { transcribeEntry } from "./transcription.service";
import { summarizeEntry } from "./summarization.service";

/**
 * Business rules for entries (journals + notes). Route handlers call this;
 * it never touches Drizzle directly.
 */

async function requireUserId(): Promise<string> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

function extensionFromMimeType(mimeType: string): string {
  const subtype = mimeType.split(";")[0]?.split("/")[1];
  return subtype ?? "webm";
}

export async function listMyEntries(options?: {
  type?: EntryType;
  includeArchived?: boolean;
  dateFrom?: string;
  dateTo?: string;
}): Promise<EntryListItem[]> {
  const userId = await requireUserId();
  return EntriesRepository.listForUser(userId, options ?? {});
}

/** entry_date of every active entry, for the calendar's dot indicators. */
export async function listMyEntryDates(type?: EntryType): Promise<string[]> {
  const userId = await requireUserId();
  return EntriesRepository.listEntryDatesForUser(userId, type);
}

export async function listMyArchivedEntries(
  type?: EntryType,
): Promise<EntryListItem[]> {
  const userId = await requireUserId();
  return EntriesRepository.listArchivedForUser(userId, type);
}

export async function listMyTrashedEntries(): Promise<EntryListItem[]> {
  const userId = await requireUserId();
  return EntriesRepository.listTrashedForUser(userId);
}

export async function searchMyEntries(
  query: string,
  type?: EntryType,
): Promise<EntryListItem[]> {
  const userId = await requireUserId();
  const trimmed = query.trim();
  if (!trimmed) return [];
  return EntriesRepository.searchForUser(userId, trimmed, type);
}

export async function countMyEntries(): Promise<number> {
  const userId = await requireUserId();
  return EntriesRepository.countForUser(userId);
}

export async function getMyEntry(id: string): Promise<Entry | null> {
  const userId = await requireUserId();
  return EntriesRepository.getByIdForUser(id, userId);
}

/** Entry + its transcript (if any) + its latest summary (if any), for the detail screen. */
export async function getMyEntryDetail(id: string): Promise<{
  entry: Entry;
  transcript: Transcript | null;
  summary: Summary | null;
} | null> {
  const userId = await requireUserId();
  const entry = await EntriesRepository.getByIdForUser(id, userId);
  if (!entry) return null;

  const [transcript, summary] = await Promise.all([
    TranscriptsRepository.getByEntry(id, userId),
    SummariesRepository.getByEntry(id, userId),
  ]);
  return { entry, transcript, summary };
}

/** Trash an entry (soft delete). Never a hard delete. */
export async function trashMyEntry(id: string): Promise<Entry | null> {
  const userId = await requireUserId();
  return EntriesRepository.softDelete(id, userId);
}

export async function restoreMyEntry(id: string): Promise<Entry | null> {
  const userId = await requireUserId();
  return EntriesRepository.restore(id, userId);
}

export async function archiveMyEntry(id: string): Promise<Entry | null> {
  const userId = await requireUserId();
  return EntriesRepository.setArchived(id, userId, true);
}

export async function unarchiveMyEntry(id: string): Promise<Entry | null> {
  const userId = await requireUserId();
  return EntriesRepository.setArchived(id, userId, false);
}

/**
 * The record screen's write path: uploads the audio to Supabase Storage
 * (RLS-scoped to the caller via the session client), creates the
 * entry/recording/transcript rows transactionally, then runs transcription
 * synchronously. A transcription failure doesn't fail entry creation — the
 * transcript row already records status='failed' for the UI to show a retry.
 * Summarization is NOT triggered here — only once the transcript is
 * confirmed (saved or explicitly accepted), never on unreviewed raw ASR
 * output. See saveMyTranscriptEdit / summarizeMyEntry.
 */
export async function createVoiceEntry(input: {
  audio: Buffer;
  mimeType: string;
  durationMs: number;
  type?: EntryType;
}): Promise<{ entryId: string }> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");

  const objectPath = `${user.id}/${crypto.randomUUID()}.${extensionFromMimeType(input.mimeType)}`;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from("recordings")
    .upload(objectPath, input.audio, { contentType: input.mimeType });
  if (uploadError) {
    throw new Error(`Recording upload failed: ${uploadError.message}`);
  }

  const { entry } = await EntriesRepository.createVoiceEntry({
    userId: user.id,
    type: input.type ?? "journal",
    storagePath: objectPath,
    durationMs: input.durationMs,
    mimeType: input.mimeType,
  });

  try {
    await transcribeEntry(entry.id, user.id);
  } catch {
    // transcribeEntry already persisted status='failed'; the review screen
    // will surface it. Entry creation itself still succeeded.
  }

  return { entryId: entry.id };
}

/** The typed-note write path (source='text'). Confirmed immediately — the
 * user wrote and submitted the final text, so summarization runs right away. */
export async function createTextEntry(input: {
  text: string;
  type?: EntryType;
}): Promise<{ entryId: string }> {
  const userId = await requireUserId();
  const text = input.text.trim();
  if (!text) throw new Error("Entry text cannot be empty");

  const { entry } = await EntriesRepository.createTextEntry({
    userId,
    type: input.type ?? "note",
    text,
  });

  try {
    await summarizeEntry(entry.id, userId);
  } catch {
    // Summarization failure shouldn't fail entry creation; the detail screen
    // will simply show no summary yet, with "Regenerate" available.
  }

  return { entryId: entry.id };
}

export async function getMyEntryTranscript(
  entryId: string,
): Promise<Transcript | null> {
  const userId = await requireUserId();
  return TranscriptsRepository.getByEntry(entryId, userId);
}

/**
 * Save the user's correction and, since this is the "confirm" action for the
 * voice path, kick off summarization on the confirmed text. raw_text is
 * never touched. Returns the fresh summary alongside the transcript so
 * callers can update the UI without a stale re-render (a client component's
 * local state doesn't pick up a router.refresh() on its own).
 */
export async function saveMyTranscriptEdit(
  entryId: string,
  editedText: string,
): Promise<{ transcript: Transcript; summary: Summary | null } | null> {
  const userId = await requireUserId();
  const transcript = await TranscriptsRepository.getByEntry(entryId, userId);
  if (!transcript) return null;
  const updated = await TranscriptsRepository.setEditedText(
    transcript.id,
    userId,
    editedText,
  );
  if (!updated) return null;

  try {
    await summarizeEntry(entryId, userId);
  } catch {
    // Same reasoning as createTextEntry: don't fail the save.
  }
  const summary = await SummariesRepository.getByEntry(entryId, userId);
  return { transcript: updated, summary };
}

/**
 * Manual summarize/regenerate trigger. Also what the transcript review
 * screen's "Skip for now" calls — skipping still confirms the transcript
 * as-is (raw text), so it should still get summarized. Returns the fresh
 * summary for the same reason as saveMyTranscriptEdit above.
 */
export async function summarizeMyEntry(
  entryId: string,
): Promise<Summary | null> {
  const userId = await requireUserId();
  await summarizeEntry(entryId, userId);
  return SummariesRepository.getByEntry(entryId, userId);
}
