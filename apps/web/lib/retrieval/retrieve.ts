import "server-only";
import { ChunksRepository } from "@mindreva/database";
import { extractKeywordQuery, type KeywordQuery } from "./keywords";
import { fuseResults, type RetrievedChunk } from "./fuse";

/** Chunks given to the model per question. */
export const RETRIEVAL_TOP_K = 8;
/** Candidates fetched from each list before fusion. */
const CANDIDATES_PER_LIST = 20;

/**
 * Minimum cosine similarity for a vector hit to count as evidence.
 *
 * PROVISIONAL (2026-10-22): 0.30 is a placeholder until the Phase 2
 * retrieval eval (scripts/eval-retrieval) measures the real score
 * distribution of answerable vs unanswerable questions for this embedding
 * model; it must be set from those numbers, not left as a guess. Override
 * with RETRIEVAL_MIN_SIMILARITY without a deploy.
 */
export const DEFAULT_MIN_SIMILARITY = 0.3;

export function minSimilarity(): number {
  const fromEnv = Number(process.env.RETRIEVAL_MIN_SIMILARITY);
  return Number.isFinite(fromEnv) && fromEnv > 0 && fromEnv < 1
    ? fromEnv
    : DEFAULT_MIN_SIMILARITY;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  query: KeywordQuery;
  /** Everything both searches returned, before threshold and fusion — for
   * the eval and for debugging, never sent to the client. */
  debug: {
    vector: { chunkId: string; similarity: number }[];
    keyword: { chunkId: string; score: number }[];
    minSimilarity: number;
    vectorAvailable: boolean;
  };
}

/**
 * Hybrid retrieval for one question inside one date range:
 * 1. user_id + date-range filter (in SQL, both searches),
 * 2. vector search (when a query vector exists; keyword-only otherwise, e.g.
 *    the embedding provider is down),
 * 3. similarity threshold, keyword-evidence rule,
 * 4. Reciprocal Rank Fusion, top 8.
 */
export async function retrieveChunks(input: {
  userId: string;
  question: string;
  dateFrom: string;
  dateTo: string;
  queryVector: number[] | null;
}): Promise<RetrievalResult> {
  const query = extractKeywordQuery(input.question);
  const threshold = minSimilarity();
  const [vector, keyword] = await Promise.all([
    input.queryVector
      ? ChunksRepository.searchVector({
          userId: input.userId,
          queryVector: input.queryVector,
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
          limit: CANDIDATES_PER_LIST,
        })
      : Promise.resolve([]),
    ChunksRepository.searchKeyword({
      userId: input.userId,
      terms: query.terms,
      phrases: query.phrases,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      limit: CANDIDATES_PER_LIST,
    }),
  ]);

  return {
    chunks: fuseResults({
      vector,
      keyword,
      query,
      minSimilarity: threshold,
      topK: RETRIEVAL_TOP_K,
    }),
    query,
    debug: {
      vector: vector.map((v) => ({
        chunkId: v.chunkId,
        similarity: v.similarity,
      })),
      keyword: keyword.map((k) => ({ chunkId: k.chunkId, score: k.score })),
      minSimilarity: threshold,
      vectorAvailable: input.queryVector !== null,
    },
  };
}
