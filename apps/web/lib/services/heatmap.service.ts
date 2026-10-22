import "server-only";
import {
  AppLoginsRepository,
  EntriesRepository,
  ProfilesRepository,
  type EntryType,
} from "@mindreva/database";
import { getUser } from "@mindreva/auth/server";
import { addDays, dayKeyInZone, resolveTimeZone } from "../day-key";
import { getMyProfile, getMyToday } from "./profile.service";
import { timed } from "../timing";
import {
  listMyEntries,
  type EntryListItemWithThumbnail,
} from "./entries.service";

/**
 * Activity-heatmap data: a two-tier "did you show up" signal per calendar
 * day — visited (opened the app that day) and recorded (also wrote at least
 * one entry that day) — used by both the compact monthly grid and the
 * full-year grid, a reliable streak derived from the same data, and the
 * inline per-day detail panel's entries.
 *
 * "Visited" is new storage (app_logins, one row per user per day). "Recorded"
 * still reads `entries.entry_date`, the same column the old CalendarPicker's
 * dots and day-thumbnails already used — no change there.
 */

async function requireUserId(): Promise<string> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

/**
 * Records today as a visited day for the current user, once per calendar
 * day (insert-if-missing). Called once per navigation into the protected
 * app shell via next/server's after() — fire-and-forget: a failure here
 * never blocks or breaks a page render. The whole body is one try/catch,
 * not just the repository write: during `next build`'s static-page-data
 * probing pass, getUser() itself can throw (it reads cookies(), which isn't
 * available outside a real request), and that throw happens inside the
 * after() callback where Next only logs it — so an unguarded getUser() call
 * here would print a build-time error on every route for no reason.
 */
export async function recordMyVisit(): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;
    // Until the browser has reported a zone we don't know which day "today"
    // is; syncMyTimeZone records this visit once it does.
    const profile = await getMyProfile();
    if (!profile?.timezoneSyncedAt) return;
    await AppLoginsRepository.recordVisit(user.id, await getMyToday());
  } catch {
    // Non-fatal: at worst, today's cell falls back to "not visited" until
    // the next successful call records it.
  }
}

/**
 * Saves the browser's time zone and records today's visit in it. The first
 * sync also re-cuts the user's existing days into the zone (see
 * ProfilesRepository.syncTimezone); later syncs only update the zone.
 */
export async function syncMyTimeZone(timezone: string): Promise<void> {
  const userId = await requireUserId();
  const tz = resolveTimeZone(timezone);
  const profile = await getMyProfile();
  if (profile?.timezone !== tz || !profile?.timezoneSyncedAt) {
    await ProfilesRepository.syncTimezone(userId, tz);
  }
  await AppLoginsRepository.recordVisit(userId, dayKeyInZone(tz));
}

/** 0 = no activity, 1 = opened the app only, 2-4 = also recorded (1, 2,
 * 3+ entries). Showing up always counts; recording reads as a deeper shade
 * of the same colour rather than a separate scale. */
export type DayLevel = 0 | 1 | 2 | 3 | 4;

export interface DayCount {
  /** "YYYY-MM-DD" */
  date: string;
  /** Entries recorded that day (0 if only visited, never recorded). */
  count: number;
  visited: boolean;
  level: DayLevel;
}

function levelFor(visited: boolean, count: number): DayLevel {
  if (count >= 3) return 4;
  if (count === 2) return 3;
  if (count === 1) return 2;
  if (visited) return 1;
  return 0;
}

function mergeDayData(
  visitedDays: string[],
  entryCounts: { entryDate: string; count: number }[],
): Record<string, DayCount> {
  const out: Record<string, DayCount> = {};
  for (const day of visitedDays) {
    out[day] = { date: day, count: 0, visited: true, level: 1 };
  }
  for (const r of entryCounts) {
    const existing = out[r.entryDate];
    out[r.entryDate] = {
      date: r.entryDate,
      count: r.count,
      visited: existing?.visited ?? true,
      level: levelFor(existing?.visited ?? true, r.count),
    };
  }
  return out;
}

/** Counts for one calendar month ("YYYY-MM"), keyed by date. */
export async function getMyMonthHeatmap(
  month: string,
  type?: EntryType,
): Promise<Record<string, DayCount>> {
  const userId = await requireUserId();
  const [y, m] = month.split("-").map(Number) as [number, number];
  const dateFrom = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this one
  const dateTo = `${month}-${String(lastDay).padStart(2, "0")}`;
  const [visitedDays, entryCounts] = await Promise.all([
    AppLoginsRepository.listDaysForUser(userId, dateFrom, dateTo),
    EntriesRepository.countsByDateForUser(userId, { type, dateFrom, dateTo }),
  ]);
  return mergeDayData(visitedDays, entryCounts);
}

export interface YearHeatmap {
  year: number;
  days: Record<string, DayCount>;
  totalDaysJournaled: number;
  totalEntries: number;
  /** Consecutive days with at least one entry, ending today or yesterday
   * (a gap of exactly one day — "haven't written yet today" — doesn't break
   * a streak that's still alive). 0 if today/yesterday has no entry. */
  currentStreak: number;
}

/** One year's merged day data. */
async function loadYearDays(
  userId: string,
  year: number,
  type?: EntryType,
): Promise<{
  days: Record<string, DayCount>;
  entryCounts: { entryDate: string; count: number }[];
}> {
  const dateFrom = `${year}-01-01`;
  const dateTo = `${year}-12-31`;
  const [visitedDays, entryCounts] = await Promise.all([
    AppLoginsRepository.listDaysForUser(userId, dateFrom, dateTo),
    EntriesRepository.countsByDateForUser(userId, { type, dateFrom, dateTo }),
  ]);
  return { days: mergeDayData(visitedDays, entryCounts), entryCounts };
}

/** Walks backward day by day from today (or yesterday, if today has nothing
 * yet) counting consecutive active days — opening the app keeps a streak
 * alive, same as recording does, since every visit is a contribution. It
 * loads earlier years on demand, so a streak carries across New Year.
 * Purely derived from the same day data the grid renders — nothing stored,
 * nothing invented. */
async function computeStreak(
  userId: string,
  today: string,
  loaded: Map<number, Record<string, DayCount>>,
  type?: EntryType,
): Promise<number> {
  const isActive = async (key: string): Promise<boolean> => {
    const y = Number(key.slice(0, 4));
    let days = loaded.get(y);
    if (!days) {
      days = (await loadYearDays(userId, y, type)).days;
      loaded.set(y, days);
    }
    return Boolean(days[key]);
  };

  let cursor = today;
  if (!(await isActive(cursor))) {
    cursor = addDays(cursor, -1);
    if (!(await isActive(cursor))) return 0;
  }
  let streak = 0;
  while (await isActive(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** The whole year's day data, for the expanded full-year grid. */
export async function getMyYearHeatmap(
  year: number,
  type?: EntryType,
): Promise<YearHeatmap> {
  const userId = await requireUserId();
  // "today" (a profile read) and the year's day data don't depend on each
  // other, so they load together.
  const [today, { days, entryCounts }] = await timed(
    "journal-heatmap",
    "load",
    Promise.all([getMyToday(), loadYearDays(userId, year, type)]),
  );
  const totalEntries = entryCounts.reduce((n, r) => n + r.count, 0);
  const totalDaysJournaled = entryCounts.length;

  return {
    year,
    days,
    totalDaysJournaled,
    totalEntries,
    // A streak is only meaningful against the CURRENT year's trailing edge;
    // a past year's grid still shows its own data but doesn't claim a
    // "current streak" that isn't about now.
    currentStreak:
      year === Number(today.slice(0, 4))
        ? await computeStreak(userId, today, new Map([[year, days]]), type)
        : 0,
  };
}

/** The entries written on one specific day, for the inline "selected day"
 * panel — reuses listMyEntries' existing date-range filtering and plain-text
 * snippets rather than a new query shape. */
export async function getMyEntriesForDay(
  date: string,
  type?: EntryType,
): Promise<EntryListItemWithThumbnail[]> {
  // Archived entries count toward a day's cell, so they're listed too.
  return listMyEntries({
    type,
    includeArchived: true,
    dateFrom: date,
    dateTo: date,
  });
}
