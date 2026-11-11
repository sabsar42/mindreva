-- Suggested calendar events found in entries. RLS scoped exactly like
-- entry_tasks (migration 0007): a join through entries on user_id, plus an
-- explicit Data API grant since "automatically expose new tables" is off
-- (see migration 0001).

ALTER TABLE "entry_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "entry_events_all_own" ON "entry_events"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = entry_events.entry_id AND e.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = entry_events.entry_id AND e.user_id = (SELECT auth.uid()))
  );
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "entry_events" TO authenticated;
