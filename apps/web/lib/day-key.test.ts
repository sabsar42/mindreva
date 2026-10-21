import { describe, expect, it } from "vitest";
import { addDays, dayKeyInZone, resolveTimeZone } from "./day-key";

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
