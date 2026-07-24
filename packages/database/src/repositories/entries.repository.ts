import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../client";
import {
  entries,
  recordings,
  transcripts,
  type Entry,
  type EntrySource,
  type EntryType,
  type NewEntry,
  type Recording,
  type Transcript,
} from "../schema";

export interface ListEntriesOptions {
  type?: EntryType;
  /** Include archived entries. Default false. */
  includeArchived?: boolean;
}

/**
 * Journals and notes both live here, distinguished by `type`. Every method is
 * scoped by userId. Deletes are soft (`deleted_at`) — never a hard DELETE.
 */
export const EntriesRepository = {
  async create(input: {
    userId: string;
    type: EntryType;
    source: EntrySource;
    title?: string | null;
    entryDate?: string | null;
  }): Promise<Entry> {
    const values: NewEntry = {
      userId: input.userId,
      type: input.type,
      source: input.source,
      title: input.title ?? null,
      entryDate: input.entryDate ?? null,
    };
    const rows = await getDb().insert(entries).values(values).returning();
    return rows[0]!;
  },

  async getByIdForUser(id: string, userId: string): Promise<Entry | null> {
    const rows = await getDb()
      .select()
      .from(entries)
      .where(and(eq(entries.id, id), eq(entries.userId, userId)))
      .limit(1);
    const entry = rows[0];
    if (!entry || entry.deletedAt) return null;
    return entry;
  },

  async listForUser(
    userId: string,
    options: ListEntriesOptions = {},
  ): Promise<Entry[]> {
    const conditions = [eq(entries.userId, userId), isNull(entries.deletedAt)];
    if (!options.includeArchived) conditions.push(isNull(entries.archivedAt));
    if (options.type) conditions.push(eq(entries.type, options.type));

    return getDb()
      .select()
      .from(entries)
      .where(and(...conditions))
      .orderBy(desc(entries.createdAt));
  },

  async countForUser(userId: string): Promise<number> {
    const rows = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(entries)
      .where(and(eq(entries.userId, userId), isNull(entries.deletedAt)));
    return rows[0]?.count ?? 0;
  },

  async update(
    id: string,
    userId: string,
    patch: Partial<Pick<Entry, "title" | "entryDate">>,
  ): Promise<Entry | null> {
    const rows = await getDb()
      .update(entries)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(entries.id, id), eq(entries.userId, userId)))
      .returning();
    return rows[0] ?? null;
  },

  async setArchived(
    id: string,
    userId: string,
    archived: boolean,
  ): Promise<Entry | null> {
    const rows = await getDb()
      .update(entries)
      .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(entries.id, id), eq(entries.userId, userId)))
      .returning();
    return rows[0] ?? null;
  },

  /** Soft delete only. Moves the entry to Trash; never removes the row. */
  async softDelete(id: string, userId: string): Promise<Entry | null> {
    const rows = await getDb()
      .update(entries)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(entries.id, id), eq(entries.userId, userId)))
      .returning();
    return rows[0] ?? null;
  },

  async restore(id: string, userId: string): Promise<Entry | null> {
    const rows = await getDb()
      .update(entries)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(entries.id, id), eq(entries.userId, userId)))
      .returning();
    return rows[0] ?? null;
  },

  /**
   * Creates the entry, its recording, and a pending transcript row together in
   * one Postgres transaction — either all three exist or none do. This is the
   * write path for the record screen (Phase 4).
   */
  async createVoiceEntry(input: {
    userId: string;
    type: EntryType;
    storagePath: string;
    durationMs: number;
    mimeType: string;
  }): Promise<{ entry: Entry; recording: Recording; transcript: Transcript }> {
    return getDb().transaction(async (tx) => {
      const [entry] = await tx
        .insert(entries)
        .values({
          userId: input.userId,
          type: input.type,
          source: "voice",
        })
        .returning();
      if (!entry) throw new Error("Failed to create entry");

      const [recording] = await tx
        .insert(recordings)
        .values({
          entryId: entry.id,
          storagePath: input.storagePath,
          durationMs: input.durationMs,
          mimeType: input.mimeType,
        })
        .returning();
      if (!recording) throw new Error("Failed to create recording");

      const [transcript] = await tx
        .insert(transcripts)
        .values({
          entryId: entry.id,
          status: "pending",
        })
        .returning();
      if (!transcript) throw new Error("Failed to create transcript");

      return { entry, recording, transcript };
    });
  },
};
