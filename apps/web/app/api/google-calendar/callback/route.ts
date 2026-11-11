import { GET as integrationCallback } from "../../integrations/[integrationId]/callback/route";

/**
 * The redirect URI registered on the Google OAuth client is
 * /api/google-calendar/callback. The shared handler lives under
 * /api/integrations/[integrationId]/callback, so this path just hands it the
 * Google Calendar id. GOOGLE_REDIRECT_URI must be this URL.
 */
export function GET(request: Request) {
  return integrationCallback(request, {
    params: Promise.resolve({ integrationId: "google-calendar" }),
  });
}
