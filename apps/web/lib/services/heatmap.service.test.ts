import { beforeEach, describe, expect, it, vi } from "vitest";

// The service imports "server-only", which throws outside Next; stub it the
// same way the other service tests do.
vi.mock("server-only", () => ({}));

const countsByDateForUser = vi.fn();
const listDaysForUser = vi.fn();
const recordVisit = vi.fn();
const getUser = vi.fn();
const listMyEntries = vi.fn();

vi.mock("@mindreva/database", () => ({
  EntriesRepository: { countsByDateForUser },
  AppLoginsRepository: { listDaysForUser, recordVisit },
}));
vi.mock("@mindreva/auth/server", () => ({ getUser }));
vi.mock("./entries.service", () => ({ listMyEntries }));

const {
  getMyMonthHeatmap,
  getMyYearHeatmap,
  getMyEntriesForDay,
  recordMyVisit,
} = await import("./heatmap.service");

const USER = "user-id";

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ id: USER });
  listDaysForUser.mockResolvedValue([]);
  countsByDateForUser.mockResolvedValue([]);
});

describe("getMyMonthHeatmap", () => {
  it("queries the correct first/last day of the month, including a 31-day month and a February", async () => {
    await getMyMonthHeatmap("2026-01");
    expect(countsByDateForUser).toHaveBeenCalledWith(USER, {
      type: undefined,
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });
    expect(listDaysForUser).toHaveBeenCalledWith(
      USER,
      "2026-01-01",
      "2026-01-31",
    );

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

  it("a visited-only day is level 1; recording deepens it to 2/3/4 by entry count", async () => {
    listDaysForUser.mockResolvedValue([
      "2026-03-05",
      "2026-03-08",
      "2026-03-10",
      "2026-03-12",
    ]);
    countsByDateForUser.mockResolvedValue([
      { entryDate: "2026-03-08", count: 1 },
      { entryDate: "2026-03-10", count: 2 },
      { entryDate: "2026-03-12", count: 5 },
    ]);
    const days = await getMyMonthHeatmap("2026-03");
    expect(days["2026-03-05"]).toEqual({
      date: "2026-03-05",
      count: 0,
      visited: true,
      level: 1,
    });
    expect(days["2026-03-08"]!.level).toBe(2);
    expect(days["2026-03-10"]).toEqual({
      date: "2026-03-10",
      count: 2,
      visited: true,
      level: 3,
    });
    expect(days["2026-03-12"]!.level).toBe(4);
    expect(days["2026-03-11"]).toBeUndefined();
  });

  it("a recorded day with no matching visit row still lands on level 2", async () => {
    // Shouldn't normally happen (recording implies having opened the app),
    // but the merge must not crash or under-report if it does.
    listDaysForUser.mockResolvedValue([]);
    countsByDateForUser.mockResolvedValue([
      { entryDate: "2026-03-10", count: 1 },
    ]);
    const days = await getMyMonthHeatmap("2026-03");
    expect(days["2026-03-10"]!.level).toBe(2);
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

  it("computes totals from the raw entry rows, independent of visited days", async () => {
    mockToday("2026-06-15T12:00:00Z");
    listDaysForUser.mockResolvedValue([
      "2026-01-10",
      "2026-02-20",
      "2026-05-01",
    ]);
    countsByDateForUser.mockResolvedValue([
      { entryDate: "2026-01-10", count: 1 },
      { entryDate: "2026-02-20", count: 3 },
    ]);
    const year = await getMyYearHeatmap(2026);
    expect(year.totalDaysJournaled).toBe(2);
    expect(year.totalEntries).toBe(4);
    vi.unstubAllGlobals();
  });

  it("a visit-only streak stays alive without any recording", async () => {
    mockToday("2026-06-15T12:00:00Z");
    listDaysForUser.mockResolvedValue([
      "2026-06-15",
      "2026-06-14",
      "2026-06-13",
    ]);
    countsByDateForUser.mockResolvedValue([]);
    const year = await getMyYearHeatmap(2026);
    expect(year.currentStreak).toBe(3);
    vi.unstubAllGlobals();
  });

  it("computes a current streak ending today, broken by a gap", async () => {
    mockToday("2026-06-15T12:00:00Z");
    listDaysForUser.mockResolvedValue([
      "2026-06-15",
      "2026-06-14",
      "2026-06-13",
      "2026-06-10", // not contiguous: breaks the streak
    ]);
    countsByDateForUser.mockResolvedValue([
      { entryDate: "2026-06-15", count: 1 },
    ]);
    const year = await getMyYearHeatmap(2026);
    expect(year.currentStreak).toBe(3);
    vi.unstubAllGlobals();
  });

  it("keeps a streak alive when today has nothing yet but yesterday does", async () => {
    mockToday("2026-06-15T06:00:00Z");
    listDaysForUser.mockResolvedValue(["2026-06-14", "2026-06-13"]);
    countsByDateForUser.mockResolvedValue([]);
    const year = await getMyYearHeatmap(2026);
    expect(year.currentStreak).toBe(2);
    vi.unstubAllGlobals();
  });

  it("reports zero streak when neither today nor yesterday has an entry", async () => {
    mockToday("2026-06-15T12:00:00Z");
    listDaysForUser.mockResolvedValue(["2026-06-10"]);
    countsByDateForUser.mockResolvedValue([]);
    const year = await getMyYearHeatmap(2026);
    expect(year.currentStreak).toBe(0);
    vi.unstubAllGlobals();
  });

  it("never reports a streak for a year that isn't the current one", async () => {
    mockToday("2026-06-15T12:00:00Z");
    listDaysForUser.mockResolvedValue(["2025-12-31"]);
    countsByDateForUser.mockResolvedValue([]);
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

describe("recordMyVisit", () => {
  it("records today under the signed-in user's id", async () => {
    const REAL_DATE = Date;
    class MockDate extends REAL_DATE {
      constructor(...args: unknown[]) {
        if (args.length === 0) super("2026-07-04T10:00:00Z");
        // @ts-expect-error - forwarding varargs to the real Date constructor
        else super(...args);
      }
    }
    vi.stubGlobal("Date", MockDate);
    recordVisit.mockResolvedValue(undefined);
    await recordMyVisit();
    expect(recordVisit).toHaveBeenCalledWith(USER, "2026-07-04");
    vi.unstubAllGlobals();
  });

  it("does nothing when nobody is signed in", async () => {
    getUser.mockResolvedValue(null);
    await recordMyVisit();
    expect(recordVisit).not.toHaveBeenCalled();
  });

  it("swallows a write failure rather than throwing", async () => {
    recordVisit.mockRejectedValue(new Error("db down"));
    await expect(recordMyVisit()).resolves.toBeUndefined();
  });

  it("swallows getUser() itself throwing, e.g. no request context during a static build probe", async () => {
    getUser.mockRejectedValue(new Error("Dynamic server usage: cookies"));
    await expect(recordMyVisit()).resolves.toBeUndefined();
    expect(recordVisit).not.toHaveBeenCalled();
  });
});
