import { beforeEach, describe, expect, it, vi } from "vitest";

// The service imports "server-only", which throws outside Next; stub it the
// same way the other service tests do.
vi.mock("server-only", () => ({}));

const countsByDateForUser = vi.fn();
const getUser = vi.fn();
const listMyEntries = vi.fn();

vi.mock("@mindreva/database", () => ({
  EntriesRepository: { countsByDateForUser },
}));
vi.mock("@mindreva/auth/server", () => ({ getUser }));
vi.mock("./entries.service", () => ({ listMyEntries }));

const {
  levelForCount,
  getMyMonthHeatmap,
  getMyYearHeatmap,
  getMyEntriesForDay,
} = await import("./heatmap.service");

const USER = "user-id";

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ id: USER });
});

describe("levelForCount", () => {
  it("buckets counts into the five intensity levels", () => {
    expect(levelForCount(0)).toBe(0);
    expect(levelForCount(1)).toBe(1);
    expect(levelForCount(2)).toBe(2);
    expect(levelForCount(3)).toBe(3);
    expect(levelForCount(4)).toBe(3);
    expect(levelForCount(5)).toBe(4);
    expect(levelForCount(100)).toBe(4);
  });
});

describe("getMyMonthHeatmap", () => {
  it("queries the correct first/last day of the month, including a 31-day month and a February", async () => {
    countsByDateForUser.mockResolvedValue([]);
    await getMyMonthHeatmap("2026-01");
    expect(countsByDateForUser).toHaveBeenCalledWith(USER, {
      type: undefined,
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });

    countsByDateForUser.mockClear();
    await getMyMonthHeatmap("2024-02"); // leap year
    expect(countsByDateForUser).toHaveBeenCalledWith(USER, {
      type: undefined,
      dateFrom: "2024-02-01",
      dateTo: "2024-02-29",
    });

    countsByDateForUser.mockClear();
    await getMyMonthHeatmap("2026-02"); // non-leap year
    expect(countsByDateForUser).toHaveBeenCalledWith(USER, {
      type: undefined,
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
    });
  });

  it("converts rows into a date-keyed map with the right level", async () => {
    countsByDateForUser.mockResolvedValue([
      { entryDate: "2026-03-05", count: 2 },
      { entryDate: "2026-03-10", count: 6 },
    ]);
    const days = await getMyMonthHeatmap("2026-03");
    expect(days["2026-03-05"]).toEqual({
      date: "2026-03-05",
      count: 2,
      level: 2,
    });
    expect(days["2026-03-10"]).toEqual({
      date: "2026-03-10",
      count: 6,
      level: 4,
    });
    expect(days["2026-03-11"]).toBeUndefined();
  });
});

describe("getMyYearHeatmap", () => {
  const REAL_DATE = Date;
  function mockToday(iso: string) {
    class MockDate extends REAL_DATE {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(iso);
        } else {
          // @ts-expect-error - forwarding varargs to the real Date constructor
          super(...args);
        }
      }
      static override now() {
        return new REAL_DATE(iso).getTime();
      }
    }
    vi.stubGlobal("Date", MockDate);
  }
  it("computes totals from the raw day rows", async () => {
    mockToday("2026-06-15T12:00:00Z");
    countsByDateForUser.mockResolvedValue([
      { entryDate: "2026-01-10", count: 1 },
      { entryDate: "2026-02-20", count: 3 },
    ]);
    const year = await getMyYearHeatmap(2026);
    expect(year.totalDaysJournaled).toBe(2);
    expect(year.totalEntries).toBe(4);
    vi.unstubAllGlobals();
  });

  it("computes a current streak ending today", async () => {
    mockToday("2026-06-15T12:00:00Z");
    countsByDateForUser.mockResolvedValue([
      { entryDate: "2026-06-15", count: 1 },
      { entryDate: "2026-06-14", count: 1 },
      { entryDate: "2026-06-13", count: 1 },
      { entryDate: "2026-06-10", count: 1 }, // not contiguous: breaks the streak
    ]);
    const year = await getMyYearHeatmap(2026);
    expect(year.currentStreak).toBe(3);
    vi.unstubAllGlobals();
  });

  it("keeps a streak alive when today has nothing yet but yesterday does", async () => {
    mockToday("2026-06-15T06:00:00Z");
    countsByDateForUser.mockResolvedValue([
      { entryDate: "2026-06-14", count: 1 },
      { entryDate: "2026-06-13", count: 1 },
    ]);
    const year = await getMyYearHeatmap(2026);
    expect(year.currentStreak).toBe(2);
    vi.unstubAllGlobals();
  });

  it("reports zero streak when neither today nor yesterday has an entry", async () => {
    mockToday("2026-06-15T12:00:00Z");
    countsByDateForUser.mockResolvedValue([
      { entryDate: "2026-06-10", count: 1 },
    ]);
    const year = await getMyYearHeatmap(2026);
    expect(year.currentStreak).toBe(0);
    vi.unstubAllGlobals();
  });

  it("never reports a streak for a year that isn't the current one", async () => {
    mockToday("2026-06-15T12:00:00Z");
    countsByDateForUser.mockResolvedValue([
      { entryDate: "2025-12-31", count: 1 },
    ]);
    const year = await getMyYearHeatmap(2025);
    expect(year.currentStreak).toBe(0);
    vi.unstubAllGlobals();
  });
});

describe("getMyEntriesForDay", () => {
  it("delegates to listMyEntries with the day as both ends of the date range", async () => {
    listMyEntries.mockResolvedValue([]);
    await getMyEntriesForDay("2026-05-01", "journal");
    expect(listMyEntries).toHaveBeenCalledWith({
      type: "journal",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-01",
    });
  });
});
