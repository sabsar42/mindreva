import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 * Reads/writes the session from Next's cookie store. Always create a fresh
 * client per request — never cache it in a module-level variable.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where setting cookies is not
            // allowed. Safe to ignore: the middleware refreshes the session.
          }
        },
      },
    },
  );
}

/** The subset of the authenticated user actually used anywhere in the app. */
export interface AuthenticatedUser {
  id: string;
  email?: string;
}

/**
 * Convenience: the authenticated user (verified via JWT signature), or null.
 *
 * Uses `getClaims()` rather than `getUser()`. `getUser()` always makes a
 * network round trip to Supabase's Auth server to verify the token; once the
 * Supabase project's JWT signing key is switched to an asymmetric algorithm
 * (ES256) in Dashboard -> Authentication -> JWT Keys, `getClaims()` instead
 * verifies the token's signature locally against a cached public key (JWKS)
 * — no network call at all. Until that switch happens (and until each
 * session naturally refreshes under the new key), tokens are still signed
 * with the legacy shared-secret algorithm (HS256); `getClaims()` detects
 * that from the JWT header and transparently falls back to calling
 * `getUser()` itself, so this is exactly as fast as before in that case,
 * never slower. That makes this change safe to ship independently of the
 * Dashboard switch — the round trip only actually disappears once both
 * sides are in place.
 *
 * Only `id` and `sub`/`email` are ever read from the result anywhere in this
 * app (confirmed by grep), so the normalized `{ id, email }` shape below is
 * a complete, safe replacement for the previous full Supabase `User` object
 * at every call site — no other call site needs to change.
 *
 * Wrapped in React's `cache()` so every call within the same request/render
 * — a page's own `requireUserId()`, plus every parallel service call it fans
 * out to (list entries, list dates, list day thumbnails, ...) — shares one
 * verification instead of doing one each. `cache()` is request-scoped in the
 * App Router (a fresh cache per request), so this never leaks a session
 * across users or requests.
 */
export const getUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  return { id: data.claims.sub, email: data.claims.email };
});
