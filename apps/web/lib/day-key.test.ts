import { describe, expect, it } from "vitest";
import {
  addDays,
  dayKeyInZone,
  nextMidnightInZone,
  resolveTimeZone,
} from "./day-key";

describe("dayKeyInZone", () => {
  const at = new Date("2026-07-04T20:00:00Z");
  it("cuts the day at the zone's own midnight", () => {
    expect(dayKeyInZone("UTC", at)).toBe("2026-07-04");
    expect(dayKeyInZone("Asia/Dhaka", at)).toBe("2026-07-05");
    expect(dayKeyInZone("America/Los_Angeles", at)).toBe("2026-07-04");
  });
  it("falls back to UTC for missing or unknown zones", () => {
    expect(dayKeyInZone(null, at)).toBe("2026-07-04");
    expect(resolveTimeZone("Nope/Nope")).toBe("UTC");
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
});

describe("nextMidnightInZone", () => {
  it("is the instant the user's next local day starts", () => {
    const at = new Date("2026-07-04T20:00:00Z"); // 02:00 on the 5th in Dhaka
    expect(nextMidnightInZone("Asia/Dhaka", at).toISOString()).toBe(
      "2026-07-05T18:00:00.000Z",
    );
    expect(nextMidnightInZone("UTC", at).toISOString()).toBe(
      "2026-07-05T00:00:00.000Z",
    );
  });
  it("handles a DST change between now and midnight", () => {
    // New York: EDT (UTC-4) until 2026-11-01 02:00, then EST (UTC-5).
    const at = new Date("2026-10-31T16:00:00Z");
    expect(nextMidnightInZone("America/New_York", at).toISOString()).toBe(
      "2026-11-01T04:00:00.000Z",
    );
    const after = new Date("2026-11-01T16:00:00Z");
    expect(nextMidnightInZone("America/New_York", after).toISOString()).toBe(
      "2026-11-02T05:00:00.000Z",
    );
  });
});
