import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { completeMyIntegrationConnect } from "@/lib/services/integrations.service";
import { CalendarConnectError } from "@/lib/services/calendar.service";

/**
 * OAuth redirect target, e.g. /api/integrations/google-calendar/callback
 * (this exact URL is the GOOGLE_REDIRECT_URI). Always ends on the Connected
 * apps screen with a short result code the screen turns into a message.
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

  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/sign-in?redirectTo=/integrations", url),
    );
  }
  const { integrationId } = await params;
  try {
    await completeMyIntegrationConnect(integrationId, url.searchParams);
    return back("connected");
  } catch (err) {
    if (err instanceof CalendarConnectError) return back(err.reason);
    // Never log the query string: it carries the authorization code.
    console.error("Integration callback failed:", (err as Error).name);
    return back("error");
  }
}
