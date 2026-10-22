import { matchedTerms, type KeywordQuery } from "./keywords";

/**
 * Merging vector and keyword results. Pure, unit-tested in fuse.test.ts.
 *
 * Reciprocal Rank Fusion: each list contributes 1 / (RRF_K + rank) for a
 * chunk it contains (rank from 1). It needs no score calibration between the
 * two very different scores (cosine similarity vs ts_rank), which is why it
 * is the standard simple choice. RRF_K = 60 is the value from the original
 * paper and the common default.
 */
export const RRF_K = 60;

export interface CandidateChunk {
  chunkId: string;
  entryId: string;
  chunkIndex: number;
  content: string;
  entryDate: string | null;
  entryTitle: string | null;
}

export interface RetrievedChunk extends CandidateChunk {
  /** Cosine similarity if the vector search saw this chunk, else null. */
  similarity: number | null;
  /** 1-based rank in the vector list (threshold-passing hits only). */
  vectorRank: number | null;
  /** 1-based rank in the keyword list (evidence hits only). */
  keywordRank: number | null;
  source: "vector" | "keyword" | "both";
  score: number;
}

/**
 * A keyword hit counts as evidence when it matches a quoted phrase or name,
 * or enough distinct question words: 2 if the question has 2+ content words,
 * else its only one. One shared everyday word is not evidence.
 */
export function isKeywordEvidence(
  content: string,
  query: KeywordQuery,
): boolean {
  const lower = content.toLowerCase();
  if (query.phrases.some((p) => lower.includes(p.toLowerCase()))) return true;
  const needed = Math.min(2, query.terms.length);
  if (needed === 0) return false;
  return matchedTerms(content, query.terms).length >= needed;
}

export function fuseResults(input: {
  vector: (CandidateChunk & { similarity: number })[];
  keyword: CandidateChunk[];
  query: KeywordQuery;
  minSimilarity: number;
  topK: number;
}): RetrievedChunk[] {
  const bySimilarity = new Map(
    input.vector.map((v) => [v.chunkId, v.similarity]),
  );
  const vectorList = input.vector
    .filter((v) => v.similarity >= input.minSimilarity)
    .sort((a, b) => b.similarity - a.similarity);
  const keywordList = input.keyword.filter((k) =>
    isKeywordEvidence(k.content, input.query),
  );

  const merged = new Map<string, RetrievedChunk>();
  const add = (c: CandidateChunk, rank: number, list: "vector" | "keyword") => {
    const existing = merged.get(c.chunkId);
    const base: RetrievedChunk = existing ?? {
      ...c,
      similarity: bySimilarity.get(c.chunkId) ?? null,
      vectorRank: null,
      keywordRank: null,
      source: list,
      score: 0,
    };
    base.score += 1 / (RRF_K + rank);
    if (list === "vector") base.vectorRank = rank;
    else base.keywordRank = rank;
    if (existing && existing.source !== list) base.source = "both";
    merged.set(c.chunkId, base);
  };
  vectorList.forEach((c, i) => add(c, i + 1, "vector"));
  keywordList.forEach((c, i) => add(c, i + 1, "keyword"));

  return [...merged.values()]
    .sort(
      (a, b) =>
        b.score - a.score || (b.similarity ?? -1) - (a.similarity ?? -1),
    )
    .slice(0, input.topK);
}

export interface Citation {
  entryId: string;
  entryDate: string | null;
  entryTitle: string | null;
  /** From the entry's best-ranked chunk, without its date line. */
  snippet: string;
}

const SNIPPET_LENGTH = 140;

/** One citation per entry, in relevance order (best chunk decides). Only
 * ever built from the chunks that were actually given to the model. */
export function citationsFor(chunks: RetrievedChunk[]): Citation[] {
  const seen = new Map<string, Citation>();
  for (const c of chunks) {
    if (seen.has(c.entryId)) continue;
    const body = c.content.replace(/^Date: [^\n]*\n\n/, "").trim();
    seen.set(c.entryId, {
      entryId: c.entryId,
      entryDate: c.entryDate,
      entryTitle: c.entryTitle,
      snippet:
        body.length > SNIPPET_LENGTH
          ? `${body.slice(0, SNIPPET_LENGTH - 1).trimEnd()}…`
          : body,
    });
  }
  return [...seen.values()];
}
