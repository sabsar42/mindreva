-- Photo attachments for entries. Mirrors the recordings pattern exactly:
-- RLS on the table via a join through entries (same as recordings_all_own in
-- migration 0001), a private Storage bucket with per-user-folder RLS (same
-- as the "recordings" bucket in migration 0002), and an explicit Data API
-- grant since "automatically expose new tables" is off (see migration 0001).

--------------------------------------------------------------------------------
-- 1. RLS on entry_photos.
--------------------------------------------------------------------------------
ALTER TABLE "entry_photos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "entry_photos_all_own" ON "entry_photos"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = entry_photos.entry_id AND e.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = entry_photos.entry_id AND e.user_id = (SELECT auth.uid()))
  );
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "entry_photos" TO authenticated;
--> statement-breakpoint

--------------------------------------------------------------------------------
-- 2. Private Storage bucket for photos, "{userId}/..." paths, same shape as
--    the "recordings" bucket.
--------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', false)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

CREATE POLICY "photos_bucket_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
--> statement-breakpoint

CREATE POLICY "photos_bucket_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
--> statement-breakpoint

CREATE POLICY "photos_bucket_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
