import { and, asc, eq, or, sql } from "drizzle-orm";
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

  /** All transcripts for an entry, oldest first (index 0 = primary). */
  async getAllByEntry(entryId: string, userId: string): Promise<Transcript[]> {
    const rows = await getDb()
      .select({ t: transcripts })
      .from(transcripts)
      .innerJoin(entries, eq(entries.id, transcripts.entryId))
      .where(and(eq(transcripts.entryId, entryId), eq(entries.userId, userId)))
      .orderBy(asc(transcripts.createdAt));
    return rows.map((r) => r.t);
  },

  /**
   * Count transcripts still in-flight (pending or processing) for an entry.
   * Used to expose pendingAddonCount on the transcript API so the editor can
   * poll until the new text has been appended.
   */
  async countPendingByEntry(entryId: string, userId: string): Promise<number> {
    const rows = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(transcripts)
      .innerJoin(entries, eq(entries.id, transcripts.entryId))
      .where(
        and(
          eq(transcripts.entryId, entryId),
          eq(entries.userId, userId),
          or(
            eq(transcripts.status, "pending"),
            eq(transcripts.status, "processing"),
          ),
        ),
      );
    return rows[0]?.count ?? 0;
  },

  /**
   * Append a new paragraph to a transcript's edited_text. Used after an
   * add-on recording is transcribed: raw_text of the new recording is
   * appended to the primary transcript so the editor sees combined text.
   */
  async appendToEditedText(
    id: string,
    userId: string,
    suffix: string,
  ): Promise<Transcript | null> {
    const owned = await getDb()
      .select({
        id: transcripts.id,
        editedText: transcripts.editedText,
        rawText: transcripts.rawText,
      })
      .from(transcripts)
      .innerJoin(entries, eq(entries.id, transcripts.entryId))
      .where(and(eq(transcripts.id, id), eq(entries.userId, userId)))
      .limit(1);
    if (!owned[0]) return null;

    const current = owned[0].editedText ?? owned[0].rawText ?? "";
    const newText = current ? `${current}\n\n${suffix}` : suffix;

    const rows = await getDb()
      .update(transcripts)
      .set({ editedText: newText })
      .where(eq(transcripts.id, id))
      .returning();
    return rows[0] ?? null;
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
