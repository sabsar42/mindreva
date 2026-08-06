import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every request and returns both the response
 * (with any refreshed auth cookies) and whether a valid user session exists.
 * The app's own middleware decides redirects based on `user` and the
 * requested path.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: { id: string } | null }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do NOT run code between createServerClient and getClaims — it must be
  // the first call so the session is validated and cookies are refreshed.
  //
  // getClaims() verifies the token's signature locally (no network call)
  // once the Supabase project's JWT signing key is asymmetric (ES256, set
  // in Dashboard -> Authentication -> JWT Keys); until that switch, it
  // detects the legacy HS256 signature and transparently falls back to the
  // same network round trip getUser() always made, so this is safe to ship
  // ahead of that Dashboard change. See packages/auth/src/server.ts's
  // getUser() for the same mechanism and the full explanation.
  const { data, error } = await supabase.auth.getClaims();
  const user = !error && data ? { id: data.claims.sub } : null;

  return { response, user };
}
