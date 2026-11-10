import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../client";
import { entries, recordings, type Recording } from "../schema";

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

/** Audio files, scoped to entries the user owns. */
export const RecordingsRepository = {
  async create(input: {
    entryId: string;
    userId: string;
    storagePath: string;
    durationMs?: number | null;
    mimeType?: string | null;
  }): Promise<Recording> {
    await assertEntryOwned(input.entryId, input.userId);
    const rows = await getDb()
      .insert(recordings)
      .values({
        entryId: input.entryId,
        storagePath: input.storagePath,
        durationMs: input.durationMs ?? null,
        mimeType: input.mimeType ?? null,
      })
      .returning();
    return rows[0]!;
  },

  async getByEntry(entryId: string, userId: string): Promise<Recording | null> {
    const rows = await getDb()
      .select({ r: recordings })
      .from(recordings)
      .innerJoin(entries, eq(entries.id, recordings.entryId))
      .where(and(eq(recordings.entryId, entryId), eq(entries.userId, userId)))
      .orderBy(asc(recordings.createdAt))
      .limit(1);
    return rows[0]?.r ?? null;
  },

  /** Fetch a specific recording by its own id, scoped to the user. */
  async getById(id: string, userId: string): Promise<Recording | null> {
    const rows = await getDb()
      .select({ r: recordings })
      .from(recordings)
      .innerJoin(entries, eq(entries.id, recordings.entryId))
      .where(and(eq(recordings.id, id), eq(entries.userId, userId)))
      .limit(1);
    return rows[0]?.r ?? null;
  },

  /** All recordings for an entry, oldest first. */
  async getAllByEntry(entryId: string, userId: string): Promise<Recording[]> {
    const rows = await getDb()
      .select({ r: recordings })
      .from(recordings)
      .innerJoin(entries, eq(entries.id, recordings.entryId))
      .where(and(eq(recordings.entryId, entryId), eq(entries.userId, userId)))
      .orderBy(asc(recordings.createdAt));
    return rows.map((r) => r.r);
  },

  /** How many recordings exist for an entry (any status). Used to derive
   *  hasRecordings for the entry detail without fetching full rows. */
  async countByEntry(entryId: string, userId: string): Promise<number> {
    const rows = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(recordings)
      .innerJoin(entries, eq(entries.id, recordings.entryId))
      .where(and(eq(recordings.entryId, entryId), eq(entries.userId, userId)));
    return rows[0]?.count ?? 0;
  },
};
