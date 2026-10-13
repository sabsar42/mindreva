import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../client";
import {
  entries,
  entryPhotos,
  type EntryPhoto,
  type EntryPhotoKind,
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

/** Photo attachments, scoped to entries the user owns. Ordered by position. */
export const EntryPhotosRepository = {
  /**
   * position is computed here, never client-supplied.
   *  - kind 'cover' (default): appended at the current photo count, so the
   *    first attached photo stays the cover. With `makeCover`, it instead takes
   *    a position just before the lowest existing cover, so it becomes the cover
   *    ("Change cover image") without touching or deleting the earlier ones.
   *  - kind 'inline': referenced from the journal body by id; its position is
   *    irrelevant to ordering (the body's token order is what counts).
   */
  async create(input: {
    entryId: string;
    userId: string;
    storagePath: string;
    kind?: EntryPhotoKind;
    makeCover?: boolean;
  }): Promise<EntryPhoto> {
    await assertEntryOwned(input.entryId, input.userId);
    const kind = input.kind ?? "cover";

    let position = 0;
    if (kind === "cover" && input.makeCover) {
      const minRows = await getDb()
        .select({ min: sql<number | null>`min(${entryPhotos.position})` })
        .from(entryPhotos)
        .where(
          and(
            eq(entryPhotos.entryId, input.entryId),
            eq(entryPhotos.kind, "cover"),
          ),
        );
      const min = minRows[0]?.min;
      position = min === null || min === undefined ? 0 : min - 1;
    } else {
      const countRows = await getDb()
        .select({ count: sql<number>`count(*)::int` })
        .from(entryPhotos)
        .where(eq(entryPhotos.entryId, input.entryId));
      position = countRows[0]?.count ?? 0;
    }

    const rows = await getDb()
      .insert(entryPhotos)
      .values({
        entryId: input.entryId,
        storagePath: input.storagePath,
        position,
        kind,
      })
      .returning();
    return rows[0]!;
  },

  /**
   * Photos for a SHARED entry, by id. Deliberately not scoped by user: the
   * caller (the share service) has already verified the share token, and the
   * ids come from the entry's own body. Constrained to this entry, so a crafted
   * token in the body can never pull in another entry's image.
   */
  async listForSharedEntry(
    entryId: string,
    photoIds: string[],
  ): Promise<EntryPhoto[]> {
    if (photoIds.length === 0) return [];
    return getDb()
      .select()
      .from(entryPhotos)
      .where(
        and(
          eq(entryPhotos.entryId, entryId),
          inArray(entryPhotos.id, photoIds),
        ),
      );
  },

  /** The entry's cover photo (lowest-position 'cover'), for a shared entry. */
  async getCoverForSharedEntry(entryId: string): Promise<EntryPhoto | null> {
    const rows = await getDb()
      .select()
      .from(entryPhotos)
      .where(
        and(eq(entryPhotos.entryId, entryId), eq(entryPhotos.kind, "cover")),
      )
      .orderBy(asc(entryPhotos.position))
      .limit(1);
    return rows[0] ?? null;
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

  /** Lowest-position photo for each of the given entries — used for list-row
   * and calendar-cell thumbnails, where only the "cover" photo is shown. */
  async getFirstPhotosForEntries(
    entryIds: string[],
    userId: string,
  ): Promise<Map<string, { id: string; storagePath: string }>> {
    if (entryIds.length === 0) return new Map();
    const rows = await getDb()
      .selectDistinctOn([entryPhotos.entryId], {
        entryId: entryPhotos.entryId,
        id: entryPhotos.id,
        storagePath: entryPhotos.storagePath,
      })
      .from(entryPhotos)
      .innerJoin(entries, eq(entries.id, entryPhotos.entryId))
      .where(
        and(
          inArray(entryPhotos.entryId, entryIds),
          eq(entries.userId, userId),
          eq(entryPhotos.kind, "cover"),
        ),
      )
      .orderBy(asc(entryPhotos.entryId), asc(entryPhotos.position));
    return new Map(rows.map((r) => [r.entryId, r]));
  },

  /** Lowest-position photo per entry_date, across all of the user's active
   * entries — used for the calendar month grid's day-cell thumbnails. When a
   * date has multiple entries, the most recently created entry's cover wins. */
  async getFirstPhotosByDate(
    userId: string,
    type?: "journal" | "note",
  ): Promise<Map<string, { id: string; storagePath: string }>> {
    const conditions = [
      eq(entries.userId, userId),
      eq(entryPhotos.kind, "cover"),
      isNull(entries.deletedAt),
      isNull(entries.archivedAt),
    ];
    if (type) conditions.push(eq(entries.type, type));

    const rows = await getDb()
      .selectDistinctOn([entries.entryDate], {
        entryDate: entries.entryDate,
        id: entryPhotos.id,
        storagePath: entryPhotos.storagePath,
      })
      .from(entryPhotos)
      .innerJoin(entries, eq(entries.id, entryPhotos.entryId))
      .where(and(...conditions))
      .orderBy(
        asc(entries.entryDate),
        asc(entryPhotos.entryId),
        asc(entryPhotos.position),
      );
    return new Map(
      rows.filter((r) => r.entryDate).map((r) => [r.entryDate!, r]),
    );
  },
};
