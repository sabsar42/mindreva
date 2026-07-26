import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../client";
import { entries, entryPhotos, type EntryPhoto } from "../schema";

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

/** Photo attachments, scoped to entries the user owns. Ordered by position. */
export const EntryPhotosRepository = {
  /** position is computed here as the current photo count for the entry — not
   * client-supplied — so callers never need to track ordering themselves. */
  async create(input: {
    entryId: string;
    userId: string;
    storagePath: string;
  }): Promise<EntryPhoto> {
    await assertEntryOwned(input.entryId, input.userId);

    const countRows = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(entryPhotos)
      .where(eq(entryPhotos.entryId, input.entryId));
    const count = countRows[0]?.count ?? 0;

    const rows = await getDb()
      .insert(entryPhotos)
      .values({
        entryId: input.entryId,
        storagePath: input.storagePath,
        position: count,
      })
      .returning();
    return rows[0]!;
  },

  async listByEntry(entryId: string, userId: string): Promise<EntryPhoto[]> {
    const rows = await getDb()
      .select({ p: entryPhotos })
      .from(entryPhotos)
      .innerJoin(entries, eq(entries.id, entryPhotos.entryId))
      .where(and(eq(entryPhotos.entryId, entryId), eq(entries.userId, userId)))
      .orderBy(asc(entryPhotos.position));
    return rows.map((r) => r.p);
  },
};
