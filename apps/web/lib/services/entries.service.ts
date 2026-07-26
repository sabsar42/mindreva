import "server-only";
import {
  EntriesRepository,
  EntryPhotosRepository,
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

// Signed URLs let the browser load a private Storage object directly without
// proxying bytes through our own server. An hour comfortably covers a single
// page view; a fresh one is generated on every request, never cached long-term.
const PHOTO_SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

export interface EntryPhotoWithUrl {
  id: string;
  url: string;
}

/** EntryListItem plus a signed URL for its cover photo (first by position),
 * for NoteCard's trailing thumbnail. Undefined when the entry has no photos. */
export interface EntryListItemWithThumbnail extends EntryListItem {
  thumbnailUrl?: string;
}

export async function listMyEntries(options?: {
  type?: EntryType;
  includeArchived?: boolean;
  dateFrom?: string;
  dateTo?: string;
}): Promise<EntryListItemWithThumbnail[]> {
  const userId = await requireUserId();
  const entries = await EntriesRepository.listForUser(userId, options ?? {});
  return attachThumbnails(entries, userId);
}

/** entry_date of every active entry, for the calendar's dot indicators. */
export async function listMyEntryDates(type?: EntryType): Promise<string[]> {
  const userId = await requireUserId();
  return EntriesRepository.listEntryDatesForUser(userId, type);
}

/** Signed cover-photo URL for each date that has one, keyed by "YYYY-MM-DD" —
 * for the calendar month grid's day-cell thumbnails. */
export async function listMyDayThumbnails(
  type?: EntryType,
): Promise<Record<string, string>> {
  const userId = await requireUserId();
  const byDate = await EntryPhotosRepository.getFirstPhotosByDate(userId, type);
  if (byDate.size === 0) return {};

  const rows = Array.from(byDate.entries()).map(([date, photo]) => ({
    date,
    ...photo,
  }));
  const signed = await signPhotoUrls(rows);
  const urlById = new Map(signed.map((s) => [s.id, s.url]));
  return Object.fromEntries(rows.map((r) => [r.date, urlById.get(r.id) ?? ""]));
}

/** Attaches each entry's cover-photo signed URL (first photo by position),
 * batched into a single Storage call rather than one per entry. */
async function attachThumbnails(
  entries: EntryListItem[],
  userId: string,
): Promise<EntryListItemWithThumbnail[]> {
  const ids = entries.map((e) => e.id);
  const firstPhotos = await EntryPhotosRepository.getFirstPhotosForEntries(
    ids,
    userId,
  );
  if (firstPhotos.size === 0) return entries;

  const rows = Array.from(firstPhotos.entries()).map(([entryId, photo]) => ({
    entryId,
    ...photo,
  }));
  const signed = await signPhotoUrls(rows);
  const urlById = new Map(signed.map((s) => [s.id, s.url]));
  const urlByEntryId = new Map(rows.map((r) => [r.entryId, urlById.get(r.id)]));

  return entries.map((e) => ({
    ...e,
    thumbnailUrl: urlByEntryId.get(e.id) || undefined,
  }));
}

export async function listMyArchivedEntries(
  type?: EntryType,
): Promise<EntryListItemWithThumbnail[]> {
  const userId = await requireUserId();
  const entries = await EntriesRepository.listArchivedForUser(userId, type);
  return attachThumbnails(entries, userId);
}

export async function listMyTrashedEntries(): Promise<
  EntryListItemWithThumbnail[]
> {
  const userId = await requireUserId();
  const entries = await EntriesRepository.listTrashedForUser(userId);
  return attachThumbnails(entries, userId);
}

export async function searchMyEntries(
  query: string,
  type?: EntryType,
): Promise<EntryListItemWithThumbnail[]> {
  const userId = await requireUserId();
  const trimmed = query.trim();
  if (!trimmed) return [];
  const entries = await EntriesRepository.searchForUser(userId, trimmed, type);
  return attachThumbnails(entries, userId);
}

export async function countMyEntries(): Promise<number> {
  const userId = await requireUserId();
  return EntriesRepository.countForUser(userId);
}

export async function getMyEntry(id: string): Promise<Entry | null> {
  const userId = await requireUserId();
  return EntriesRepository.getByIdForUser(id, userId);
}

/** Batch lookup for chat citation chips — maps entryId to its entry_date. */
export async function getMyEntryDatesByIds(
  ids: string[],
): Promise<Record<string, string | null>> {
  const userId = await requireUserId();
  const found = await EntriesRepository.listByIds(ids, userId);
  return Object.fromEntries(found.map((e) => [e.id, e.entryDate]));
}

/** Entry + its transcript (if any) + its latest summary (if any) + its ordered
 * photos, for the detail screen. */
export async function getMyEntryDetail(id: string): Promise<{
  entry: Entry;
  transcript: Transcript | null;
  summary: Summary | null;
  photos: EntryPhotoWithUrl[];
} | null> {
  const userId = await requireUserId();
  const entry = await EntriesRepository.getByIdForUser(id, userId);
  if (!entry) return null;

  const [transcript, summary, photoRows] = await Promise.all([
    TranscriptsRepository.getByEntry(id, userId),
    SummariesRepository.getByEntry(id, userId),
    EntryPhotosRepository.listByEntry(id, userId),
  ]);
  const photos = await signPhotoUrls(photoRows);
  return { entry, transcript, summary, photos };
}

/** Batch-signs storage paths so the detail screen can render <img src> directly
 * without a per-photo round trip. Order is preserved from the input rows. */
async function signPhotoUrls(
  rows: { id: string; storagePath: string }[],
): Promise<EntryPhotoWithUrl[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("photos")
    .createSignedUrls(
      rows.map((r) => r.storagePath),
      PHOTO_SIGNED_URL_EXPIRY_SECONDS,
    );
  if (error) throw new Error(`Failed to sign photo URLs: ${error.message}`);

  const urlByPath = new Map(data.map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    url: urlByPath.get(r.storagePath) ?? "",
  }));
}

/**
 * Adds a photo to an existing entry: uploads to the private "photos" bucket
 * (session-scoped client, same RLS defense-in-depth as createVoiceEntry),
 * then creates the entry_photos row. position is computed server-side by the
 * repository. Used both right after recording and from the entry edit screen.
 */
export async function addPhotoToEntry(
  entryId: string,
  input: { image: Buffer; mimeType: string },
): Promise<EntryPhotoWithUrl> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");

  const objectPath = `${user.id}/${entryId}/${crypto.randomUUID()}.${extensionFromMimeType(input.mimeType)}`;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from("photos")
    .upload(objectPath, input.image, { contentType: input.mimeType });
  if (uploadError) {
    throw new Error(`Photo upload failed: ${uploadError.message}`);
  }

  const photo = await EntryPhotosRepository.create({
    entryId,
    userId: user.id,
    storagePath: objectPath,
  });

  const { data, error: signError } = await supabase.storage
    .from("photos")
    .createSignedUrl(objectPath, PHOTO_SIGNED_URL_EXPIRY_SECONDS);
  if (signError)
    throw new Error(`Failed to sign photo URL: ${signError.message}`);

  return { id: photo.id, url: data.signedUrl };
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
