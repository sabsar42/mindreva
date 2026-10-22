ALTER TABLE "entries" ADD COLUMN "summary_retry_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "summaries" ADD COLUMN "model" text;--> statement-breakpoint
CREATE INDEX "entries_summary_retry_idx" ON "entries" USING btree ("user_id","summary_retry_at") WHERE "entries"."summary_retry_at" is not null;