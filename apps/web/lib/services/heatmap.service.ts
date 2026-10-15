import "server-only";
import {
  AppLoginsRepository,
  EntriesRepository,
  type EntryType,
} from "@mindreva/database";
import { getUser } from "@mindreva/auth/server";
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

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    await AppLoginsRepository.recordVisit(user.id, todayKey());
  } catch {
    // Non-fatal: at worst, today's cell falls back to "not visited" until
    // the next successful call records it.
  }
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

function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Walks backward day by day from today (or yesterday, if today has nothing
 * yet) counting consecutive visited days — opening the app keeps a streak
 * alive, same as recording does, since every visit is a contribution.
 * Purely derived from the same day data the grid renders — nothing stored,
 * nothing invented. */
function computeStreak(days: Record<string, DayCount>): number {
  let cursor = todayKey();
  if (!days[cursor]) {
    cursor = addDays(cursor, -1);
    if (!days[cursor]) return 0;
  }
  let streak = 0;
  while (days[cursor]) {
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
  const dateFrom = `${year}-01-01`;
  const dateTo = `${year}-12-31`;
  const [visitedDays, entryCounts] = await Promise.all([
    AppLoginsRepository.listDaysForUser(userId, dateFrom, dateTo),
    EntriesRepository.countsByDateForUser(userId, { type, dateFrom, dateTo }),
  ]);
  const days = mergeDayData(visitedDays, entryCounts);
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
    currentStreak: year === new Date().getFullYear() ? computeStreak(days) : 0,
  };
}

/** The entries written on one specific day, for the inline "selected day"
 * panel — reuses listMyEntries' existing date-range filtering and plain-text
 * snippets rather than a new query shape. */
export async function getMyEntriesForDay(
  date: string,
  type?: EntryType,
): Promise<EntryListItemWithThumbnail[]> {
  return listMyEntries({ type, dateFrom: date, dateTo: date });
}
