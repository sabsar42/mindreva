/**
 * Google Calendar API v3. Small and dependency-free: a fetch wrapper with
 * retry + backoff for rate limits and server errors, pure mappers to
 * Mindreva's own event shape, and one write (creating an event the user chose
 * to add). Tested without the network.
 */
import { addDays } from "../../day-key";

const API = "https://www.googleapis.com/calendar/v3";

export interface CalendarListItem {
  id: string;
  name: string;
  primary: boolean;
  color: string | null;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  /** ISO instant for timed events; "YYYY-MM-DD" for all-day events. */
  start: string;
  end: string;
  allDay: boolean;
}

/** Thrown for 403 on a write: the connection lacks the events permission. */
export class GoogleForbiddenError extends Error {
  constructor() {
    super("Google says this connection can't create events");
    this.name = "GoogleForbiddenError";
  }
}

/** Thrown for 401: the access token is no good (refresh, then reconnect). */
export class GoogleUnauthorizedError extends Error {
  constructor() {
    super("Google rejected the access token");
    this.name = "GoogleUnauthorizedError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with up to 2 retries on 429/5xx (Retry-After honoured, capped). */
export async function googleGet<T>(
  path: string,
  params: Record<string, string>,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
  delays: number[] = [400, 1200],
): Promise<T> {
  const url = `${API}${path}?${new URLSearchParams(params)}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 401) throw new GoogleUnauthorizedError();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= delays.length) {
      throw new Error(`Google Calendar request failed (${res.status})`);
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 3000)
        : delays[attempt]!,
    );
  }
}

interface RawCalendar {
  id?: string;
  summary?: string;
  summaryOverride?: string;
  primary?: boolean;
  backgroundColor?: string;
  hidden?: boolean;
}

export function mapCalendars(
  items: RawCalendar[] | undefined,
): CalendarListItem[] {
  return (items ?? [])
    .filter((c) => c.id && !c.hidden)
    .map((c) => ({
      id: c.id!,
      name: c.summaryOverride || c.summary || "Calendar",
      primary: Boolean(c.primary),
      color: c.backgroundColor ?? null,
    }))
    .sort(
      (a, b) =>
        Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name),
    );
}

interface RawEvent {
  id?: string;
  status?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

/**
 * Google's events → ours. Cancelled events and events without a start are
 * dropped; untitled events say so; all-day events keep their date keys
 * (their end date is exclusive in Google's model, kept as-is).
 */
export function mapEvents(
  calendarId: string,
  items: RawEvent[] | undefined,
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const e of items ?? []) {
    if (!e.id || e.status === "cancelled") continue;
    const allDay = Boolean(e.start?.date && !e.start?.dateTime);
    const start = e.start?.dateTime ?? e.start?.date;
    const end = e.end?.dateTime ?? e.end?.date ?? start;
    if (!start || !end) continue;
    out.push({
      id: e.id,
      calendarId,
      title: e.summary?.trim() || "(No title)",
      start,
      end,
      allDay,
    });
  }
  return out;
}

/** All-day first, then by start time. */
export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) =>
    a.allDay !== b.allDay
      ? Number(b.allDay) - Number(a.allDay)
      : a.start.localeCompare(b.start),
  );
}

export async function listCalendars(
  accessToken: string,
  fetchImpl?: typeof fetch,
): Promise<CalendarListItem[]> {
  const data = await googleGet<{ items?: RawCalendar[] }>(
    "/users/me/calendarList",
    { minAccessRole: "reader", maxResults: "100" },
    accessToken,
    fetchImpl,
  );
  return mapCalendars(data.items);
}

/**
 * Events overlapping [timeMin, timeMax). singleEvents expands recurring
 * events into their occurrences; timeZone makes all-day handling match the
 * user's own days.
 */
export async function listEvents(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
  timeZone: string,
  fetchImpl?: typeof fetch,
): Promise<CalendarEvent[]> {
  const data = await googleGet<{ items?: RawEvent[] }>(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
      fields: "items(id,status,summary,start,end)",
    },
    accessToken,
    fetchImpl,
  );
  return mapEvents(calendarId, data.items);
}

export interface NewCalendarEvent {
  title: string;
  /** "YYYY-MM-DD" */
  startDate: string;
  /** "HH:MM" in `zone`, or null for an all-day event. */
  startTime: string | null;
}

/**
 * The Google event body for a suggestion. Timed events last an hour and carry
 * the user's own time zone, so "3pm" means 3pm where they are. All-day events
 * end on the next date (Google's end date is exclusive).
 */
export function buildEventBody(ev: NewCalendarEvent, zone: string) {
  const base = {
    summary: ev.title,
    description: "Added from your Mindreva journal.",
  };
  if (!ev.startTime) {
    return {
      ...base,
      start: { date: ev.startDate },
      end: { date: addDays(ev.startDate, 1) },
    };
  }
  const [y, m, d] = ev.startDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [h, min] = ev.startTime.split(":").map(Number) as [number, number];
  const end = new Date(Date.UTC(y, m - 1, d, h + 1, min))
    .toISOString()
    .slice(0, 19);
  return {
    ...base,
    start: { dateTime: `${ev.startDate}T${ev.startTime}:00`, timeZone: zone },
    end: { dateTime: end, timeZone: zone },
  };
}

/**
 * Creates an event on the calendar. `eventId` is chosen by us (lowercase hex),
 * so tapping twice, or a retry, can't create a duplicate: Google answers 409
 * and that counts as already added.
 */
export async function insertEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  body: ReturnType<typeof buildEventBody>,
  fetchImpl: typeof fetch = fetch,
): Promise<"created" | "exists"> {
  const res = await fetchImpl(
    `${API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: eventId, ...body }),
      cache: "no-store",
    },
  );
  if (res.ok) return "created";
  if (res.status === 409) return "exists";
  if (res.status === 401) throw new GoogleUnauthorizedError();
  if (res.status === 403) throw new GoogleForbiddenError();
  throw new Error(`Google Calendar request failed (${res.status})`);
}
