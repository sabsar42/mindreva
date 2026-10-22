import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../client";
import { embeddings, entries, entryChunks } from "../schema";

export interface ChunkToStore {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embedding: number[];
}

export interface ChunkHit {
  chunkId: string;
  entryId: string;
  chunkIndex: number;
  content: string;
  entryDate: string | null;
  entryTitle: string | null;
}

export interface VectorHit extends ChunkHit {
  /** 1 - cosine distance. */
  similarity: number;
}

export interface KeywordHit extends ChunkHit {
  /** ts_rank_cd over the OR'd query terms, plus 1 per matched phrase. */
  score: number;
}

type Row = Record<string, unknown>;
const rowsOf = (r: unknown): Row[] =>
  (Array.isArray(r) ? r : ((r as { rows?: Row[] }).rows ?? [])) as Row[];

function toHit(r: Row): ChunkHit {
  return {
    chunkId: String(r.id),
    entryId: String(r.entry_id),
    chunkIndex: Number(r.chunk_index),
    content: String(r.content),
    entryDate: (r.entry_date as string | null) ?? null,
    entryTitle: (r.title as string | null) ?? null,
  };
}

/** Unit-length mean of the chunk vectors: the per-entry vector the mindmap
 * clusters on (legacy `embeddings` table), derived without an extra API call. */
function meanVector(vectors: number[][]): number[] {
  const dims = vectors[0]!.length;
  const sum = new Array<number>(dims).fill(0);
  for (const v of vectors) for (let i = 0; i < dims; i++) sum[i]! += v[i]!;
  const norm = Math.hypot(...sum) || 1;
  return sum.map((x) => x / norm);
}

/**
 * Retrieval chunks (see apps/web/lib/retrieval). Every query is scoped by
 * user_id in SQL — this connection bypasses RLS, so the filter here is the
 * real isolation, with RLS as defense in depth.
 */
export const ChunksRepository = {
  /** The stored content hash for an entry's chunks, or null if it has none. */
  async getHashForEntry(
    entryId: string,
    userId: string,
  ): Promise<string | null> {
    const rows = await getDb()
      .select({ hash: entryChunks.contentHash })
      .from(entryChunks)
      .where(
        and(eq(entryChunks.entryId, entryId), eq(entryChunks.userId, userId)),
      )
      .limit(1);
    return rows[0]?.hash ?? null;
  },

  /**
   * Replaces an entry's chunks atomically: upserts each (entry_id,
   * chunk_index), deletes indexes past the new count, and refreshes the
   * legacy per-entry vector the mindmap reads — all in one transaction, so a
   * search never sees half an entry.
   */
  async replaceForEntry(input: {
    userId: string;
    entryId: string;
    entryDate: string | null;
    contentHash: string;
    /** Plain text for the legacy per-entry row (the mindmap's labels). */
    plainText: string;
    chunks: ChunkToStore[];
  }): Promise<void> {
    if (input.chunks.length === 0) {
      throw new Error("replaceForEntry needs at least one chunk");
    }
    await getDb().transaction(async (tx) => {
      const owned = await tx
        .select({ id: entries.id })
        .from(entries)
        .where(
          and(eq(entries.id, input.entryId), eq(entries.userId, input.userId)),
        )
        .limit(1);
      if (!owned[0]) throw new Error("Entry not found for user");

      for (const c of input.chunks) {
        await tx
          .insert(entryChunks)
          .values({
            userId: input.userId,
            entryId: input.entryId,
            chunkIndex: c.chunkIndex,
            content: c.content,
            tokenCount: c.tokenCount,
            entryDate: input.entryDate,
            contentHash: input.contentHash,
            embedding: c.embedding,
          })
          .onConflictDoUpdate({
            target: [entryChunks.entryId, entryChunks.chunkIndex],
            set: {
              content: c.content,
              tokenCount: c.tokenCount,
              entryDate: input.entryDate,
              contentHash: input.contentHash,
              embedding: c.embedding,
              updatedAt: new Date(),
            },
          });
      }
      await tx
        .delete(entryChunks)
        .where(
          and(
            eq(entryChunks.entryId, input.entryId),
            sql`${entryChunks.chunkIndex} >= ${input.chunks.length}`,
          ),
        );

      await tx.delete(embeddings).where(eq(embeddings.entryId, input.entryId));
      await tx.insert(embeddings).values({
        entryId: input.entryId,
        chunkText: input.plainText,
        embedding: meanVector(input.chunks.map((c) => c.embedding)),
      });
    });
  },

  /** The entry has no text any more: drop its chunks and legacy vector. */
  async deleteForEntry(entryId: string, userId: string): Promise<void> {
    await getDb().transaction(async (tx) => {
      await tx
        .delete(entryChunks)
        .where(
          and(eq(entryChunks.entryId, entryId), eq(entryChunks.userId, userId)),
        );
      const owned = await tx
        .select({ id: entries.id })
        .from(entries)
        .where(and(eq(entries.id, entryId), eq(entries.userId, userId)))
        .limit(1);
      if (owned[0]) {
        await tx.delete(embeddings).where(eq(embeddings.entryId, entryId));
      }
    });
  },

  /**
   * Nearest chunks by cosine similarity. Order of operations: user_id and
   * date range filter (WHERE), then the vector ordering on the SAME
   * expression as the HNSW index, then LIMIT. The similarity threshold is
   * applied by the caller.
   *
   * Filtered HNSW can return fewer rows than asked (the filter runs after
   * the graph walk). pgvector >= 0.8 iterative scans keep walking until
   * enough rows pass the filter; relaxed_order allows slightly out-of-order
   * results, so rows are re-sorted here. Both settings are SET LOCAL: they
   * only apply inside this transaction.
   */
  async searchVector(input: {
    userId: string;
    queryVector: number[];
    dateFrom: string;
    dateTo: string;
    limit: number;
  }): Promise<VectorHit[]> {
    const q = `[${input.queryVector.join(",")}]`;
    const result = await getDb().transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL hnsw.iterative_scan = relaxed_order`);
      await tx.execute(sql`SET LOCAL hnsw.ef_search = 100`);
      return tx.execute(sql`
        SELECT c.id, c.entry_id, c.chunk_index, c.content, c.entry_date, e.title,
               1 - ((c.embedding::halfvec(2048)) <=> (${q}::halfvec(2048))) AS similarity
        FROM ${entryChunks} c
        JOIN ${entries} e ON e.id = c.entry_id
        WHERE c.user_id = ${input.userId}
          AND c.entry_date BETWEEN ${input.dateFrom} AND ${input.dateTo}
          AND e.deleted_at IS NULL
        ORDER BY (c.embedding::halfvec(2048)) <=> (${q}::halfvec(2048))
        LIMIT ${input.limit}`);
    });
    return rowsOf(result)
      .map((r) => ({ ...toHit(r), similarity: Number(r.similarity) }))
      .sort((a, b) => b.similarity - a.similarity);
  },

  /**
   * Full-text search over chunk content, same user/date filters. `terms` are
   * OR'd (prefix match for longer words) so a question doesn't need every
   * word to appear; `phrases` (quoted text, names) are matched literally
   * with ILIKE and boost the score. Ranking is ts_rank_cd + 1 per phrase.
   */
  async searchKeyword(input: {
    userId: string;
    terms: string[];
    phrases: string[];
    dateFrom: string;
    dateTo: string;
    limit: number;
  }): Promise<KeywordHit[]> {
    const tsquery = input.terms
      .map((t) => (t.length >= 4 ? `${t}:*` : t))
      .join(" | ");
    if (!tsquery && input.phrases.length === 0) return [];
    const likes = input.phrases.map(
      (p) => `%${p.replace(/[\\%_]/g, (c) => `\\${c}`)}%`,
    );
    const textMatch = tsquery
      ? sql`c.content_tsv @@ to_tsquery('simple', ${tsquery})`
      : sql`false`;
    const rank = tsquery
      ? sql`ts_rank_cd(c.content_tsv, to_tsquery('simple', ${tsquery}))`
      : sql`0`;
    const phraseMatch = likes.length
      ? sql`c.content ILIKE ANY(${likes}::text[])`
      : sql`false`;
    const phraseScore = likes.length
      ? sql.join(
          likes.map(
            (l) => sql`(CASE WHEN c.content ILIKE ${l} THEN 1 ELSE 0 END)`,
          ),
          sql` + `,
        )
      : sql`0`;
    const result = await getDb().execute(sql`
      SELECT c.id, c.entry_id, c.chunk_index, c.content, c.entry_date, e.title,
             (${rank}) + (${phraseScore}) AS score
      FROM ${entryChunks} c
      JOIN ${entries} e ON e.id = c.entry_id
      WHERE c.user_id = ${input.userId}
        AND c.entry_date BETWEEN ${input.dateFrom} AND ${input.dateTo}
        AND e.deleted_at IS NULL
        AND ((${textMatch}) OR (${phraseMatch}))
      ORDER BY score DESC
      LIMIT ${input.limit}`);
    return rowsOf(result).map((r) => ({ ...toHit(r), score: Number(r.score) }));
  },
};
