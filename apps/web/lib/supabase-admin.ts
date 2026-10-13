import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * A service-role Supabase client, or null when the deployment doesn't have the
 * credentials. SERVER ONLY, and used for exactly one thing: signing Storage URLs
 * for images in a shared journal, because the person viewing a share link has no
 * session of their own and the "photos" bucket is private (RLS by user folder).
 *
 * It bypasses RLS, so it must only ever be handed paths the caller has already
 * proven belong to a share the viewer is allowed to read (see
 * shares.service.ts). Never expose it to a client component.
 */
export function createAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
