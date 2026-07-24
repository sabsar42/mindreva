-- Private bucket for voice recordings. Objects are stored under
-- "{userId}/{entryId}.{ext}", and RLS on storage.objects restricts access to
-- the folder matching the caller's own auth.uid() — the same per-user
-- isolation guarantee as every table in this schema.

INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', false)
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

CREATE POLICY "recordings_bucket_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
--> statement-breakpoint

CREATE POLICY "recordings_bucket_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
--> statement-breakpoint

CREATE POLICY "recordings_bucket_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
