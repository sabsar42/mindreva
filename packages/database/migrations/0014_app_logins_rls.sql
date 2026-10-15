-- RLS for app_logins (table created in 0013): the activity heatmap's
-- "visited" signal, one row per user per calendar day. Direct user_id column
-- (no join needed), same pattern as entries itself.

ALTER TABLE "app_logins" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "app_logins_select_own" ON "app_logins"
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
--> statement-breakpoint

CREATE POLICY "app_logins_insert_own" ON "app_logins"
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
--> statement-breakpoint

-- No update/delete policy: a login record is write-once per day (the
-- upsert is insert-if-missing), never edited or removed by the app.

GRANT SELECT, INSERT ON "app_logins" TO authenticated;
