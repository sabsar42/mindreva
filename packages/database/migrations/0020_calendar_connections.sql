-- 2026-10-23 — Google Calendar connections (read-only integration).
-- Additive and idempotent: safe to re-run; touches no existing table.
--
-- ROLLBACK (removes every stored calendar connection; revoke tokens with
-- Google first via the app's Disconnect if you want them invalidated):
--   DROP TABLE IF EXISTS "calendar_connections";
--
-- Tokens are encrypted by the app (AES-256-GCM, CALENDAR_TOKEN_KEY) before
-- they are stored. RLS is enabled with NO policies and no grants for the
-- API roles, so the Supabase Data API can never read this table; only the
-- server's own database connection (table owner) uses it.
CREATE TABLE IF NOT EXISTS "calendar_connections" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'google' NOT NULL,
	"account_email" text,
	"refresh_token_enc" text NOT NULL,
	"scopes" text NOT NULL,
	"selected_calendar_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_connections_status_check"
		CHECK ("status" IN ('connected', 'needs_reconnect'))
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_profiles_id_fk"
		FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "calendar_connections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "calendar_connections" FROM anon, authenticated;
