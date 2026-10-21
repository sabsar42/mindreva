/**
 * Calendar-day helpers. A "day" is always the user's own local calendar day
 * ("YYYY-MM-DD"), never the server's: the server runs in UTC, so using its
 * clock files a Dhaka user's 2am entry under yesterday and breaks streaks.
 */

/** A valid IANA zone, or "UTC" if the input is missing or unknown. */
export function resolveTimeZone(tz?: string | null): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export function dayKeyInZone(
  tz?: string | null,
  at: Date = new Date(),
): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimeZone(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Pure calendar arithmetic on a "YYYY-MM-DD" key (no timezone involved). */
export function addDays(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}
