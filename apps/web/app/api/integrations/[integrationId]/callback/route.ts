import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUser } from "@mindreva/auth/server";
import { completeMyIntegrationConnect } from "@/lib/services/integrations.service";
import { CalendarConnectError } from "@/lib/services/calendar.service";

/** Set by an entry that started the connect, so the user lands back on it. */
const AFTER_CONNECT_COOKIE = "mindreva_after_connect";
/** Only an entry page on this site is accepted, never a free-form URL. */
const ENTRY_RETURN = /^\/entries\/[0-9a-f-]{36}(\?addEvent=[0-9a-f-]{36})?$/i;

/**
 * OAuth redirect target, e.g. /api/integrations/google-calendar/callback
 * (this exact URL is the GOOGLE_REDIRECT_URI). Ends on the Connected apps
 * screen with a short result code the screen turns into a message, except
 * after a successful connect started from an entry, which returns to that
 * entry so its event can be added.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ integrationId: string }> },
) {
  const url = new URL(request.url);
  const back = (result: string) =>
    NextResponse.redirect(
      new URL(`/integrations?result=${encodeURIComponent(result)}`, url),
    );

  const jar = await cookies();
  let wanted = "";
  try {
    wanted = decodeURIComponent(jar.get(AFTER_CONNECT_COOKIE)?.value ?? "");
  } catch {
    wanted = "";
  }
  jar.delete(AFTER_CONNECT_COOKIE);
  const returnTo = ENTRY_RETURN.test(wanted) ? wanted : null;

  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/sign-in?redirectTo=/integrations", url),
    );
  }
  const { integrationId } = await params;
  try {
    await completeMyIntegrationConnect(integrationId, url.searchParams);
    if (returnTo) return NextResponse.redirect(new URL(returnTo, url));
    return back("connected");
  } catch (err) {
    if (err instanceof CalendarConnectError) return back(err.reason);
    // Never log the query string: it carries the authorization code.
    console.error("Integration callback failed:", (err as Error).name);
    return back("error");
  }
}
