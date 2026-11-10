import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../client";
import {
  entries,
  transcripts,
  type Transcript,
  type TranscriptSegmentRow,
  type TranscriptStatus,
} from "../schema";

async function assertEntryOwned(
  entryId: string,
  userId: string,
): Promise<void> {
  const rows = await getDb()
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.id, entryId), eq(entries.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new Error("Entry not found for user");
}

/**
 * Transcripts carry a `status` (pending/processing/done/failed) so the UI can
 * show a "still working on it" / retry state. `raw_text` is never overwritten;
 * user edits go to `edited_text`.
 */
/** How long an add-on may stay pending before it is considered abandoned. */
const ADDON_STALE_MINUTES = 10;

export const TranscriptsRepository = {
  async create(input: {
    entryId: string;
    userId: string;
    status?: TranscriptStatus;
    provider?: string | null;
    language?: string | null;
  }): Promise<Transcript> {
    await assertEntryOwned(input.entryId, input.userId);
    const rows = await getDb()
      .insert(transcripts)
      .values({
        entryId: input.entryId,
        status: input.status ?? "pending",
        provider: input.provider ?? null,
        language: input.language ?? null,
      })
      .returning();
    return rows[0]!;
  },

  async getByEntry(
    entryId: string,
    userId: string,
  ): Promise<Transcript | null> {
    const rows = await getDb()
      .select({ t: transcripts })
      .from(transcripts)
      .innerJoin(entries, eq(entries.id, transcripts.entryId))
      .where(and(eq(transcripts.entryId, entryId), eq(entries.userId, userId)))
      .orderBy(asc(transcripts.createdAt))
      .limit(1);
    return rows[0]?.t ?? null;
  },

  /**
   * State of the entry's ADD-ON recordings (every transcript except the
   * primary, i.e. the oldest). `pending` counts add-ons still being
   * transcribed; `latestFailed` is true when the newest add-on could not be
   * transcribed. A transcript that has sat pending/processing for longer than
   * ADDON_STALE_MINUTES is treated as abandoned (the server function that was
   * transcribing it died), so the editor never polls forever on it.
   */
  async addonStatusByEntry(
    entryId: string,
    userId: string,
  ): Promise<{ pending: number; latestFailed: boolean }> {
    const result = await getDb().execute(sql`
      WITH addons AS (
        SELECT t.status, t.created_at
        FROM ${transcripts} t
        JOIN ${entries} e ON e.id = t.entry_id
        WHERE t.entry_id = ${entryId}
          AND e.user_id = ${userId}
          AND t.created_at > now() - make_interval(mins => ${ADDON_STALE_MINUTES})
          AND t.id <> (
            SELECT p.id FROM ${transcripts} p
            WHERE p.entry_id = ${entryId}
            ORDER BY p.created_at ASC LIMIT 1
          )
      )
      SELECT
        count(*) FILTER (WHERE status IN ('pending', 'processing'))::int AS pending,
        (SELECT status FROM addons ORDER BY created_at DESC LIMIT 1) = 'failed' AS latest_failed
      FROM addons`);
    const rows = (
      Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows
    ) as { pending: number; latest_failed: boolean | null }[];
    return {
      pending: Number(rows?.[0]?.pending ?? 0),
      latestFailed: rows?.[0]?.latest_failed === true,
    };
  },

  /**
   * Appends a paragraph to a transcript's edited text (falling back to its
   * raw text as the base), in ONE atomic statement. A read-then-write here
   * would lose an edit made at the same moment (autosave) or a second add-on
   * finishing together with this one. Blank text appends nothing. Returns
   * whether a row was changed.
   */
  async appendToEditedText(
    id: string,
    userId: string,
    suffix: string,
  ): Promise<boolean> {
    const text = suffix.trim();
    if (!text) return false;
    const result = await getDb().execute(sql`
      UPDATE ${transcripts} t
      SET edited_text = CASE
        WHEN coalesce(t.edited_text, t.raw_text, '') = '' THEN ${text}
        ELSE coalesce(t.edited_text, t.raw_text) || chr(10) || chr(10) || ${text}
      END
      FROM ${entries} e
      WHERE t.id = ${id} AND e.id = t.entry_id AND e.user_id = ${userId}
      RETURNING t.id`);
    const rows = (
      Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows
    ) as unknown[];
    return (rows?.length ?? 0) > 0;
  },

  async setResult(
    id: string,
    userId: string,
    patch: {
      status: TranscriptStatus;
      rawText?: string | null;
      language?: string | null;
      provider?: string | null;
      segments?: TranscriptSegmentRow[] | null;
    },
  ): Promise<Transcript | null> {
    // Guard ownership through the parent entry.
    const owned = await getDb()
      .select({ id: transcripts.id })
      .from(transcripts)
      .innerJoin(entries, eq(entries.id, transcripts.entryId))
      .where(and(eq(transcripts.id, id), eq(entries.userId, userId)))
      .limit(1);
    if (!owned[0]) return null;

    const rows = await getDb()
      .update(transcripts)
      .set(patch)
      .where(eq(transcripts.id, id))
      .returning();
    return rows[0] ?? null;
  },

  /**
   * Store timed segments without touching raw_text or edited_text. Used both
   * when a transcript is first produced and to backfill timestamps onto a
   * transcript made before segments were stored.
   */
  async setSegments(
    id: string,
    userId: string,
    segments: TranscriptSegmentRow[],
  ): Promise<Transcript | null> {
    const owned = await getDb()
      .select({ id: transcripts.id })
      .from(transcripts)
      .innerJoin(entries, eq(entries.id, transcripts.entryId))
      .where(and(eq(transcripts.id, id), eq(entries.userId, userId)))
      .limit(1);
    if (!owned[0]) return null;

    const rows = await getDb()
      .update(transcripts)
      .set({ segments })
      .where(eq(transcripts.id, id))
      .returning();
    return rows[0] ?? null;
  },

  /** Save a user's correction without touching raw_text. */
  async setEditedText(
    id: string,
    userId: string,
    editedText: string,
  ): Promise<Transcript | null> {
    const owned = await getDb()
      .select({ id: transcripts.id })
      .from(transcripts)
      .innerJoin(entries, eq(entries.id, transcripts.entryId))
      .where(and(eq(transcripts.id, id), eq(entries.userId, userId)))
      .limit(1);
    if (!owned[0]) return null;

    const rows = await getDb()
      .update(transcripts)
      .set({ editedText })
      .where(eq(transcripts.id, id))
      .returning();
    return rows[0] ?? null;
  },
};
