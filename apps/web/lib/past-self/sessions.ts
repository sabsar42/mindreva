/**
 * Past Self session organisation.
 *
 * A "session" here is NOT a database row and is never created per entry or per
 * conversation. It is a derived grouping: every year has exactly two sessions,
 * the first half (January-June) and the second half (July-December), and every
 * journal entry and conversation belongs to exactly one of them by date. Years
 * only appear when they have something in them; within a year both halves are
 * always present (an empty one renders as a quiet, non-expandable row).
 *
 * Pure functions only, so the rules are easy to test and to reuse for the
 * conversation screen's header.
 */

export type Half = 1 | 2;

export interface HalfWindow {
  year: number;
  half: Half;
  /** Stable identifier, e.g. "2026-H1". */
  key: string;
  /** Inclusive "YYYY-MM-DD" bounds, usable directly as a date range filter. */
  start: string;
  end: string;
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Descriptive names, one pool per half. The year is shown next to the name, so a name only needs to be distinct among years that are near each other. */
const FIRST_HALF_NAMES = [
  "A Season of Beginnings",
  "Winter Into Spring",
  "The Quiet Start",
  "First Light",
  "Seeds and Resolutions",
  "A Season of Discovery",
  "Thaw and Bloom",
  "Opening Chapters",
  "The Rising Year",
  "Early Currents",
  "Fresh Ground",
  "A Season of Wonder",
] as const;

const SECOND_HALF_NAMES = [
  "A Season of Growth",
  "Long Light, Longer Shadows",
  "Harvest and Reflection",
  "The Turning Months",
  "Golden Hours",
  "A Season of Becoming",
  "Autumn Reckonings",
  "Closing Chapters",
  "Embers and Lanterns",
  "The Settling Year",
  "Deep Roots",
  "A Season of Gratitude",
] as const;

export function halfOfMonth(month1to12: number): Half {
  return month1to12 <= 6 ? 1 : 2;
}

/** The half a "YYYY-MM-DD" date falls in. */
export function halfOfDate(isoDate: string): Half {
  return halfOfMonth(Number(isoDate.slice(5, 7)));
}

export function windowFor(year: number, half: Half): HalfWindow {
  return {
    year,
    half,
    key: `${year}-H${half}`,
    start: half === 1 ? `${year}-01-01` : `${year}-07-01`,
    end: half === 1 ? `${year}-06-30` : `${year}-12-31`,
  };
}

/**
 * Deterministic, descriptive name for a half-year. Indexed by year so
 * neighbouring years get different names, and the two halves of one year draw
 * from different pools so they never match.
 */
export function sessionName(year: number, half: Half): string {
  const pool = half === 1 ? FIRST_HALF_NAMES : SECOND_HALF_NAMES;
  return pool[((year % pool.length) + pool.length) % pool.length]!;
}

/** "January – June" / "July – December". */
export function monthSpan(half: Half): string {
  return half === 1 ? "January – June" : "July – December";
}

/** "January – June 2026". */
export function rangeLabel(year: number, half: Half): string {
  return `${monthSpan(half)} ${year}`;
}

/** "First Half" / "Second Half" (the neutral label shown next to the year). */
export function halfLabel(half: Half): string {
  return half === 1 ? "First Half" : "Second Half";
}

export interface SessionEntry {
  id: string;
  title: string | null;
  /** "YYYY-MM-DD", or null for an entry with no date. */
  entryDate: string | null;
  /** ISO timestamp. */
  createdAt: string;
  snippet: string | null;
}

export interface SessionConversation {
  id: string;
  /** ISO timestamp. */
  createdAt: string;
  personaYearStart: number | null;
  personaYearEnd: number | null;
  personaHalf: Half | null;
}

export interface PastSelfSession extends HalfWindow {
  name: string;
  rangeLabel: string;
  entries: SessionEntry[];
  conversations: SessionConversation[];
}

export interface PastSelfYear {
  year: number;
  /** Always exactly two: first half, then second half. */
  sessions: [PastSelfSession, PastSelfSession];
}

/** The date an entry is filed under: its entry_date, else the day it was created. */
export function entryDateKey(entry: {
  entryDate: string | null;
  createdAt: string;
}): string {
  return entry.entryDate ?? entry.createdAt.slice(0, 10);
}

/**
 * Which session a conversation belongs to.
 *  - Created from a session card (it has a half): that session, exactly.
 *  - Older whole-year or multi-year conversations (no half): filed under the
 *    last year they covered, in the half it was held in when that was the same
 *    year, otherwise the year's second half (the end of the period it covered).
 */
export function conversationSession(c: SessionConversation): {
  year: number;
  half: Half;
} {
  const created = new Date(c.createdAt);
  const createdYear = created.getUTCFullYear();
  if (c.personaHalf && c.personaYearStart) {
    return { year: c.personaYearStart, half: c.personaHalf };
  }
  const year = c.personaYearEnd ?? c.personaYearStart ?? createdYear;
  const half: Half =
    year === createdYear ? halfOfMonth(created.getUTCMonth() + 1) : 2;
  return { year, half };
}

function byTimeThenId<T extends { createdAt: string; id: string }>(
  a: T,
  b: T,
): number {
  return a.createdAt === b.createdAt
    ? a.id.localeCompare(b.id)
    : a.createdAt.localeCompare(b.createdAt);
}

/**
 * Groups entries and conversations into years of exactly two sessions each.
 * Years are newest first (what you most recently lived is on top); inside a
 * year the halves run in calendar order, and inside a session entries and
 * conversations run oldest to newest, so each reads as a timeline.
 */
export function buildPastSelf(
  entries: SessionEntry[],
  conversations: SessionConversation[],
): PastSelfYear[] {
  const sessions = new Map<string, PastSelfSession>();

  const ensure = (year: number, half: Half): PastSelfSession => {
    const window = windowFor(year, half);
    let session = sessions.get(window.key);
    if (!session) {
      session = {
        ...window,
        name: sessionName(year, half),
        rangeLabel: rangeLabel(year, half),
        entries: [],
        conversations: [],
      };
      sessions.set(window.key, session);
    }
    return session;
  };

  const years = new Set<number>();

  for (const entry of entries) {
    const key = entryDateKey(entry);
    const year = Number(key.slice(0, 4));
    if (!Number.isInteger(year)) continue;
    years.add(year);
    ensure(year, halfOfDate(key)).entries.push(entry);
  }
  for (const conversation of conversations) {
    const { year, half } = conversationSession(conversation);
    years.add(year);
    ensure(year, half).conversations.push(conversation);
  }

  return [...years]
    .sort((a, b) => b - a)
    .map((year) => {
      const first = ensure(year, 1);
      const second = ensure(year, 2);
      for (const session of [first, second]) {
        session.entries.sort((a, b) => {
          const byDate = entryDateKey(a).localeCompare(entryDateKey(b));
          return byDate !== 0 ? byDate : byTimeThenId(a, b);
        });
        session.conversations.sort(byTimeThenId);
      }
      return {
        year,
        sessions: [first, second] as [PastSelfSession, PastSelfSession],
      };
    });
}
