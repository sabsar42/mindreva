import { beforeEach, describe, expect, it, vi } from "vitest";

// The service imports "server-only", which throws outside Next; stub it the
// same way shares.service.test.ts does.
vi.mock("server-only", () => ({}));

const listClustersForUser = vi.fn();
const listMembershipsForUser = vi.fn();
const listClusterEntryDetailsForUser = vi.fn();
const getUser = vi.fn();

vi.mock("@mindreva/database", () => ({
  MindmapRepository: {
    listClustersForUser,
    listMembershipsForUser,
    listClusterEntryDetailsForUser,
  },
  // Pure clustering helpers the service imports but getMyRiver never calls.
  clusterCountFor: vi.fn(),
  kMeansCluster: vi.fn(),
  membershipKey: (month: string, entryIds: string[]) =>
    `${month}::${[...entryIds].sort().join(",")}`,
  mostRepresentative: vi.fn(),
}));
vi.mock("@mindreva/auth/server", () => ({ getUser }));
vi.mock("@mindreva/llm", () => ({
  buildThemeLabelMessages: vi.fn(),
  getLLMProvider: vi.fn(),
  parseThemeLabel: vi.fn(),
  UNLABELED_THEME: "Other",
}));
vi.mock("@mindreva/types", () => ({
  stripFormatting: (text: string) => text,
}));

const { getMyRiver } = await import("./mindmap.service");

const USER = "user-id";

function cluster(over: {
  id: string;
  label: string;
  month: string;
  entryCount?: number;
  colorIndex?: number;
  firstSeenAt?: string;
}) {
  return {
    id: over.id,
    userId: USER,
    label: over.label,
    month: over.month,
    entryCount: over.entryCount ?? 1,
    colorIndex: over.colorIndex ?? 0,
    firstSeenAt: new Date(over.firstSeenAt ?? `${over.month}-01T00:00:00Z`),
    computedAt: new Date("2026-06-10T00:00:00Z"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ id: USER });
});

describe("getMyRiver", () => {
  it("returns an empty river when there are no clusters", async () => {
    listClustersForUser.mockResolvedValue([]);
    listMembershipsForUser.mockResolvedValue([]);
    listClusterEntryDetailsForUser.mockResolvedValue([]);

    const river = await getMyRiver();
    expect(river.themes).toHaveLength(0);
    expect(river.insight).toBeNull();
    expect(river.monthsCovered).toHaveLength(0);
  });

  it("groups clusters into one theme per exact label, across months", async () => {
    listClustersForUser.mockResolvedValue([
      cluster({ id: "home-1", label: "Home", month: "2026-01" }),
      cluster({ id: "home-6", label: "Home", month: "2026-06" }),
      cluster({ id: "work-1", label: "Work", month: "2026-01" }),
    ]);
    listMembershipsForUser.mockResolvedValue([]);
    listClusterEntryDetailsForUser.mockResolvedValue([
      {
        clusterId: "home-1",
        entryId: "e1",
        entryDate: "2026-01-05",
        title: "A",
        snippet: "a",
      },
      {
        clusterId: "home-6",
        entryId: "e2",
        entryDate: "2026-06-05",
        title: "B",
        snippet: "b",
      },
      {
        clusterId: "work-1",
        entryId: "e3",
        entryDate: "2026-01-10",
        title: "C",
        snippet: "c",
      },
    ]);

    const river = await getMyRiver();
    expect(river.themes.map((t) => t.label).sort()).toEqual(["Home", "Work"]);

    const home = river.themes.find((t) => t.label === "Home")!;
    expect(home.months.map((m) => m.month)).toEqual(["2026-01", "2026-06"]);
  });

  it("never merges two differently-labeled themes, even if related in meaning", async () => {
    listClustersForUser.mockResolvedValue([
      cluster({ id: "home-1", label: "Home", month: "2026-01" }),
      cluster({ id: "homelife-1", label: "Home life", month: "2026-01" }),
    ]);
    listMembershipsForUser.mockResolvedValue([]);
    listClusterEntryDetailsForUser.mockResolvedValue([]);

    const river = await getMyRiver();
    expect(river.themes).toHaveLength(2);
    expect(river.themes.map((t) => t.label).sort()).toEqual([
      "Home",
      "Home life",
    ]);
  });

  it("marks a theme's very first entry as isFirstAppearance", async () => {
    listClustersForUser.mockResolvedValue([
      cluster({ id: "home-1", label: "Home", month: "2026-01" }),
    ]);
    listMembershipsForUser.mockResolvedValue([]);
    listClusterEntryDetailsForUser.mockResolvedValue([
      {
        clusterId: "home-1",
        entryId: "e1",
        entryDate: "2026-01-03",
        title: "A",
        snippet: null,
      },
      {
        clusterId: "home-1",
        entryId: "e2",
        entryDate: "2026-01-20",
        title: "B",
        snippet: null,
      },
    ]);

    const river = await getMyRiver();
    const home = river.themes[0]!;
    expect(home.milestones[0]!.isFirstAppearance).toBe(true);
    expect(home.milestones[1]!.isFirstAppearance).toBe(false);
  });

  it("detects a return after a real calendar gap, not a merely-adjacent month", async () => {
    listClustersForUser.mockResolvedValue([
      cluster({ id: "home-1", label: "Home", month: "2026-01" }),
      cluster({ id: "home-2", label: "Home", month: "2026-02" }),
      cluster({ id: "home-6", label: "Home", month: "2026-06" }),
    ]);
    listMembershipsForUser.mockResolvedValue([]);
    listClusterEntryDetailsForUser.mockResolvedValue([
      {
        clusterId: "home-1",
        entryId: "e1",
        entryDate: "2026-01-05",
        title: "A",
        snippet: null,
      },
      {
        clusterId: "home-2",
        entryId: "e2",
        entryDate: "2026-02-05",
        title: "B",
        snippet: null,
      },
      {
        clusterId: "home-6",
        entryId: "e3",
        entryDate: "2026-06-05",
        title: "C",
        snippet: null,
      },
    ]);

    const river = await getMyRiver();
    const home = river.themes[0]!;
    const byEntry = new Map(home.milestones.map((m) => [m.entryId, m]));
    // Jan -> Feb is contiguous: no gap.
    expect(byEntry.get("e2")!.isReturnAfterGap).toBe(false);
    // Feb -> June is a real gap: June's entry is the return point.
    expect(byEntry.get("e3")!.isReturnAfterGap).toBe(true);
    expect(byEntry.get("e3")!.previousMonth).toBe("2026-02");
  });

  it("only attributes a gap-return to the month's first entry, not every entry in that month", async () => {
    listClustersForUser.mockResolvedValue([
      cluster({ id: "home-1", label: "Home", month: "2026-01" }),
      cluster({ id: "home-6", label: "Home", month: "2026-06" }),
    ]);
    listMembershipsForUser.mockResolvedValue([]);
    listClusterEntryDetailsForUser.mockResolvedValue([
      {
        clusterId: "home-1",
        entryId: "e1",
        entryDate: "2026-01-05",
        title: "A",
        snippet: null,
      },
      {
        clusterId: "home-6",
        entryId: "e2",
        entryDate: "2026-06-02",
        title: "B",
        snippet: null,
      },
      {
        clusterId: "home-6",
        entryId: "e3",
        entryDate: "2026-06-20",
        title: "C",
        snippet: null,
      },
    ]);

    const river = await getMyRiver();
    const byEntry = new Map(
      river.themes[0]!.milestones.map((m) => [m.entryId, m]),
    );
    expect(byEntry.get("e2")!.isReturnAfterGap).toBe(true);
    expect(byEntry.get("e3")!.isReturnAfterGap).toBe(false);
  });

  it("finds an intersection only when two DIFFERENT themes share an entry in the SAME month", async () => {
    listClustersForUser.mockResolvedValue([
      cluster({ id: "home-6", label: "Home", month: "2026-06" }),
      cluster({ id: "gratitude-6", label: "Gratitude", month: "2026-06" }),
      cluster({ id: "work-1", label: "Work", month: "2026-01" }),
    ]);
    listMembershipsForUser.mockResolvedValue([
      { clusterId: "home-6", entryId: "shared-1" },
      { clusterId: "gratitude-6", entryId: "shared-1" },
      { clusterId: "work-1", entryId: "shared-1" }, // different month: must not link to either June cluster
    ]);
    listClusterEntryDetailsForUser.mockResolvedValue([
      {
        clusterId: "home-6",
        entryId: "shared-1",
        entryDate: "2026-06-05",
        title: "A",
        snippet: null,
      },
      {
        clusterId: "gratitude-6",
        entryId: "shared-1",
        entryDate: "2026-06-05",
        title: "A",
        snippet: null,
      },
      {
        clusterId: "work-1",
        entryId: "shared-1",
        entryDate: "2026-06-05",
        title: "A",
        snippet: null,
      },
    ]);

    const river = await getMyRiver();
    expect(river.intersections).toHaveLength(1);
    expect(river.intersections[0]).toMatchObject({
      month: "2026-06",
      themeA: "Gratitude",
      themeB: "Home",
      sharedEntryIds: ["shared-1"],
    });
  });

  it("never reports an intersection between a theme and itself", async () => {
    listClustersForUser.mockResolvedValue([
      cluster({ id: "home-6a", label: "Home", month: "2026-06" }),
    ]);
    listMembershipsForUser.mockResolvedValue([
      { clusterId: "home-6a", entryId: "e1" },
    ]);
    listClusterEntryDetailsForUser.mockResolvedValue([]);

    const river = await getMyRiver();
    expect(river.intersections).toHaveLength(0);
  });

  it("builds an insight only for a gap of 2+ months, picking the most recent return", async () => {
    listClustersForUser.mockResolvedValue([
      cluster({ id: "home-1", label: "Home", month: "2026-01" }),
      cluster({ id: "home-3", label: "Home", month: "2026-03" }), // 1-month gap: skipped
      cluster({ id: "work-1", label: "Work", month: "2026-01" }),
      cluster({ id: "work-6", label: "Work", month: "2026-06" }), // 4-month gap: the insight
    ]);
    listMembershipsForUser.mockResolvedValue([]);
    listClusterEntryDetailsForUser.mockResolvedValue([
      {
        clusterId: "home-1",
        entryId: "h1",
        entryDate: "2026-01-05",
        title: "A",
        snippet: null,
      },
      {
        clusterId: "home-3",
        entryId: "h2",
        entryDate: "2026-03-05",
        title: "B",
        snippet: null,
      },
      {
        clusterId: "work-1",
        entryId: "w1",
        entryDate: "2026-01-05",
        title: "C",
        snippet: null,
      },
      {
        clusterId: "work-6",
        entryId: "w2",
        entryDate: "2026-06-05",
        title: "D",
        snippet: null,
      },
    ]);

    const river = await getMyRiver();
    expect(river.insight).toMatchObject({
      label: "Work",
      returnedMonth: "2026-06",
      previousMonth: "2026-01",
      entryId: "w2",
    });
  });

  it("returns no insight when no theme has a genuine multi-month gap", async () => {
    listClustersForUser.mockResolvedValue([
      cluster({ id: "home-1", label: "Home", month: "2026-01" }),
      cluster({ id: "home-2", label: "Home", month: "2026-02" }),
    ]);
    listMembershipsForUser.mockResolvedValue([]);
    listClusterEntryDetailsForUser.mockResolvedValue([
      {
        clusterId: "home-1",
        entryId: "h1",
        entryDate: "2026-01-05",
        title: "A",
        snippet: null,
      },
      {
        clusterId: "home-2",
        entryId: "h2",
        entryDate: "2026-02-05",
        title: "B",
        snippet: null,
      },
    ]);

    const river = await getMyRiver();
    expect(river.insight).toBeNull();
  });

  it("collects every month across all themes, deduplicated and sorted, for the time axis", async () => {
    listClustersForUser.mockResolvedValue([
      cluster({ id: "home-1", label: "Home", month: "2026-03" }),
      cluster({ id: "work-1", label: "Work", month: "2026-01" }),
      cluster({ id: "work-2", label: "Work", month: "2026-03" }),
    ]);
    listMembershipsForUser.mockResolvedValue([]);
    listClusterEntryDetailsForUser.mockResolvedValue([]);

    const river = await getMyRiver();
    expect(river.monthsCovered).toEqual(["2026-01", "2026-03"]);
  });
});
