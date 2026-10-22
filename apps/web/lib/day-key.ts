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

/** ms to add to UTC to get local wall-clock time in `tz` at instant `at`. */
function zoneOffsetMs(tz: string, at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant the next local day begins in `tz` (DST-safe). */
export function nextMidnightInZone(
  tz?: string | null,
  at: Date = new Date(),
): Date {
  const zone = resolveTimeZone(tz);
  const [y, m, d] = addDays(dayKeyInZone(zone, at), 1)
    .split("-")
    .map(Number) as [number, number, number];
  const wallClock = Date.UTC(y, m - 1, d);
  // Correct once for the offset at the guess, then again in case the guess
  // and the real midnight sit on opposite sides of a DST change.
  let t = wallClock - zoneOffsetMs(zone, new Date(wallClock));
  t = wallClock - zoneOffsetMs(zone, new Date(t));
  return new Date(t);
}
