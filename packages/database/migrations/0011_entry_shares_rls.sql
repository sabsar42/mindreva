-- RLS for entry sharing (tables created in 0010). Same shape as entry_photos
-- (migration 0005): the table is scoped to the entry's owner by a join through
-- entries, plus an explicit Data API grant since "automatically expose new
-- tables" is off (see migration 0001).
--
-- NOTE on public/private link reads: a person opening a share link is NOT the
-- owner, so these owner-only policies deliberately do not let them read the
-- table through the Data API. Resolving a link happens in the server
-- (EntrySharesRepository.getByToken), which checks the token, revocation,
-- visibility and recipient list itself. Nothing here widens read access.

--------------------------------------------------------------------------------
-- 1. entry_shares: owner-only, via the entry's user_id.
--------------------------------------------------------------------------------
ALTER TABLE "entry_shares" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "entry_shares_all_own" ON "entry_shares"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = entry_shares.entry_id AND e.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = entry_shares.entry_id AND e.user_id = (SELECT auth.uid()))
  );
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "entry_shares" TO authenticated;
--> statement-breakpoint

--------------------------------------------------------------------------------
-- 2. entry_share_recipients: owner-only, via share -> entry.
--------------------------------------------------------------------------------
ALTER TABLE "entry_share_recipients" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "entry_share_recipients_all_own" ON "entry_share_recipients"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entry_shares s
      JOIN entries e ON e.id = s.entry_id
      WHERE s.id = entry_share_recipients.share_id AND e.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entry_shares s
      JOIN entries e ON e.id = s.entry_id
      WHERE s.id = entry_share_recipients.share_id AND e.user_id = (SELECT auth.uid())
    )
  );
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "entry_share_recipients" TO authenticated;
