import { parseKey } from "./crypto";

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenKey: Buffer;
}

/** Reading calendars, plus the account email for the label. */
export const CALENDAR_READ_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly";

/** Creating events the user taps "Add to calendar" on. Narrower than full
 * calendar access: it can't change calendar settings or sharing. */
export const CALENDAR_EVENTS_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  CALENDAR_READ_SCOPE,
  CALENDAR_EVENTS_SCOPE,
] as const;

/**
 * The integration is on only when every setting is present and valid. With
 * anything missing, isConfigured() is false and all calendar UI is hidden.
 * Server-only values: none of these are NEXT_PUBLIC_, so they never reach a
 * client bundle.
 */
export function getGoogleCalendarConfig(
  env: NodeJS.ProcessEnv = process.env,
): GoogleCalendarConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = env.GOOGLE_REDIRECT_URI?.trim();
  const tokenKey = parseKey(env.CALENDAR_TOKEN_KEY?.trim());
  if (!clientId || !clientSecret || !redirectUri || !tokenKey) return null;
  try {
    const url = new URL(redirectUri);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !local) return null;
  } catch {
    return null;
  }
  return { clientId, clientSecret, redirectUri, tokenKey };
}
