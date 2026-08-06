CREATE TABLE "mindmap_cluster_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cluster_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mindmap_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"month" text NOT NULL,
	"entry_count" integer DEFAULT 0 NOT NULL,
	"color_index" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mindmap_cluster_entries" ADD CONSTRAINT "mindmap_cluster_entries_cluster_id_mindmap_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."mindmap_clusters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mindmap_cluster_entries" ADD CONSTRAINT "mindmap_cluster_entries_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mindmap_clusters" ADD CONSTRAINT "mindmap_clusters_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mindmap_cluster_entries_cluster_idx" ON "mindmap_cluster_entries" USING btree ("cluster_id");--> statement-breakpoint
CREATE INDEX "mindmap_clusters_user_idx" ON "mindmap_clusters" USING btree ("user_id","month");