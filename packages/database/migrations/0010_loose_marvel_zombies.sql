CREATE TABLE "entry_share_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_id" uuid NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_share_recipients_unique" UNIQUE("share_id","email")
);
--> statement-breakpoint
CREATE TABLE "entry_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"token" text NOT NULL,
	"visibility" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_shares_entry_unique" UNIQUE("entry_id"),
	CONSTRAINT "entry_shares_token_unique" UNIQUE("token"),
	CONSTRAINT "entry_shares_visibility_check" CHECK ("entry_shares"."visibility" in ('public','private'))
);
--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "persona_half" smallint;--> statement-breakpoint
ALTER TABLE "entry_photos" ADD COLUMN "kind" text DEFAULT 'cover' NOT NULL;--> statement-breakpoint
ALTER TABLE "transcripts" ADD COLUMN "segments" jsonb;--> statement-breakpoint
ALTER TABLE "entry_share_recipients" ADD CONSTRAINT "entry_share_recipients_share_id_entry_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."entry_shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_shares" ADD CONSTRAINT "entry_shares_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_half_check" CHECK ("chat_sessions"."persona_half" is null or "chat_sessions"."persona_half" in (1,2));--> statement-breakpoint
ALTER TABLE "entry_photos" ADD CONSTRAINT "entry_photos_kind_check" CHECK ("entry_photos"."kind" in ('cover','inline'));