/**
 * The Home screen's look-back teaser, from entries the page already has.
 *
 *  - "on-this-day": entries filed on today's month and day in earlier years
 *    (newest year first), the classic iOS Memories hook.
 *  - "memory": otherwise one entry from at least 30 days ago, chosen by the
 *    date so it stays the same all day and changes tomorrow.
 *  - null: nothing old enough yet (a new user sees no teaser at all).
 *
 * Pure: the caller passes today's key in the user's own time zone.
 */

export interface LookbackEntry {
  id: string;
  title: string | null;
  entryDate: string | null;
  createdAt: Date | string;
}

export type Lookback<T extends LookbackEntry> =
  | { kind: "on-this-day"; entries: T[] }
  | { kind: "memory"; entry: T; dateKey: string }
  | null;

/** The day an entry is filed under: its entry_date, else its creation day. */
export function fileDay(entry: LookbackEntry): string {
  if (entry.entryDate) return entry.entryDate;
  const created =
    typeof entry.createdAt === "string"
      ? entry.createdAt
      : entry.createdAt.toISOString();
  return created.slice(0, 10);
}

/** Days between two "YYYY-MM-DD" keys (b - a), calendar-exact. */
export function daysBetween(a: string, b: string): number {
  const toUtc = (k: string) => {
    const [y, m, d] = k.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** A small, stable hash of a string (for picking "today's" memory). */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pickLookback<T extends LookbackEntry>(
  entries: readonly T[],
  todayKey: string,
  minDaysAgo = 30,
): Lookback<T> {
  const monthDay = todayKey.slice(5);
  const year = todayKey.slice(0, 4);

  const sameDay = entries
    .filter((e) => {
      const day = fileDay(e);
      return day.slice(5) === monthDay && day.slice(0, 4) < year;
    })
    .sort((a, b) => fileDay(b).localeCompare(fileDay(a)));
  if (sameDay.length > 0) return { kind: "on-this-day", entries: sameDay };

  const old = entries
    .filter((e) => daysBetween(fileDay(e), todayKey) >= minDaysAgo)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (old.length === 0) return null;
  const entry = old[hash(todayKey) % old.length]!;
  return { kind: "memory", entry, dateKey: fileDay(entry) };
}

/**
 * Memory cards for Re-live Me: every entry from today's date in earlier
 * years; otherwise up to `n` older entries spread across time (at most one
 * per month, newest month first), stable for the day.
 */
export function pickMemories<T extends LookbackEntry>(
  entries: readonly T[],
  todayKey: string,
  n = 6,
): { kind: "on-this-day" | "moments"; entries: T[] } {
  const first = pickLookback(entries, todayKey);
  if (first?.kind === "on-this-day") {
    return { kind: "on-this-day", entries: first.entries };
  }
  const byMonth = new Map<string, T[]>();
  for (const e of entries) {
    const day = fileDay(e);
    if (daysBetween(day, todayKey) < 30) continue;
    const month = day.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), e]);
  }
  const picked = [...byMonth.keys()]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, n)
    .map((month) => {
      const list = byMonth.get(month)!.sort((a, b) => a.id.localeCompare(b.id));
      return list[hash(todayKey + month) % list.length]!;
    });
  return { kind: "moments", entries: picked };
}

/** "1 year ago", "3 years ago". */
export function yearsAgoLabel(dateKey: string, todayKey: string): string {
  const n = Number(todayKey.slice(0, 4)) - Number(dateKey.slice(0, 4));
  return n === 1 ? "1 year ago" : `${n} years ago`;
}
