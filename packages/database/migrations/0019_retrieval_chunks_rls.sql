-- 2026-10-22 — HNSW index and RLS for entry_chunks / embedding_jobs (created
-- in 0018). Idempotent: safe to re-run.
--
-- ROLLBACK:
--   DROP INDEX IF EXISTS "entry_chunks_embedding_hnsw_idx";
--   DROP POLICY IF EXISTS "entry_chunks_select_own" ON "entry_chunks";
--   DROP POLICY IF EXISTS "embedding_jobs_select_own" ON "embedding_jobs";
-- (RLS itself should stay enabled; see CLAUDE.md.)

-- Vector index on the SAME expression the search orders by:
--   ORDER BY (embedding::halfvec(2048)) <=> (query::halfvec(2048))
-- pgvector's HNSW caps plain `vector` at 2000 dims; halfvec allows 4000. The
-- planner only uses this index when the query casts both sides identically
-- (see ChunksRepository.searchVector).
CREATE INDEX IF NOT EXISTS "entry_chunks_embedding_hnsw_idx"
  ON "entry_chunks" USING hnsw ((embedding::halfvec(2048)) halfvec_cosine_ops);
--> statement-breakpoint

-- Owner-only reads. Writes happen server-side through the repositories
-- (service role), so authenticated users get SELECT and nothing else.
ALTER TABLE "entry_chunks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "entry_chunks_select_own" ON "entry_chunks";
--> statement-breakpoint
CREATE POLICY "entry_chunks_select_own" ON "entry_chunks"
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
--> statement-breakpoint
GRANT SELECT ON "entry_chunks" TO authenticated;
--> statement-breakpoint

ALTER TABLE "embedding_jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "embedding_jobs_select_own" ON "embedding_jobs";
--> statement-breakpoint
CREATE POLICY "embedding_jobs_select_own" ON "embedding_jobs"
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
--> statement-breakpoint
GRANT SELECT ON "embedding_jobs" TO authenticated;
