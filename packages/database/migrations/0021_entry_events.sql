CREATE TABLE "entry_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"title" text NOT NULL,
	"start_date" date NOT NULL,
	"start_time" text,
	"status" text DEFAULT 'suggested' NOT NULL,
	"google_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_events_status_check" CHECK ("entry_events"."status" in ('suggested','added','dismissed'))
);
--> statement-breakpoint
ALTER TABLE "entry_events" ADD CONSTRAINT "entry_events_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entry_events_entry_idx" ON "entry_events" USING btree ("entry_id");