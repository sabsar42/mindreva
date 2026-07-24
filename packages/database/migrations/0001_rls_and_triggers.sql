-- Mindreva: auth wiring, Row Level Security, and the vector index.
-- RLS is a NON-NEGOTIABLE. Every table below has it enabled with policies that
-- restrict a user to their own rows (directly via user_id, or via a join
-- through entries / chat_sessions for child tables). Never disable it.

--------------------------------------------------------------------------------
-- 1. profiles.id references auth.users, and a profile row is created
--    automatically whenever a new auth user signs up.
--------------------------------------------------------------------------------
ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_id_auth_users_fk"
  FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
--> statement-breakpoint

--------------------------------------------------------------------------------
-- 2. Enable RLS on every table.
--------------------------------------------------------------------------------
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "recordings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transcripts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "summaries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "embeddings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chat_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

--------------------------------------------------------------------------------
-- 3. profiles: a user can see and update only their own profile row.
--    (No INSERT policy — rows are created by the trigger above.)
--------------------------------------------------------------------------------
CREATE POLICY "profiles_select_own" ON "profiles"
  FOR SELECT USING ((SELECT auth.uid()) = id);--> statement-breakpoint
CREATE POLICY "profiles_update_own" ON "profiles"
  FOR UPDATE USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);--> statement-breakpoint

--------------------------------------------------------------------------------
-- 4. entries: full CRUD restricted to the owning user.
--------------------------------------------------------------------------------
CREATE POLICY "entries_select_own" ON "entries"
  FOR SELECT USING ((SELECT auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "entries_insert_own" ON "entries"
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "entries_update_own" ON "entries"
  FOR UPDATE USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "entries_delete_own" ON "entries"
  FOR DELETE USING ((SELECT auth.uid()) = user_id);--> statement-breakpoint

--------------------------------------------------------------------------------
-- 5. Child tables of entries: access allowed only when the parent entry
--    belongs to the current user.
--------------------------------------------------------------------------------
CREATE POLICY "recordings_all_own" ON "recordings"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = recordings.entry_id AND e.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = recordings.entry_id AND e.user_id = (SELECT auth.uid()))
  );--> statement-breakpoint

CREATE POLICY "transcripts_all_own" ON "transcripts"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = transcripts.entry_id AND e.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = transcripts.entry_id AND e.user_id = (SELECT auth.uid()))
  );--> statement-breakpoint

CREATE POLICY "summaries_all_own" ON "summaries"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = summaries.entry_id AND e.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = summaries.entry_id AND e.user_id = (SELECT auth.uid()))
  );--> statement-breakpoint

CREATE POLICY "embeddings_all_own" ON "embeddings"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = embeddings.entry_id AND e.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM entries e WHERE e.id = embeddings.entry_id AND e.user_id = (SELECT auth.uid()))
  );--> statement-breakpoint

--------------------------------------------------------------------------------
-- 6. chat_sessions (direct user_id) and chat_messages (via session).
--------------------------------------------------------------------------------
CREATE POLICY "chat_sessions_all_own" ON "chat_sessions"
  FOR ALL USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);--> statement-breakpoint

CREATE POLICY "chat_messages_all_own" ON "chat_messages"
  FOR ALL USING (
    EXISTS (SELECT 1 FROM chat_sessions s WHERE s.id = chat_messages.session_id AND s.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM chat_sessions s WHERE s.id = chat_messages.session_id AND s.user_id = (SELECT auth.uid()))
  );--> statement-breakpoint

--------------------------------------------------------------------------------
-- 7. Data API grants. With "automatically expose new tables" OFF, we grant the
--    exact privileges explicitly. The `authenticated` role can reach the tables
--    through the Data API (PostgREST); the RLS policies above still restrict it
--    to each user's own rows. We deliberately grant NOTHING to `anon` — nothing
--    here is public. The app itself uses Drizzle (service role) and bypasses all
--    of this; these grants exist for the Supabase client (e.g. the RLS test).
--------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "profiles" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "entries" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "recordings" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "transcripts" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "summaries" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "embeddings" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "chat_sessions" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "chat_messages" TO authenticated;--> statement-breakpoint

--------------------------------------------------------------------------------
-- 8. HNSW index for fast cosine-distance vector search (Phase 6 retrieval).
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "embeddings_embedding_hnsw_idx"
  ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);
