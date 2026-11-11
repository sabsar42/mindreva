import "server-only";
import { cookies } from "next/headers";
import { getUser } from "@mindreva/auth/server";
import {
  CalendarConnectionsRepository,
  EntryEventsRepository,
  type EntryEvent,
} from "@mindreva/database";
import {
  CALENDAR_EVENTS_SCOPE,
  getGoogleCalendarConfig,
} from "@/lib/integrations/google/config";
import { decryptToken, encryptToken } from "@/lib/integrations/google/crypto";
import {
  GoogleReauthRequiredError,
  buildAuthUrl,
  exchangeCode,
  randomUrlToken,
  refreshAccessToken,
  revokeToken,
} from "@/lib/integrations/google/oauth";
import {
  GoogleForbiddenError,
  GoogleUnauthorizedError,
  buildEventBody,
  insertEvent,
  listCalendars,
  listEvents,
  sortEvents,
  type CalendarEvent,
  type CalendarListItem,
} from "@/lib/integrations/google/calendar-api";
import { addDays, resolveTimeZone, startOfDayInZone } from "@/lib/day-key";
import { getMyProfile } from "./profile.service";

/**
 * Google Calendar: reads events to show beside entries, and creates an event
 * only when the user taps "Add to calendar" on a suggestion. Everything here runs on the server: tokens
 * are decrypted only in memory, never logged, never sent to a client.
 * Nothing in the app depends on it: when it isn't configured or connected,
 * callers get "disconnected" and hide calendar UI.
 */

export type CalendarStatus = "disconnected" | "connected" | "needs_reconnect";

/** Short-lived OAuth handshake cookie: "<state>.<pkce verifier>". */
const OAUTH_COOKIE = "mindreva_gcal_oauth";
/** Must cover both the connect call and the callback (/api/google-calendar/callback,
 * the redirect registered with Google), so it is the shared /api prefix. */
const OAUTH_COOKIE_PATH = "/api";
/** Longest event window one request may ask for. */
const MAX_RANGE_DAYS = 62;
const EVENTS_TTL_MS = 5 * 60 * 1000;

// Per-instance caches. Serverless instances come and go, so these are a
// latency win, never a source of truth.
const accessTokens = new Map<string, { token: string; expiresAt: number }>();
const eventCache = new Map<string, { at: number; events: CalendarEvent[] }>();

function forgetUser(userId: string) {
  accessTokens.delete(userId);
  for (const key of eventCache.keys()) {
    if (key.startsWith(`${userId}|`)) eventCache.delete(key);
  }
}

export function isCalendarConfigured(): boolean {
  return getGoogleCalendarConfig() !== null;
}

async function requireUserId(): Promise<string> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export class CalendarConnectError extends Error {
  constructor(
    readonly reason:
      "state" | "denied" | "scope" | "no_refresh_token" | "exchange",
  ) {
    super(`Calendar connect failed: ${reason}`);
    this.name = "CalendarConnectError";
  }
}

/* ---------------------------------------------------------------- */
/* Connect / disconnect                                               */
/* ---------------------------------------------------------------- */

/** Start OAuth: remember state + verifier in an httpOnly cookie, return Google's URL. */
export async function startCalendarConnect(): Promise<string> {
  const config = getGoogleCalendarConfig();
  if (!config) throw new Error("Calendar not configured");
  await requireUserId();
  const state = randomUrlToken();
  const verifier = randomUrlToken(48);
  (await cookies()).set(OAUTH_COOKIE, `${state}.${verifier}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: 600,
  });
  return buildAuthUrl(config, state, verifier);
}

/** Finish OAuth from Google's redirect. Throws CalendarConnectError. */
export async function completeCalendarConnect(
  params: URLSearchParams,
): Promise<void> {
  const config = getGoogleCalendarConfig();
  if (!config) throw new Error("Calendar not configured");
  const userId = await requireUserId();
  const jar = await cookies();
  const saved = jar.get(OAUTH_COOKIE)?.value ?? "";
  jar.delete({ name: OAUTH_COOKIE, path: OAUTH_COOKIE_PATH });

  if (params.get("error")) throw new CalendarConnectError("denied");
  const [state, verifier] = saved.split(".");
  const code = params.get("code");
  if (!state || !verifier || !code || params.get("state") !== state) {
    throw new CalendarConnectError("state");
  }

  let tokens;
  try {
    tokens = await exchangeCode(config, code, verifier);
  } catch {
    throw new CalendarConnectError("exchange");
  }
  // Granular consent lets people untick the calendar permission.
  if (!tokens.scope.includes("calendar.readonly")) {
    if (tokens.refreshToken) await revokeToken(tokens.refreshToken);
    throw new CalendarConnectError("scope");
  }
  if (!tokens.refreshToken) throw new CalendarConnectError("no_refresh_token");

  await CalendarConnectionsRepository.upsert({
    userId,
    accountEmail: tokens.email,
    refreshTokenEnc: encryptToken(tokens.refreshToken, config.tokenKey),
    scopes: tokens.scope,
  });
  forgetUser(userId);
  accessTokens.set(userId, {
    token: tokens.accessToken,
    expiresAt: tokens.expiresAt,
  });
}

/**
 * Revoke with Google (best effort) and delete the stored credentials. Used
 * by Disconnect and by account deletion.
 */
export async function disconnectCalendarForUser(userId: string): Promise<void> {
  const row = await CalendarConnectionsRepository.getForUser(userId);
  if (!row) return;
  const config = getGoogleCalendarConfig();
  if (config) {
    try {
      await revokeToken(decryptToken(row.refreshTokenEnc, config.tokenKey));
    } catch {
      // Undecryptable (rotated key): nothing to revoke; still delete.
    }
  }
  await CalendarConnectionsRepository.deleteForUser(userId);
  forgetUser(userId);
}

export async function disconnectMyCalendar(): Promise<void> {
  await disconnectCalendarForUser(await requireUserId());
}

/* ---------------------------------------------------------------- */
/* Status, calendars, events                                          */
/* ---------------------------------------------------------------- */

export async function getCalendarStatusForUser(userId: string): Promise<{
  status: CalendarStatus;
  email: string | null;
  connectedAt: string | null;
  /** Connected AND allowed to create events (an older, read-only connection
   * isn't: it needs one more tap through Google's consent screen). */
  canAddEvents: boolean;
}> {
  const none = {
    status: "disconnected" as const,
    email: null,
    connectedAt: null,
    canAddEvents: false,
  };
  if (!isCalendarConfigured()) return none;
  const row = await CalendarConnectionsRepository.getForUser(userId);
  if (!row) return none;
  return {
    status: row.status,
    email: row.accountEmail,
    connectedAt: row.createdAt.toISOString(),
    canAddEvents:
      row.status === "connected" && row.scopes.includes(CALENDAR_EVENTS_SCOPE),
  };
}

export async function getMyCalendarStatus() {
  return getCalendarStatusForUser(await requireUserId());
}

/** A valid access token, refreshing if needed; marks the row on revocation. */
async function accessTokenFor(userId: string): Promise<string | null> {
  const config = getGoogleCalendarConfig();
  if (!config) return null;
  const cached = accessTokens.get(userId);
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;

  const row = await CalendarConnectionsRepository.getForUser(userId);
  if (!row || row.status !== "connected") return null;
  try {
    const tokens = await refreshAccessToken(
      config,
      decryptToken(row.refreshTokenEnc, config.tokenKey),
    );
    accessTokens.set(userId, {
      token: tokens.accessToken,
      expiresAt: tokens.expiresAt,
    });
    return tokens.accessToken;
  } catch (err) {
    if (err instanceof GoogleReauthRequiredError) {
      await CalendarConnectionsRepository.setStatus(userId, "needs_reconnect");
      forgetUser(userId);
      return null;
    }
    throw err;
  }
}

/** Retry once with a fresh token if Google says the cached one is bad. */
async function withToken<T>(
  userId: string,
  run: (token: string) => Promise<T>,
): Promise<T | null> {
  const token = await accessTokenFor(userId);
  if (!token) return null;
  try {
    return await run(token);
  } catch (err) {
    if (!(err instanceof GoogleUnauthorizedError)) throw err;
    accessTokens.delete(userId);
    const fresh = await accessTokenFor(userId);
    return fresh ? run(fresh) : null;
  }
}

export async function listMyCalendars(): Promise<
  (CalendarListItem & { selected: boolean })[] | null
> {
  const userId = await requireUserId();
  const row = await CalendarConnectionsRepository.getForUser(userId);
  if (!row) return null;
  const calendars = await withToken(userId, (t) => listCalendars(t));
  if (!calendars) return null;
  const selected = new Set(row.selectedCalendarIds);
  return calendars.map((c) => ({
    ...c,
    selected: selected.size === 0 ? c.primary : selected.has(c.id),
  }));
}

export async function setMyCalendars(ids: string[]): Promise<void> {
  const userId = await requireUserId();
  const clean = [
    ...new Set(ids.filter((id) => typeof id === "string" && id.length < 300)),
  ].slice(0, 50);
  await CalendarConnectionsRepository.setSelectedCalendars(userId, clean);
  forgetUser(userId);
}

export const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Events overlapping the user's local days [startKey, endKey] (inclusive),
 * from the selected calendars. Never throws for calendar trouble: returns
 * the status and whatever could be read, so callers can render without it.
 */
export async function getMyCalendarEvents(
  startKey: string,
  endKey: string,
): Promise<{ status: CalendarStatus; events: CalendarEvent[] }> {
  const userId = await requireUserId();
  const { status } = await getCalendarStatusForUser(userId);
  if (status !== "connected") return { status, events: [] };
  if (!DATE_KEY.test(startKey) || !DATE_KEY.test(endKey) || endKey < startKey) {
    return { status, events: [] };
  }
  if (addDays(startKey, MAX_RANGE_DAYS) < endKey)
    endKey = addDays(startKey, MAX_RANGE_DAYS);

  const row = await CalendarConnectionsRepository.getForUser(userId);
  const profile = await getMyProfile();
  const zone = resolveTimeZone(profile?.timezone);
  const ids = row?.selectedCalendarIds.length
    ? row.selectedCalendarIds
    : ["primary"];
  const cacheKey = `${userId}|${startKey}|${endKey}|${zone}|${ids.join(",")}`;
  const hit = eventCache.get(cacheKey);
  if (hit && Date.now() - hit.at < EVENTS_TTL_MS) {
    return { status, events: hit.events };
  }

  const timeMin = startOfDayInZone(startKey, zone);
  const timeMax = startOfDayInZone(addDays(endKey, 1), zone);
  try {
    const lists = await withToken(userId, (token) =>
      Promise.allSettled(
        ids.map((id) => listEvents(token, id, timeMin, timeMax, zone)),
      ),
    );
    if (!lists) {
      const now = await getCalendarStatusForUser(userId);
      return { status: now.status, events: [] };
    }
    const events = sortEvents(
      lists.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
    );
    eventCache.set(cacheKey, { at: Date.now(), events });
    return { status, events };
  } catch {
    // Google down or rate-limited past our retries: the app carries on.
    return { status, events: hit?.events ?? [] };
  }
}

/* ---------------------------------------------------------------- */
/* Adding a suggested event                                           */
/* ---------------------------------------------------------------- */

export type AddEventResult =
  | { result: "added"; event: EntryEvent }
  /** Not connected, or connected without the events permission: the caller
   * sends the user through Google's consent and then retries. */
  | { result: "needs_permission" }
  | { result: "failed" }
  | { result: "not_found" };

/** A stable Google event id for one suggestion: the row's uuid as lowercase
 * hex, which is valid for Google, so a double tap can't make two events. */
function googleEventIdFor(eventRowId: string): string {
  return eventRowId.replace(/-/g, "").toLowerCase();
}

/**
 * Adds one suggested event to the user's primary calendar. The user's own tap
 * is the only trigger. Idempotent: adding an already-added event just reports
 * it as added.
 */
export async function addMyEventToCalendar(
  eventId: string,
): Promise<AddEventResult> {
  const userId = await requireUserId();
  const event = await EntryEventsRepository.getOwned(eventId, userId);
  if (!event) return { result: "not_found" };
  if (event.status === "added") return { result: "added", event };

  const { canAddEvents } = await getCalendarStatusForUser(userId);
  if (!canAddEvents) return { result: "needs_permission" };

  const profile = await getMyProfile();
  const zone = resolveTimeZone(profile?.timezone);
  const googleId = googleEventIdFor(event.id);
  try {
    const outcome = await withToken(userId, (token) =>
      insertEvent(
        token,
        "primary",
        googleId,
        buildEventBody(
          {
            title: event.title,
            startDate: event.startDate,
            startTime: event.startTime,
          },
          zone,
        ),
      ),
    );
    if (!outcome) return { result: "needs_permission" };
  } catch (err) {
    if (err instanceof GoogleForbiddenError)
      return { result: "needs_permission" };
    console.error("Adding a calendar event failed:", (err as Error).name);
    return { result: "failed" };
  }
  forgetUser(userId);
  const updated = await EntryEventsRepository.setStatus(
    event.id,
    userId,
    "added",
    googleId,
  );
  return updated ? { result: "added", event: updated } : { result: "failed" };
}

/** The entry's event suggestions (dismissed ones hidden) and what the calendar
 * can do right now, so the entry screen knows which button to show. */
export async function listMyEntryEvents(entryId: string): Promise<{
  configured: boolean;
  status: CalendarStatus;
  canAddEvents: boolean;
  events: EntryEvent[];
}> {
  const userId = await requireUserId();
  const configured = isCalendarConfigured();
  if (!configured) {
    return {
      configured,
      status: "disconnected",
      canAddEvents: false,
      events: [],
    };
  }
  const [{ status, canAddEvents }, all] = await Promise.all([
    getCalendarStatusForUser(userId),
    EntryEventsRepository.listByEntry(entryId, userId),
  ]);
  return {
    configured,
    status,
    canAddEvents,
    events: all.filter((e) => e.status !== "dismissed"),
  };
}

export async function dismissMyEvent(eventId: string): Promise<boolean> {
  const userId = await requireUserId();
  return (
    (await EntryEventsRepository.setStatus(eventId, userId, "dismissed")) !==
    null
  );
}
