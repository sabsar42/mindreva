import { beforeEach, describe, expect, it, vi } from "vitest";

// The service imports "server-only", which throws outside Next; stub it the
// same way the other service tests do.
vi.mock("server-only", () => ({}));

const countsByDateForUser = vi.fn();
const listDaysForUser = vi.fn();
const recordVisit = vi.fn();
const getUser = vi.fn();
const listMyEntries = vi.fn();
const getMyToday = vi.fn();
const getMyProfile = vi.fn();
const syncTimezone = vi.fn();

vi.mock("@mindreva/database", () => ({
  EntriesRepository: { countsByDateForUser },
  ProfilesRepository: { syncTimezone },
  AppLoginsRepository: { listDaysForUser, recordVisit },
}));
vi.mock("@mindreva/auth/server", () => ({ getUser }));
vi.mock("./entries.service", () => ({ listMyEntries }));
vi.mock("./profile.service", () => ({ getMyToday, getMyProfile }));

const {
  getMyMonthHeatmap,
  getMyYearHeatmap,
  getMyEntriesForDay,
  recordMyVisit,
  syncMyTimeZone,
} = await import("./heatmap.service");

const USER = "user-id";

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ id: USER });
  getMyToday.mockResolvedValue("2026-06-15");
  recordVisit.mockResolvedValue(undefined);
  getMyProfile.mockResolvedValue({
    timezone: "UTC",
    timezoneSyncedAt: new Date(),
  });
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
  function mockToday(iso: string) {
    getMyToday.mockResolvedValue(iso.slice(0, 10));
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
  });

  it("keeps a streak alive when today has nothing yet but yesterday does", async () => {
    mockToday("2026-06-15T06:00:00Z");
    listDaysForUser.mockResolvedValue(["2026-06-14", "2026-06-13"]);
    countsByDateForUser.mockResolvedValue([]);
    const year = await getMyYearHeatmap(2026);
    expect(year.currentStreak).toBe(2);
  });

  it("reports zero streak when neither today nor yesterday has an entry", async () => {
    mockToday("2026-06-15T12:00:00Z");
    listDaysForUser.mockResolvedValue(["2026-06-10"]);
    countsByDateForUser.mockResolvedValue([]);
    const year = await getMyYearHeatmap(2026);
    expect(year.currentStreak).toBe(0);
  });

  it("never reports a streak for a year that isn't the current one", async () => {
    mockToday("2026-06-15T12:00:00Z");
    listDaysForUser.mockResolvedValue(["2025-12-31"]);
    countsByDateForUser.mockResolvedValue([]);
    const year = await getMyYearHeatmap(2025);
    expect(year.currentStreak).toBe(0);
  });
});

describe("getMyEntriesForDay", () => {
  it("delegates to listMyEntries with the day as both ends of the date range", async () => {
    listMyEntries.mockResolvedValue([]);
    await getMyEntriesForDay("2026-05-01", "journal");
    expect(listMyEntries).toHaveBeenCalledWith({
      type: "journal",
      includeArchived: true,
      dateFrom: "2026-05-01",
      dateTo: "2026-05-01",
    });
  });
});

describe("recordMyVisit", () => {
  it("records the user's own today under their id", async () => {
    getMyToday.mockResolvedValue("2026-07-04");
    recordVisit.mockResolvedValue(undefined);
    await recordMyVisit();
    expect(recordVisit).toHaveBeenCalledWith(USER, "2026-07-04");
  });

  it("waits for the first timezone sync instead of guessing UTC", async () => {
    getMyProfile.mockResolvedValue({ timezone: "UTC", timezoneSyncedAt: null });
    await recordMyVisit();
    expect(recordVisit).not.toHaveBeenCalled();
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

describe("streak across New Year", () => {
  it("keeps counting into the previous year", async () => {
    getMyToday.mockResolvedValue("2026-01-02");
    listDaysForUser.mockImplementation(async (_u: string, from: string) =>
      from.startsWith("2026")
        ? ["2026-01-02", "2026-01-01"]
        : ["2025-12-31", "2025-12-30", "2025-12-20"],
    );
    countsByDateForUser.mockResolvedValue([]);
    const year = await getMyYearHeatmap(2026);
    expect(year.currentStreak).toBe(4);
  });
});

describe("syncMyTimeZone", () => {
  it("saves a changed zone and records the visit on the user's own day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T20:00:00Z")); // 02:00 on the 5th in Dhaka
    await syncMyTimeZone("Asia/Dhaka");
    expect(syncTimezone).toHaveBeenCalledWith(USER, "Asia/Dhaka");
    expect(recordVisit).toHaveBeenCalledWith(USER, "2026-07-05");
    vi.useRealTimers();
  });

  it("does not rewrite an unchanged zone, and falls back to UTC for junk", async () => {
    await syncMyTimeZone("Not/AZone");
    expect(syncTimezone).not.toHaveBeenCalled();
    expect(recordVisit).toHaveBeenCalled();
  });

  it("runs the first sync even when the zone is already UTC", async () => {
    getMyProfile.mockResolvedValue({ timezone: "UTC", timezoneSyncedAt: null });
    await syncMyTimeZone("UTC");
    expect(syncTimezone).toHaveBeenCalledWith(USER, "UTC");
  });
});
