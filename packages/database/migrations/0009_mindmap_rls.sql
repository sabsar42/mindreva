-- RLS for the mindmap tables (migration 0008). Two different scoping shapes:
--
--   mindmap_clusters       owns user_id directly, so it scopes like
--                          chat_sessions: a straight user_id = auth.uid().
--   mindmap_cluster_entries has no user_id, so it scopes through its parent
--                          cluster, the same join-through pattern used by
--                          entry_photos (0005) and entry_tasks (0007).
--
-- Both need an explicit Data API grant because "automatically expose new
-- tables" is off (see migration 0001).

ALTER TABLE "mindmap_clusters" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "mindmap_clusters_all_own" ON "mindmap_clusters"
  FOR ALL USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "mindmap_clusters" TO authenticated;
--> statement-breakpoint

ALTER TABLE "mindmap_cluster_entries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "mindmap_cluster_entries_all_own" ON "mindmap_cluster_entries"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM mindmap_clusters c
      WHERE c.id = mindmap_cluster_entries.cluster_id
        AND c.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM mindmap_clusters c
      WHERE c.id = mindmap_cluster_entries.cluster_id
        AND c.user_id = (SELECT auth.uid())
    )
  );
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "mindmap_cluster_entries" TO authenticated;
