import { describe, expect, it } from "vitest";
import {
  findBlockAt,
  formatRange,
  formatTimestamp,
  groupSegments,
  parseTimestamp,
} from "./segments";

describe("formatTimestamp", () => {
  it("formats minutes and seconds", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(19_400)).toBe("0:19");
    expect(formatTimestamp(65_000)).toBe("1:05");
  });

  it("adds hours only when needed", () => {
    expect(formatTimestamp(3_725_000)).toBe("1:02:05");
  });

  it("never goes negative", () => {
    expect(formatTimestamp(-5)).toBe("0:00");
  });

  it("formats a range", () => {
    expect(formatRange(19_000, 42_000)).toBe("0:19 – 0:42");
  });
});

describe("parseTimestamp", () => {
  it("accepts seconds, m:ss and h:mm:ss", () => {
    expect(parseTimestamp("75")).toBe(75_000);
    expect(parseTimestamp("1:15")).toBe(75_000);
    expect(parseTimestamp("01:15")).toBe(75_000);
    expect(parseTimestamp("1:02:05")).toBe(3_725_000);
  });

  it("accepts . and , from a phone's decimal keypad as separators", () => {
    expect(parseTimestamp("1.15")).toBe(75_000);
    expect(parseTimestamp("1,15")).toBe(75_000);
    expect(parseTimestamp("1.02.05")).toBe(3_725_000);
    expect(parseTimestamp("1.75")).toBeNull();
  });

  it("rejects things that are not times", () => {
    expect(parseTimestamp("")).toBeNull();
    expect(parseTimestamp("abc")).toBeNull();
    expect(parseTimestamp("1:75")).toBeNull();
    expect(parseTimestamp("1:2:3:4")).toBeNull();
    expect(parseTimestamp("-4")).toBeNull();
  });
});

describe("groupSegments", () => {
  const seg = (start: number, end: number, text: string) => ({
    startMs: start * 1000,
    endMs: end * 1000,
    text,
  });

  it("merges short segments into blocks of about the target length", () => {
    const blocks = groupSegments(
      [
        seg(0, 8, "One."),
        seg(8, 16, "Two."),
        seg(16, 24, "Three."),
        seg(24, 32, "Four."),
        seg(32, 40, "Five."),
      ],
      30_000,
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      startMs: 0,
      endMs: 32_000,
      text: "One. Two. Three. Four.",
    });
    expect(blocks[1]).toMatchObject({ startMs: 32_000, text: "Five." });
  });

  it("returns blocks in chronological order even if given out of order", () => {
    const blocks = groupSegments(
      [seg(40, 50, "later"), seg(0, 10, "first")],
      5_000,
    );
    expect(blocks.map((b) => b.text)).toEqual(["first", "later"]);
    expect(blocks.map((b) => b.index)).toEqual([0, 1]);
  });

  it("drops empty segments", () => {
    expect(groupSegments([seg(0, 2, "  "), seg(2, 4, "hi")])).toHaveLength(1);
  });

  it("returns nothing for no segments", () => {
    expect(groupSegments([])).toEqual([]);
  });
});

describe("findBlockAt", () => {
  const blocks = groupSegments(
    [
      { startMs: 0, endMs: 20_000, text: "a" },
      { startMs: 20_000, endMs: 45_000, text: "b" },
      { startMs: 45_000, endMs: 70_000, text: "c" },
    ],
    1_000,
  );

  it("finds the block containing a time", () => {
    expect(findBlockAt(blocks, 30_000)?.text).toBe("b");
    expect(findBlockAt(blocks, 45_000)?.text).toBe("c");
  });

  it("uses the last block for a time past the end", () => {
    expect(findBlockAt(blocks, 999_999)?.text).toBe("c");
  });

  it("uses the first block for a time before it", () => {
    expect(findBlockAt(blocks, 0)?.text).toBe("a");
  });

  it("is null when there are no blocks", () => {
    expect(findBlockAt([], 5)).toBeNull();
  });
});
