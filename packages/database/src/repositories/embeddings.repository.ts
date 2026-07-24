import { and, cosineDistance, eq, gte, isNull, lte, sql } from "drizzle-orm";
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
   * Retrieval for the past-self chat (Phase 6). Hard-filters by user AND date
   * range FIRST, then ranks by vector distance — a 2021 question must never
   * match a semantically-similar 2023 entry.
   */
  async matchEntries(
    userId: string,
    queryVector: number[],
    dateRangeStart: string,
    dateRangeEnd: string,
    limit = 8,
  ): Promise<MatchedEntry[]> {
    const distance = cosineDistance(embeddings.embedding, queryVector);
    return getDb()
      .select({
        entryId: embeddings.entryId,
        chunkText: embeddings.chunkText,
        entryDate: entries.entryDate,
        distance: sql<number>`${distance}`,
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
