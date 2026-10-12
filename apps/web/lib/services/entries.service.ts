import "server-only";
import { after } from "next/server";
import {
  EntriesRepository,
  EntryPhotosRepository,
  EntryTasksRepository,
  SummariesRepository,
  TranscriptsRepository,
  type Entry,
  type EntryListItem,
  type EntryTask,
  type EntryType,
  type Summary,
  type Transcript,
} from "@mindreva/database";
import { stripFormatting } from "@mindreva/types";
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

/**
 * Deliberately does NOT attach cover-photo thumbnails — that used to mean
 * every list-screen load paid two sequential extra round trips (a Storage
 * lookup, then a Storage sign call), on top of the entries query itself,
 * none of them parallelizable since each genuinely needs the previous
 * step's result. Thumbnails now load lazily client-side after the list
 * itself has painted, via /api/entries/thumbnails — same pattern already
 * used for the calendar's day-cell thumbnails (listMyDayThumbnails).
 */
export async function listMyEntries(options?: {
  type?: EntryType;
  includeArchived?: boolean;
  dateFrom?: string;
  dateTo?: string;
}): Promise<EntryListItemWithThumbnail[]> {
  const userId = await requireUserId();
  const entries = await EntriesRepository.listForUser(userId, options ?? {});
  return withPlainSnippets(entries);
}

/** entry_date of every active entry, for the calendar's dot indicators.
 * Derived from an already-fetched entries list rather than a separate DB
 * round trip — `listMyEntries({ type })` already excludes archived entries
 * the same way this used to, so the date set is identical. Prefer this over
 * `listMyEntryDates` whenever the caller is already fetching entries
 * (journal/notes list pages); use `listMyEntryDates` only when dates are the
 * *only* thing needed (e.g. the chat screen's "which years have entries"). */
export function entryDatesFrom(
  entries: { entryDate: string | null }[],
): string[] {
  return Array.from(
    new Set(entries.map((e) => e.entryDate).filter((d): d is string => !!d)),
  );
}

/** entry_date of every active entry, for callers that don't already have a
 * full entries list to derive dates from (e.g. chat/page.tsx's "available
 * years" — it never fetches entries otherwise, so a dedicated query is
 * cheaper than fetching every entry just to read its date). */
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

/** Strips any RichTextEditor Markdown from each entry's snippet — a list
 * row is a plain-text display context, never raw `**`/`*` syntax. Cheap
 * (no I/O), unlike the photo-thumbnail lookup this used to also do inline. */
function withPlainSnippets(
  entries: EntryListItem[],
): EntryListItemWithThumbnail[] {
  return entries.map((e) => ({
    ...e,
    snippet: e.snippet ? stripFormatting(e.snippet) : e.snippet,
  }));
}

/** Cover-photo thumbnail URLs for a batch of entries, keyed by entry id.
 * Split out from the list functions above so it can be fetched lazily,
 * client-side, after the list itself has already rendered — see
 * /api/entries/thumbnails. Two genuinely sequential Storage calls (can't
 * sign a URL before knowing which photo it's for), batched across all
 * requested entries rather than one call per entry. */
export async function getMyEntryThumbnails(
  entryIds: string[],
): Promise<Record<string, string>> {
  const userId = await requireUserId();
  if (entryIds.length === 0) return {};
  const firstPhotos = await EntryPhotosRepository.getFirstPhotosForEntries(
    entryIds,
    userId,
  );
  if (firstPhotos.size === 0) return {};

  const rows = Array.from(firstPhotos.entries()).map(([entryId, photo]) => ({
    entryId,
    ...photo,
  }));
  const signed = await signPhotoUrls(rows);
  const urlById = new Map(signed.map((s) => [s.id, s.url]));
  const result: Record<string, string> = {};
  for (const r of rows) {
    const url = urlById.get(r.id);
    if (url) result[r.entryId] = url;
  }
  return result;
}

export async function listMyArchivedEntries(
  type?: EntryType,
): Promise<EntryListItemWithThumbnail[]> {
  const userId = await requireUserId();
  const entries = await EntriesRepository.listArchivedForUser(userId, type);
  return withPlainSnippets(entries);
}

export async function listMyTrashedEntries(): Promise<
  EntryListItemWithThumbnail[]
> {
  const userId = await requireUserId();
  const entries = await EntriesRepository.listTrashedForUser(userId);
  return withPlainSnippets(entries);
}

export async function searchMyEntries(
  query: string,
  type?: EntryType,
): Promise<EntryListItemWithThumbnail[]> {
  const userId = await requireUserId();
  const trimmed = query.trim();
  if (!trimmed) return [];
  const entries = await EntriesRepository.searchForUser(userId, trimmed, type);
  return withPlainSnippets(entries);
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
 * photos + its task checklist (if the summary extracted one), for the detail
 * screen. */
export async function getMyEntryDetail(id: string): Promise<{
  entry: Entry;
  transcript: Transcript | null;
  summary: Summary | null;
  photos: EntryPhotoWithUrl[];
  tasks: EntryTask[];
} | null> {
  const userId = await requireUserId();

  // None of these five queries depend on each other's results (only on id/
  // userId, already known) — run them together instead of in three
  // sequential round-trip stages, since each one is a real network hop to
  // Supabase. Photo signing chains onto its own query inside the same
  // Promise.all, so the Storage round trip overlaps the other four queries
  // instead of starting after all of them. Photo rows are scoped by userId,
  // so a missing or foreign entry signs nothing.
  const [entry, transcript, summary, photos, tasks] = await Promise.all([
    EntriesRepository.getByIdForUser(id, userId),
    TranscriptsRepository.getByEntry(id, userId),
    SummariesRepository.getByEntry(id, userId),
    EntryPhotosRepository.listByEntry(id, userId).then(signPhotoUrls),
    EntryTasksRepository.listByEntry(id, userId),
  ]);
  if (!entry) return null;

  return { entry, transcript, summary, photos, tasks };
}

/** Toggles a single task's done state. Scoped to entries the caller owns via
 * EntryTasksRepository.setDone's ownership check. */
export async function toggleMyTask(
  taskId: string,
  isDone: boolean,
): Promise<EntryTask | null> {
  const userId = await requireUserId();
  return EntryTasksRepository.setDone(taskId, userId, isDone);
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

  // Transcription is a real ASR API call and can take several seconds for a
  // longer recording — the upload response shouldn't block on it. The
  // recording screen returns the user home as soon as this resolves and
  // polls the entry's transcript status client-side, toasting once it's
  // done (see record-flow.tsx). transcribeEntry persists status='failed'
  // itself on error, so a background failure is still visible to the user.
  after(async () => {
    try {
      await transcribeEntry(entry.id, user.id);
    } catch (err) {
      console.error(`Background transcribe failed for entry ${entry.id}:`, err);
    }
  });

  return { entryId: entry.id };
}

/** The typed-note write path (source='text'). The entry is created and
 * returned immediately — summarization (an LLM call) runs in the background
 * after the response via after(), so "Save note" isn't blocked on it. The
 * detail screen shows no summary yet with "Generate" available if the user
 * lands on it before the background job finishes. */
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

  after(async () => {
    try {
      await summarizeEntry(entry.id, userId);
    } catch (err) {
      console.error(`Background summarize failed for entry ${entry.id}:`, err);
    }
  });

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
 * never touched. Returns the fresh summary and task checklist alongside the
 * transcript so callers can update the UI without a stale re-render (a
 * client component's local state doesn't pick up a router.refresh() on its
 * own).
 */
export async function saveMyTranscriptEdit(
  entryId: string,
  editedText: string,
): Promise<{
  transcript: Transcript;
  summary: Summary | null;
  tasks: EntryTask[];
} | null> {
  const userId = await requireUserId();
  const transcript = await TranscriptsRepository.getByEntry(entryId, userId);
  if (!transcript) return null;
  const updated = await TranscriptsRepository.setEditedText(
    transcript.id,
    userId,
    editedText,
  );
  if (!updated) return null;

  // Re-summarizing runs an LLM call that can take several seconds — saving
  // the user's edited text should never block on that. Respond with the
  // text write confirmed and the PREVIOUS summary/tasks immediately, and
  // run summarization after the response is sent via next/server's after().
  // The client polls briefly afterward to pick up the fresh result (same
  // pattern already used for transcript-processing status).
  after(async () => {
    try {
      await summarizeEntry(entryId, userId);
    } catch (err) {
      console.error(`Background summarize failed for entry ${entryId}:`, err);
    }
  });

  const [summary, tasks] = await Promise.all([
    SummariesRepository.getByEntry(entryId, userId),
    EntryTasksRepository.listByEntry(entryId, userId),
  ]);
  return { transcript: updated, summary, tasks };
}

/**
 * Manual summarize/regenerate trigger. Also what the transcript review
 * screen's "Skip for now" calls — skipping still confirms the transcript
 * as-is (raw text), so it should still get summarized. Returns the fresh
 * summary and task checklist for the same reason as saveMyTranscriptEdit
 * above.
 */
export async function summarizeMyEntry(entryId: string): Promise<{
  summary: Summary | null;
  tasks: EntryTask[];
}> {
  const userId = await requireUserId();
  await summarizeEntry(entryId, userId);
  const [summary, tasks] = await Promise.all([
    SummariesRepository.getByEntry(entryId, userId),
    EntryTasksRepository.listByEntry(entryId, userId),
  ]);
  return { summary, tasks };
}

/** Read-only current summary + tasks, without triggering summarization —
 * used by the entry detail page's short poll after a save, to pick up a
 * background re-summarize's result (see saveMyTranscriptEdit's after()). */
export async function getMySummaryAndTasks(entryId: string): Promise<{
  summary: Summary | null;
  tasks: EntryTask[];
}> {
  const userId = await requireUserId();
  const [summary, tasks] = await Promise.all([
    SummariesRepository.getByEntry(entryId, userId),
    EntryTasksRepository.listByEntry(entryId, userId),
  ]);
  return { summary, tasks };
}
