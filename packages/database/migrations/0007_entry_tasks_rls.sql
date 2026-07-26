-- Extracted task checklist items for entries. RLS scoped the same way as
-- entry_photos (migration 0005): a join through entries on user_id, plus an
-- explicit Data API grant since "automatically expose new tables" is off
-- (see migration 0001). No Storage bucket needed — this table has no files.

ALTER TABLE "entry_tasks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "entry_tasks_all_own" ON "entry_tasks"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = entry_tasks.entry_id AND e.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = entry_tasks.entry_id AND e.user_id = (SELECT auth.uid()))
  );
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "entry_tasks" TO authenticated;
