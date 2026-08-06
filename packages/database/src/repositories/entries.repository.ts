import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "../client";
import {
  entries,
  recordings,
  summaries,
  transcripts,
  type Entry,
  type EntrySource,
  type EntryType,
  type NewEntry,
  type Recording,
  type Transcript,
} from "../schema";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface ListEntriesOptions {
  type?: EntryType;
  /** Include archived entries. Default false. */
  includeArchived?: boolean;
  /** Inclusive entry_date range, "YYYY-MM-DD". */
  dateFrom?: string;
  dateTo?: string;
}

/** Entry plus the two fields NoteCard needs that don't live on `entries`. */
export interface EntryListItem extends Entry {
  durationMs: number | null;
  snippet: string | null;
}

const snippetExpr = sql<
  string | null
>`coalesce(${transcripts.editedText}, ${transcripts.rawText})`;

function withListMeta<
  T extends { entry: Entry; durationMs: number | null; snippet: string | null },
>(row: T): EntryListItem {
  return { ...row.entry, durationMs: row.durationMs, snippet: row.snippet };
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

  /** Batch fetch — used to resolve chat citation chips to entry dates. */
  async listByIds(ids: string[], userId: string): Promise<Entry[]> {
    if (ids.length === 0) return [];
    return getDb()
      .select()
      .from(entries)
      .where(and(inArray(entries.id, ids), eq(entries.userId, userId)));
  },

  async listForUser(
    userId: string,
    options: ListEntriesOptions = {},
  ): Promise<EntryListItem[]> {
    const conditions = [eq(entries.userId, userId), isNull(entries.deletedAt)];
    if (!options.includeArchived) conditions.push(isNull(entries.archivedAt));
    if (options.type) conditions.push(eq(entries.type, options.type));
    if (options.dateFrom)
      conditions.push(gte(entries.entryDate, options.dateFrom));
    if (options.dateTo) conditions.push(lte(entries.entryDate, options.dateTo));

    const rows = await getDb()
      .select({
        entry: entries,
        durationMs: recordings.durationMs,
        snippet: snippetExpr,
      })
      .from(entries)
      .leftJoin(recordings, eq(recordings.entryId, entries.id))
      .leftJoin(transcripts, eq(transcripts.entryId, entries.id))
      .where(and(...conditions))
      .orderBy(desc(entries.createdAt));
    return rows.map(withListMeta);
  },

  /** entry_date of every non-deleted, non-archived entry — for calendar dots. */
  async listEntryDatesForUser(
    userId: string,
    type?: EntryType,
  ): Promise<string[]> {
    const conditions = [
      eq(entries.userId, userId),
      isNull(entries.deletedAt),
      isNull(entries.archivedAt),
      isNotNull(entries.entryDate),
    ];
    if (type) conditions.push(eq(entries.type, type));

    const rows = await getDb()
      .selectDistinct({ entryDate: entries.entryDate })
      .from(entries)
      .where(and(...conditions));
    return rows.map((r) => r.entryDate!).filter(Boolean);
  },

  async listArchivedForUser(
    userId: string,
    type?: EntryType,
  ): Promise<EntryListItem[]> {
    const conditions = [
      eq(entries.userId, userId),
      isNull(entries.deletedAt),
      isNotNull(entries.archivedAt),
    ];
    if (type) conditions.push(eq(entries.type, type));

    const rows = await getDb()
      .select({
        entry: entries,
        durationMs: recordings.durationMs,
        snippet: snippetExpr,
      })
      .from(entries)
      .leftJoin(recordings, eq(recordings.entryId, entries.id))
      .leftJoin(transcripts, eq(transcripts.entryId, entries.id))
      .where(and(...conditions))
      .orderBy(desc(entries.archivedAt));
    return rows.map(withListMeta);
  },

  async listTrashedForUser(userId: string): Promise<EntryListItem[]> {
    const rows = await getDb()
      .select({
        entry: entries,
        durationMs: recordings.durationMs,
        snippet: snippetExpr,
      })
      .from(entries)
      .leftJoin(recordings, eq(recordings.entryId, entries.id))
      .leftJoin(transcripts, eq(transcripts.entryId, entries.id))
      .where(and(eq(entries.userId, userId), isNotNull(entries.deletedAt)))
      .orderBy(desc(entries.deletedAt));
    return rows.map(withListMeta);
  },

  /**
   * Basic ILIKE search across the entry title, its confirmed transcript text,
   * and its latest summary — not a full search stack, per Phase 5's scope.
   */
  async searchForUser(
    userId: string,
    query: string,
    type?: EntryType,
  ): Promise<EntryListItem[]> {
    const pattern = `%${query}%`;
    const conditions = [
      eq(entries.userId, userId),
      isNull(entries.deletedAt),
      or(
        ilike(entries.title, pattern),
        ilike(transcripts.editedText, pattern),
        ilike(transcripts.rawText, pattern),
        ilike(summaries.summaryText, pattern),
      ),
    ];
    if (type) conditions.push(eq(entries.type, type));

    const rows = await getDb()
      .selectDistinctOn([entries.id], {
        entry: entries,
        durationMs: recordings.durationMs,
        snippet: snippetExpr,
      })
      .from(entries)
      .leftJoin(recordings, eq(recordings.entryId, entries.id))
      .leftJoin(transcripts, eq(transcripts.entryId, entries.id))
      .leftJoin(summaries, eq(summaries.entryId, entries.id))
      .where(and(...conditions))
      .orderBy(entries.id, desc(entries.createdAt));

    return rows
      .map(withListMeta)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async countForUser(
    userId: string,
    options: { dateFrom?: string; dateTo?: string } = {},
  ): Promise<number> {
    const conditions = [eq(entries.userId, userId), isNull(entries.deletedAt)];
    if (options.dateFrom)
      conditions.push(gte(entries.entryDate, options.dateFrom));
    if (options.dateTo) conditions.push(lte(entries.entryDate, options.dateTo));

    const rows = await getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(entries)
      .where(and(...conditions));
    return rows[0]?.count ?? 0;
  },

  /**
   * Distinct entry_dates inside an inclusive range — the persona chat's
   * monthly timeline needs to know which months of the selected period the
   * user actually wrote in. Matches listEntryDatesForUser's filters (active
   * entries only) so the two never disagree about what "has an entry" means.
   */
  async listEntryDatesInRange(
    userId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<string[]> {
    const rows = await getDb()
      .selectDistinct({ entryDate: entries.entryDate })
      .from(entries)
      .where(
        and(
          eq(entries.userId, userId),
          isNull(entries.deletedAt),
          isNull(entries.archivedAt),
          isNotNull(entries.entryDate),
          gte(entries.entryDate, dateFrom),
          lte(entries.entryDate, dateTo),
        ),
      );
    return rows.map((r) => r.entryDate!).filter(Boolean);
  },

  /**
   * The earliest active entry in a range, with its transcript text — the
   * persona chat opens the conversation with this entry's real first line
   * rather than a fabricated greeting, so the opening must come from actual
   * stored text. Ordered by entry_date (then createdAt to break same-day
   * ties deterministically).
   */
  async getEarliestInRange(
    userId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<{
    id: string;
    entryDate: string | null;
    title: string | null;
    text: string | null;
  } | null> {
    const rows = await getDb()
      .select({
        id: entries.id,
        entryDate: entries.entryDate,
        title: entries.title,
        text: snippetExpr,
      })
      .from(entries)
      .leftJoin(transcripts, eq(transcripts.entryId, entries.id))
      .where(
        and(
          eq(entries.userId, userId),
          isNull(entries.deletedAt),
          isNull(entries.archivedAt),
          isNotNull(entries.entryDate),
          gte(entries.entryDate, dateFrom),
          lte(entries.entryDate, dateTo),
        ),
      )
      .orderBy(entries.entryDate, entries.createdAt)
      .limit(1);
    return rows[0] ?? null;
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
          entryDate: today(),
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

  /**
   * Typed (non-voice) entries reuse the transcripts table to hold their body,
   * with status='done' immediately — no ASR involved — so summarization.service
   * has exactly one code path regardless of source. See docs/roadmap.md Phase 5.
   */
  async createTextEntry(input: {
    userId: string;
    type: EntryType;
    text: string;
  }): Promise<{ entry: Entry; transcript: Transcript }> {
    return getDb().transaction(async (tx) => {
      const [entry] = await tx
        .insert(entries)
        .values({
          userId: input.userId,
          type: input.type,
          source: "text",
          entryDate: today(),
        })
        .returning();
      if (!entry) throw new Error("Failed to create entry");

      const [transcript] = await tx
        .insert(transcripts)
        .values({
          entryId: entry.id,
          status: "done",
          rawText: input.text,
          editedText: input.text,
        })
        .returning();
      if (!transcript) throw new Error("Failed to create transcript");

      return { entry, transcript };
    });
  },
};
