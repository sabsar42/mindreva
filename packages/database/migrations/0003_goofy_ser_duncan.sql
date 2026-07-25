-- The HNSW index was built against the old vector(768) dimension (added by
-- hand in migration 0001, so drizzle-kit doesn't know about it) and must be
-- dropped before the column type change and rebuilt after. The embeddings
-- table has no rows yet (confirmed before generating this migration), so this
-- is a straight type change with no backfill/cast concerns.
DROP INDEX IF EXISTS "embeddings_embedding_hnsw_idx";
--> statement-breakpoint
ALTER TABLE "embeddings" ALTER COLUMN "embedding" SET DATA TYPE vector(2048);
--> statement-breakpoint
-- pgvector's HNSW index has a hard 2000-dimension cap — 2048 exceeds it
-- (a real pgvector constraint, discovered when the plain vector_cosine_ops
-- version of this index failed with "column cannot have more than 2000
-- dimensions for hnsw index"). The documented fix for high-dimension vectors
-- is a halfvec expression index: it doubles the indexable ceiling to 4000 by
-- indexing a half-precision cast, while the column itself stays full-precision
-- vector(2048) for storage. Whoever implements Phase 6's matchEntries query
-- must cast the query vector to ::halfvec(2048) too — the planner only uses
-- an expression index when the query expression matches it syntactically.
CREATE INDEX "embeddings_embedding_hnsw_idx"
  ON "embeddings" USING hnsw ((embedding::halfvec(2048)) halfvec_cosine_ops);