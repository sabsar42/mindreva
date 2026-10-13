import "server-only";
import { EntriesRepository, type EntryType } from "@mindreva/database";
import { getUser } from "@mindreva/auth/server";
import {
  listMyEntries,
  type EntryListItemWithThumbnail,
} from "./entries.service";

/**
 * Activity-heatmap data: entry counts per calendar day, the four-level
 * intensity bucketing used by both the compact monthly grid and the
 * full-year grid, a reliable streak derived purely from those same counts,
 * and the inline per-day detail panel's entries. No new storage — this reads
 * `entries.entry_date`, the same column the old CalendarPicker's dots and
 * day-thumbnails already used.
 */

async function requireUserId(): Promise<string> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

/** 0 = no entries, 1-4 = increasing activity. Thresholds tuned for normal
 * journaling cadence (at most a handful of entries on a busy day), not
 * GitHub's commit-count scale. */
export function levelForCount(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

export interface DayCount {
  /** "YYYY-MM-DD" */
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

function toDayCounts(
  rows: { entryDate: string; count: number }[],
): Record<string, DayCount> {
  const out: Record<string, DayCount> = {};
  for (const r of rows) {
    out[r.entryDate] = {
      date: r.entryDate,
      count: r.count,
      level: levelForCount(r.count),
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
  const rows = await EntriesRepository.countsByDateForUser(userId, {
    type,
    dateFrom,
    dateTo,
  });
  return toDayCounts(rows);
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

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Walks backward day by day from today (or yesterday, if today has nothing
 * yet) counting consecutive journaled days. Purely derived from the same
 * day-count data the grid renders — nothing stored, nothing invented. */
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

/** The whole year's day-counts, for the expanded full-year grid. */
export async function getMyYearHeatmap(
  year: number,
  type?: EntryType,
): Promise<YearHeatmap> {
  const userId = await requireUserId();
  const rows = await EntriesRepository.countsByDateForUser(userId, {
    type,
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
  });
  const days = toDayCounts(rows);
  const totalEntries = rows.reduce((n, r) => n + r.count, 0);

  return {
    year,
    days,
    totalDaysJournaled: rows.length,
    totalEntries,
    // A streak is only meaningful against the CURRENT year's trailing edge;
    // a past year's grid still shows its own counts but doesn't claim a
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
