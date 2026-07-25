import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { getDb } from "../client";
import { embeddings, entries, type Embedding } from "../schema";

export interface MatchedEntry {
  entryId: string;
  chunkText: string | null;
  entryDate: string | null;
  distance: number;
}

/** One embedding per entry for MVP (no chunking yet). */
export const EmbeddingsRepository = {
  async create(input: {
    entryId: string;
    userId: string;
    chunkText: string;
    embedding: number[];
  }): Promise<Embedding> {
    const owned = await getDb()
      .select({ id: entries.id })
      .from(entries)
      .where(
        and(eq(entries.id, input.entryId), eq(entries.userId, input.userId)),
      )
      .limit(1);
    if (!owned[0]) throw new Error("Entry not found for user");

    const rows = await getDb()
      .insert(embeddings)
      .values({
        entryId: input.entryId,
        chunkText: input.chunkText,
        embedding: input.embedding,
      })
      .returning();
    return rows[0]!;
  },

  /**
   * "One embedding per entry for MVP" (see the note above) means re-embedding
   * — after an edit or a summary regenerate — must replace the entry's prior
   * row, not add another. Without this, matchEntries would return duplicate
   * hits for the same entry and skew top-k toward whichever entries happened
   * to be re-summarized most, not whichever are most relevant.
   */
  async upsertForEntry(input: {
    entryId: string;
    userId: string;
    chunkText: string;
    embedding: number[];
  }): Promise<Embedding> {
    const owned = await getDb()
      .select({ id: entries.id })
      .from(entries)
      .where(
        and(eq(entries.id, input.entryId), eq(entries.userId, input.userId)),
      )
      .limit(1);
    if (!owned[0]) throw new Error("Entry not found for user");

    return getDb().transaction(async (tx) => {
      await tx.delete(embeddings).where(eq(embeddings.entryId, input.entryId));
      const rows = await tx
        .insert(embeddings)
        .values({
          entryId: input.entryId,
          chunkText: input.chunkText,
          embedding: input.embedding,
        })
        .returning();
      return rows[0]!;
    });
  },

  /**
   * Retrieval for the past-self chat (Phase 6). Hard-filters by user AND date
   * range FIRST, then ranks by vector distance — a 2021 question must never
   * match a semantically-similar 2023 entry.
   *
   * The distance expression casts both sides to ::halfvec(2048) to match the
   * halfvec HNSW expression index on embeddings.embedding (see the 0003
   * migration) — pgvector's HNSW index caps out at 2000 dimensions, so this
   * column is indexed via a half-precision cast instead of the raw vector(2048)
   * type. Without this cast here, Postgres cannot use that index and silently
   * falls back to a full sequential scan.
   */
  async matchEntries(
    userId: string,
    queryVector: number[],
    dateRangeStart: string,
    dateRangeEnd: string,
    limit = 8,
  ): Promise<MatchedEntry[]> {
    const queryVectorLiteral = `[${queryVector.join(",")}]`;
    const distance = sql<number>`(${embeddings.embedding}::halfvec(2048)) <=> (${queryVectorLiteral}::halfvec(2048))`;
    return getDb()
      .select({
        entryId: embeddings.entryId,
        chunkText: embeddings.chunkText,
        entryDate: entries.entryDate,
        distance,
      })
      .from(embeddings)
      .innerJoin(entries, eq(entries.id, embeddings.entryId))
      .where(
        and(
          eq(entries.userId, userId),
          isNull(entries.deletedAt),
          gte(entries.entryDate, dateRangeStart),
          lte(entries.entryDate, dateRangeEnd),
        ),
      )
      .orderBy(distance)
      .limit(limit);
  },
};
