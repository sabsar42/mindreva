import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@mindreva/auth/server";
import { ProfilesRepository } from "@mindreva/database";

/**
 * OAuth / email-confirmation redirect target. Exchanges the code for a session,
 * then routes brand-new users (no languages set yet) into onboarding and
 * everyone else to their requested destination.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedRedirect = searchParams.get("redirectTo") ?? "/journal";

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in`);
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(error.message)}`,
    );
  }

  // First-time users go through onboarding; returning users go where they asked.
  let destination = requestedRedirect;
  try {
    const profile = data.user
      ? await ProfilesRepository.getById(data.user.id)
      : null;
    if (!profile?.languages) destination = "/onboarding/languages";
  } catch {
    // If the profile lookup fails, fall back to the requested destination.
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
