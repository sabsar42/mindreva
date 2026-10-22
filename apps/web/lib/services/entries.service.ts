import "server-only";
import { after } from "next/server";
import {
  EntriesRepository,
  EntryPhotosRepository,
  EntrySharesRepository,
  EntryTasksRepository,
  SummariesRepository,
  TranscriptsRepository,
  type Entry,
  type EntryListItem,
  type EntryPhotoKind,
  type EntryTask,
  type EntryType,
  type Summary,
  type Transcript,
} from "@mindreva/database";
import { stripFormatting } from "@mindreva/types";
import { getUser, createClient } from "@mindreva/auth/server";
import { transcribeEntry } from "./transcription.service";
import {
  retryDueSummary,
  summarizeEntry,
  type SummarizeOutcome,
} from "./summarization.service";
import { SUMMARY_GRACE_MS } from "../usage-limits";
import { getMyToday } from "./profile.service";
import { timed } from "../timing";

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
  /** 'cover' photos are the entry's cover set; 'inline' ones live in the body. */
  kind: EntryPhotoKind;
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
  const userId = await timed("entry-list", "auth", requireUserId());
  const entries = await timed(
    "entry-list",
    "query",
    EntriesRepository.listForUser(userId, options ?? {}),
  );
  return withPlainSnippets(entries);
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
  const firstPhotos = await timed(
    "entry-thumbnails",
    "first-photos",
    EntryPhotosRepository.getFirstPhotosForEntries(entryIds, userId),
  );
  if (firstPhotos.size === 0) return {};

  const rows = Array.from(firstPhotos.entries()).map(([entryId, photo]) => ({
    entryId,
    ...photo,
  }));

  // Prefer the small list thumbnail; photos uploaded before thumbnails
  // existed have none and fall back to the full photo. Both are signed in
  // parallel so the fallback costs no extra round trip.
  const supabase = await createClient();
  const [{ data: thumbs }, full] = await timed(
    "entry-thumbnails",
    "sign",
    Promise.all([
      supabase.storage.from("photos").createSignedUrls(
        rows.map((r) => thumbnailPathFor(r.storagePath)),
        PHOTO_SIGNED_URL_EXPIRY_SECONDS,
      ),
      signPhotoUrls(rows),
    ]),
  );
  const thumbByPath = new Map(
    (thumbs ?? [])
      .filter((t) => !t.error && t.signedUrl)
      .map((t) => [t.path, t.signedUrl]),
  );
  const fullById = new Map(full.map((s) => [s.id, s.url]));
  const result: Record<string, string> = {};
  for (const r of rows) {
    const url =
      thumbByPath.get(thumbnailPathFor(r.storagePath)) ?? fullById.get(r.id);
    if (url) result[r.entryId] = url;
  }
  return result;
}

/** Where a photo's list thumbnail lives: next to it, same owner folder, so
 * the existing per-user Storage policies cover it unchanged. */
function thumbnailPathFor(storagePath: string): string {
  return `${storagePath}.thumb`;
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
  /** Whether a share link is currently active for this entry. */
  shared: boolean;
} | null> {
  const userId = await timed("entry-detail", "auth", requireUserId());

  // None of these five queries depend on each other's results (only on id/
  // userId, already known) — run them together instead of in three
  // sequential round-trip stages, since each one is a real network hop to
  // Supabase. Photo signing chains onto its own query inside the same
  // Promise.all, so the Storage round trip overlaps the other four queries
  // instead of starting after all of them. Photo rows are scoped by userId,
  // so a missing or foreign entry signs nothing.
  const [entry, transcript, summary, photos, tasks, share] = await timed(
    "entry-detail",
    "all-queries",
    Promise.all([
      timed(
        "entry-detail",
        "entry",
        EntriesRepository.getByIdForUser(id, userId),
      ),
      timed(
        "entry-detail",
        "transcript",
        TranscriptsRepository.getByEntry(id, userId),
      ),
      timed(
        "entry-detail",
        "summary",
        SummariesRepository.getByEntry(id, userId),
      ),
      timed(
        "entry-detail",
        "photos",
        EntryPhotosRepository.listByEntry(id, userId),
      ).then((rows) =>
        timed("entry-detail", "photos-sign", signPhotoUrls(rows)),
      ),
      timed(
        "entry-detail",
        "tasks",
        EntryTasksRepository.listByEntry(id, userId),
      ),
      timed(
        "entry-detail",
        "share",
        EntrySharesRepository.getByEntry(id, userId),
      ),
    ]),
  );
  if (!entry) return null;

  return {
    entry,
    transcript,
    summary,
    photos,
    tasks,
    shared: Boolean(share && !share.share.revokedAt),
  };
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
  rows: { id: string; storagePath: string; kind?: EntryPhotoKind }[],
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
    kind: r.kind ?? "cover",
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
  input: {
    image: Buffer;
    mimeType: string;
    /** 'inline' for a picture inserted into the body; default 'cover'. */
    kind?: EntryPhotoKind;
    /** For kind 'cover': make this the entry's cover (Change cover image). */
    makeCover?: boolean;
    /** Small copy for list thumbnails, stored at thumbnailPathFor(path). */
    thumbnail?: { image: Buffer; mimeType: string };
  },
): Promise<EntryPhotoWithUrl> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");

  const objectPath = `${user.id}/${entryId}/${crypto.randomUUID()}.${extensionFromMimeType(input.mimeType)}`;

  const supabase = await createClient();
  // The object path is a fresh UUID and is never overwritten, so the browser
  // may keep it for a year. Without this, Storage served photos with no
  // cache-control at all, leaving the browser to guess and re-check.
  const [{ error: uploadError }, thumbResult] = await timed(
    "photo-upload",
    "storage-upload",
    Promise.all([
      supabase.storage.from("photos").upload(objectPath, input.image, {
        contentType: input.mimeType,
        cacheControl: "31536000",
      }),
      input.thumbnail
        ? supabase.storage
            .from("photos")
            .upload(thumbnailPathFor(objectPath), input.thumbnail.image, {
              contentType: input.thumbnail.mimeType,
              cacheControl: "31536000",
            })
        : null,
    ]),
  );
  if (uploadError) {
    throw new Error(`Photo upload failed: ${uploadError.message}`);
  }
  if (thumbResult?.error) {
    // Non-fatal: list cards fall back to the full photo.
    console.error("Thumbnail upload failed:", thumbResult.error.message);
  }

  // The row insert and the URL signing each only need the uploaded object,
  // not each other, so they run together instead of back to back.
  const [photo, { data, error: signError }] = await Promise.all([
    timed(
      "photo-upload",
      "insert",
      EntryPhotosRepository.create({
        entryId,
        userId: user.id,
        storagePath: objectPath,
        kind: input.kind,
        makeCover: input.makeCover,
      }),
    ),
    timed(
      "photo-upload",
      "sign",
      supabase.storage
        .from("photos")
        .createSignedUrl(objectPath, PHOTO_SIGNED_URL_EXPIRY_SECONDS),
    ),
  ]);
  if (signError)
    throw new Error(`Failed to sign photo URL: ${signError.message}`);

  return { id: photo.id, url: data.signedUrl, kind: photo.kind };
}

/** Rename an entry. An empty title clears it (the list falls back to "Untitled entry"). */
export async function updateMyEntryTitle(
  id: string,
  title: string,
): Promise<Entry | null> {
  const userId = await requireUserId();
  const trimmed = title.trim().slice(0, 200);
  return EntriesRepository.update(id, userId, {
    title: trimmed.length > 0 ? trimmed : null,
  });
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
  // The user's "today" (a profile read) doesn't depend on the upload, so it
  // loads alongside it instead of after it.
  const [{ error: uploadError }, entryDate] = await Promise.all([
    timed(
      "recording-upload",
      "storage-upload",
      supabase.storage
        .from("recordings")
        .upload(objectPath, input.audio, { contentType: input.mimeType }),
    ),
    timed("recording-upload", "today", getMyToday()),
  ]);
  if (uploadError) {
    throw new Error(`Recording upload failed: ${uploadError.message}`);
  }

  const { entry } = await EntriesRepository.createVoiceEntry({
    userId: user.id,
    type: input.type ?? "journal",
    storagePath: objectPath,
    durationMs: input.durationMs,
    mimeType: input.mimeType,
    entryDate,
    // Picked up by the background retry if the summary never lands (the
    // client asks for it once transcription is done, but may be closed).
    summaryRetryAt: new Date(Date.now() + SUMMARY_GRACE_MS),
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
    entryDate: await getMyToday(),
    summaryRetryAt: new Date(Date.now() + SUMMARY_GRACE_MS),
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
  options?: {
    /**
     * Re-run the LLM summary after saving. Default true (an explicit save).
     * Autosave passes false: re-summarizing on every pause would burn LLM
     * quota while someone is simply typing, so the editor asks for one
     * refresh after the user stops editing instead.
     */
    resummarize?: boolean;
  },
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
  if (options?.resummarize !== false) {
    // Marked first, so the summary still gets refreshed if the background
    // job below never runs to completion.
    await EntriesRepository.setSummaryRetry(
      entryId,
      userId,
      new Date(Date.now() + SUMMARY_GRACE_MS),
    );
    after(async () => {
      try {
        await summarizeEntry(entryId, userId);
      } catch (err) {
        console.error(`Background summarize failed for entry ${entryId}:`, err);
      }
    });
  }

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
  outcome: SummarizeOutcome;
  summary: Summary | null;
  tasks: EntryTask[];
}> {
  const userId = await requireUserId();
  const outcome = await summarizeEntry(entryId, userId);
  const [summary, tasks] = await Promise.all([
    SummariesRepository.getByEntry(entryId, userId),
    EntryTasksRepository.listByEntry(entryId, userId),
  ]);
  return { outcome, summary, tasks };
}

/**
 * Writes at most one overdue summary for the signed-in user. Called from the
 * protected layout's after() on each page load, so pending summaries catch
 * up while the app is in use. Never throws.
 */
export async function retryMyPendingSummary(): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;
    await retryDueSummary(user.id);
  } catch (err) {
    // Same reasoning as recordMyVisit: during build probing there is no
    // request, and a failed retry just waits for the next page load.
    if (!(
      err instanceof Error && /cookies|Dynamic server usage/.test(err.message)
    )) {
      console.error("Background summary retry failed:", err);
    }
  }
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
