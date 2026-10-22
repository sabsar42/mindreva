-- 2026-10-22 — Retrieval chunks + embedding retry queue (Phase 1, workstream A).
-- Additive only: two new tables and one new profiles column. Nothing existing
-- is altered or dropped; the old per-entry `embeddings` table stays (the
-- mindmap still reads it). Idempotent: safe to re-run.
--
-- ROLLBACK (only if nothing depends on these yet; destroys chunk data, which
-- is fully re-creatable by re-running the embedding backfill):
--   DROP TABLE IF EXISTS "entry_chunks";
--   DROP TABLE IF EXISTS "embedding_jobs";
--   ALTER TABLE "profiles" DROP COLUMN IF EXISTS "embedding_calls_today";
-- and remove the 0018/0019 rows from drizzle.__drizzle_migrations.

CREATE TABLE IF NOT EXISTS "embedding_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "embedding_jobs_entry_unique" UNIQUE("entry_id"),
	CONSTRAINT "embedding_jobs_status_check" CHECK ("embedding_jobs"."status" in ('pending','processing','done','failed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entry_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer NOT NULL,
	"entry_date" date,
	"content_hash" text NOT NULL,
	"embedding" vector(2048) NOT NULL,
	"content_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_chunks_entry_chunk_unique" UNIQUE("entry_id","chunk_index")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "embedding_calls_today" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'embedding_jobs_user_id_profiles_id_fk') THEN
    ALTER TABLE "embedding_jobs" ADD CONSTRAINT "embedding_jobs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'embedding_jobs_entry_id_entries_id_fk') THEN
    ALTER TABLE "embedding_jobs" ADD CONSTRAINT "embedding_jobs_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entry_chunks_user_id_profiles_id_fk') THEN
    ALTER TABLE "entry_chunks" ADD CONSTRAINT "entry_chunks_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'entry_chunks_entry_id_entries_id_fk') THEN
    ALTER TABLE "entry_chunks" ADD CONSTRAINT "entry_chunks_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "embedding_jobs_due_idx" ON "embedding_jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entry_chunks_user_date_idx" ON "entry_chunks" USING btree ("user_id","entry_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entry_chunks_tsv_idx" ON "entry_chunks" USING gin ("content_tsv");