import { describe, expect, it } from "vitest";
import {
  daysBetween,
  fileDay,
  pickLookback,
  pickMemories,
  yearsAgoLabel,
} from "./on-this-day";

const e = (
  id: string,
  entryDate: string | null,
  createdAt = "2026-01-01T10:00:00Z",
) => ({
  id,
  title: id,
  entryDate,
  createdAt,
});

describe("pickLookback", () => {
  it("prefers entries from today's date in earlier years, newest first", () => {
    const r = pickLookback(
      [
        e("a", "2024-10-23"),
        e("b", "2025-10-23"),
        e("c", "2025-10-22"),
        e("d", "2026-10-23"),
      ],
      "2026-10-23",
    );
    expect(r).toEqual({
      kind: "on-this-day",
      entries: [e("b", "2025-10-23"), e("a", "2024-10-23")],
    });
  });

  it("falls back to one memory at least 30 days old, stable for the day", () => {
    const list = [
      e("x", "2026-08-01"),
      e("y", "2026-09-01"),
      e("z", "2026-10-20"),
    ];
    const r1 = pickLookback(list, "2026-10-23");
    const r2 = pickLookback([...list].reverse(), "2026-10-23");
    expect(r1?.kind).toBe("memory");
    expect(r1).toEqual(r2);
    if (r1?.kind === "memory") expect(["x", "y"]).toContain(r1.entry.id);
  });

  it("returns null for a new user with nothing old enough", () => {
    expect(pickLookback([e("z", "2026-10-20")], "2026-10-23")).toBeNull();
    expect(pickLookback([], "2026-10-23")).toBeNull();
  });

  it("files undated entries under their creation day", () => {
    expect(fileDay(e("u", null, "2025-10-23T08:00:00Z"))).toBe("2025-10-23");
    const r = pickLookback(
      [e("u", null, "2025-10-23T08:00:00Z")],
      "2026-10-23",
    );
    expect(r?.kind).toBe("on-this-day");
  });
});

describe("pickMemories", () => {
  it("returns on-this-day entries when there are any", () => {
    const r = pickMemories(
      [e("a", "2025-10-23"), e("b", "2026-01-02")],
      "2026-10-23",
    );
    expect(r).toEqual({ kind: "on-this-day", entries: [e("a", "2025-10-23")] });
  });

  it("otherwise spreads older entries one per month, newest first", () => {
    const list = [
      e("a", "2026-08-01"),
      e("b", "2026-08-15"),
      e("c", "2026-06-10"),
      e("d", "2026-10-20"),
    ];
    const r = pickMemories(list, "2026-10-23");
    expect(r.kind).toBe("moments");
    expect(r.entries.map((x) => x.entryDate!.slice(0, 7))).toEqual([
      "2026-08",
      "2026-06",
    ]);
    expect(pickMemories([...list].reverse(), "2026-10-23")).toEqual(r);
  });
});

describe("helpers", () => {
  it("counts calendar days and years", () => {
    expect(daysBetween("2026-09-23", "2026-10-23")).toBe(30);
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2);
    expect(yearsAgoLabel("2025-10-23", "2026-10-23")).toBe("1 year ago");
    expect(yearsAgoLabel("2023-10-23", "2026-10-23")).toBe("3 years ago");
  });
});
