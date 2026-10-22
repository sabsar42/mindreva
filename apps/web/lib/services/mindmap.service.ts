import "server-only";
import {
  buildThemeLabelMessages,
  getLLMProvider,
  parseThemeLabel,
  UNLABELED_THEME,
} from "@mindreva/llm";
import {
  MindmapRepository,
  clusterCountFor,
  kMeansCluster,
  membershipKey,
  mostRepresentative,
  type ClusterWithEntries,
  type ComputedCluster,
  type EmbeddedEntry,
  type MindmapCluster,
} from "@mindreva/database";
import { stripFormatting } from "@mindreva/types";
import { getUser } from "@mindreva/auth/server";

/** Entries used to label a cluster. Enough signal to name a theme without paying for the whole tail. */
const LABEL_SAMPLE_SIZE = 4;

/** How many distinct mint shades the UI cycles through — must match MINDMAP_TINTS in the client. */
export const MINDMAP_TINT_COUNT = 6;

async function requireUserId(): Promise<string> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

/**
 * "River of Memories" data model. The underlying storage is unchanged — one
 * row per (theme label, month) in mindmap_clusters, same as the old bubble
 * map — only the shape returned to the UI is different: instead of one node
 * per cluster, clusters are grouped by label into a THEME that flows across
 * every month it appears in.
 *
 * Theme identity is exact label match (no fuzzy/semantic merging): two
 * clusters are "the same theme" iff their labels are byte-identical. This is
 * the same guarantee the old map already relied on (a label's tint is a hash
 * of the label, and labels are reused across recomputes by exact membership),
 * so a river path never silently merges two differently-named themes.
 */
export interface RiverMonthPoint {
  /** "YYYY-MM" */
  month: string;
  clusterId: string;
  entryCount: number;
}

export interface RiverMilestone {
  clusterId: string;
  month: string;
  entryId: string;
  entryDate: string | null;
  title: string | null;
  snippet: string | null;
  /** True for the theme's very first recorded entry. */
  isFirstAppearance: boolean;
  /**
   * True when this entry's month isn't the calendar month immediately after
   * the theme's previous active month — i.e. the theme went quiet for at
   * least one full month and this entry is where it picked back up.
   */
  isReturnAfterGap: boolean;
  /** Only set when isReturnAfterGap: the month this theme was last active before this one. */
  previousMonth: string | null;
}

export interface RiverTheme {
  id: string;
  label: string;
  colorIndex: number;
  firstSeenAt: string;
  /** Chronological, one point per month this theme has at least one entry. */
  months: RiverMonthPoint[];
  /** Chronological, one per entry across every month-cluster for this theme. */
  milestones: RiverMilestone[];
}

/** Two themes whose paths touch because they share real entries in a given month. */
export interface RiverIntersection {
  month: string;
  themeA: string;
  themeB: string;
  /** Entries that belong to both themes in this month — the evidence, not an inference. */
  sharedEntryIds: string[];
}

/**
 * One evidence-grounded observation about a theme's history, computed from
 * the same gap/return data the river draws — never a separate LLM call, and
 * never phrased as an emotional or motivational claim (see
 * docs/roadmap.md "Evidence and Transparency").
 */
export interface RiverInsight {
  kind: "returned_after_gap";
  themeId: string;
  label: string;
  returnedMonth: string;
  previousMonth: string;
  gapMonths: number;
  entryId: string;
  entryDate: string | null;
}

export interface RiverData {
  themes: RiverTheme[];
  intersections: RiverIntersection[];
  insight: RiverInsight | null;
  /** Every month that has at least one theme active, chronological, for the time axis. */
  monthsCovered: string[];
  computedAt: string | null;
}

const MONTH_FORMAT = /^\d{4}-\d{2}$/;

/** "2026-03" -> "2026-04". Pure calendar math, no Date-string parsing surprises. */
function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Number of calendar months between two "YYYY-MM" strings (b - a), b after a. */
function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number) as [number, number];
  const [by, bm] = b.split("-").map(Number) as [number, number];
  return (by - ay) * 12 + (bm - am);
}

/**
 * The precomputed river. Reads stored clusters only — never triggers a
 * recompute, so opening the view is a plain DB read (see
 * recomputeMindmapForUser for where the work actually happens).
 */
export async function getMyRiver(): Promise<RiverData> {
  const userId = await requireUserId();
  const [clusters, memberships, clusterEntries] = await Promise.all([
    MindmapRepository.listClustersForUser(userId),
    MindmapRepository.listMembershipsForUser(userId),
    MindmapRepository.listClusterEntryDetailsForUser(userId),
  ]);

  if (clusters.length === 0) {
    return {
      themes: [],
      intersections: [],
      insight: null,
      monthsCovered: [],
      computedAt: null,
    };
  }

  const entriesByCluster = new Map<string, typeof clusterEntries>();
  for (const e of clusterEntries) {
    const list = entriesByCluster.get(e.clusterId);
    if (list) list.push(e);
    else entriesByCluster.set(e.clusterId, [e]);
  }

  // Group clusters by exact label — each group is one river path.
  const byLabel = new Map<string, MindmapCluster[]>();
  for (const c of clusters) {
    const list = byLabel.get(c.label);
    if (list) list.push(c);
    else byLabel.set(c.label, [c]);
  }

  const themes: RiverTheme[] = [];
  for (const [label, monthClusters] of byLabel) {
    const sorted = [...monthClusters].sort((a, b) =>
      a.month.localeCompare(b.month),
    );
    const months: RiverMonthPoint[] = sorted
      .filter((c) => MONTH_FORMAT.test(c.month))
      .map((c) => ({
        month: c.month,
        clusterId: c.id,
        entryCount: c.entryCount,
      }));

    const milestones: RiverMilestone[] = [];
    sorted.forEach((cluster, i) => {
      const prev = sorted[i - 1];
      // Contiguous iff the previous active month is the calendar month right
      // before this one — anything wider is a real gap, computed from month
      // strings alone, never guessed.
      const isGapFromPrev = prev
        ? nextMonth(prev.month) !== cluster.month
        : false;
      const inThisMonth = (entriesByCluster.get(cluster.id) ?? [])
        .slice()
        .sort((a, b) => (a.entryDate ?? "").localeCompare(b.entryDate ?? ""));
      inThisMonth.forEach((e, j) => {
        milestones.push({
          clusterId: cluster.id,
          month: cluster.month,
          entryId: e.entryId,
          entryDate: e.entryDate,
          title: e.title,
          snippet: e.snippet
            ? stripFormatting(e.snippet).trim().slice(0, 220)
            : null,
          isFirstAppearance: i === 0 && j === 0,
          // The gap is attributed to the month's first entry only — that's
          // the actual point the theme "picked back up", not every entry in
          // the month that follows it.
          isReturnAfterGap: isGapFromPrev && j === 0,
          previousMonth:
            isGapFromPrev && j === 0 ? (prev?.month ?? null) : null,
        });
      });
    });

    themes.push({
      id: sorted[0]!.id,
      label,
      colorIndex: sorted[0]!.colorIndex,
      // Earliest firstSeenAt across this theme's month-clusters.
      firstSeenAt: sorted.map((c) => c.firstSeenAt.toISOString()).sort()[0]!,
      months,
      milestones,
    });
  }

  themes.sort((a, b) => a.label.localeCompare(b.label));

  const intersections = buildIntersections(clusters, memberships, themes);
  const insight = buildInsight(themes);
  const monthsCovered = [
    ...new Set(themes.flatMap((t) => t.months.map((m) => m.month))),
  ].sort();

  return {
    themes,
    intersections,
    insight,
    monthsCovered,
    computedAt: clusters[0]?.computedAt.toISOString() ?? null,
  };
}

/**
 * Two themes intersect in a month when a real entry belongs to both themes'
 * clusters for that same month — the same evidence the old bubble map's
 * "shared entry" links used, re-shaped to carry the month and the entry ids
 * themselves so the UI can show the supporting entries, not just a line.
 */
function buildIntersections(
  clusters: MindmapCluster[],
  memberships: { clusterId: string; entryId: string }[],
  themes: RiverTheme[],
): RiverIntersection[] {
  const clusterById = new Map(clusters.map((c) => [c.id, c]));
  const labelByClusterId = new Map(
    themes.flatMap((t) => t.months.map((m) => [m.clusterId, t.label] as const)),
  );

  const byEntry = new Map<string, string[]>();
  for (const m of memberships) {
    const list = byEntry.get(m.entryId);
    if (list) list.push(m.clusterId);
    else byEntry.set(m.entryId, [m.clusterId]);
  }

  const grouped = new Map<
    string,
    { month: string; themeA: string; themeB: string; entryIds: Set<string> }
  >();

  for (const [entryId, clusterIds] of byEntry) {
    const valid = clusterIds.filter((id) => clusterById.has(id));
    for (let i = 0; i < valid.length; i++) {
      for (let j = i + 1; j < valid.length; j++) {
        const a = clusterById.get(valid[i]!)!;
        const b = clusterById.get(valid[j]!)!;
        if (a.month !== b.month || a.label === b.label) continue;
        const labelA = labelByClusterId.get(valid[i]!) ?? a.label;
        const labelB = labelByClusterId.get(valid[j]!) ?? b.label;
        const [themeA, themeB] = [labelA, labelB].sort();
        const key = `${a.month}::${themeA}::${themeB}`;
        const existing = grouped.get(key);
        if (existing) existing.entryIds.add(entryId);
        else
          grouped.set(key, {
            month: a.month,
            themeA: themeA!,
            themeB: themeB!,
            entryIds: new Set([entryId]),
          });
      }
    }
  }

  return [...grouped.values()].map((g) => ({
    month: g.month,
    themeA: g.themeA,
    themeB: g.themeB,
    sharedEntryIds: [...g.entryIds],
  }));
}

/**
 * The single evidence-grounded insight the UI may show: the most recent
 * "returned after a gap" moment across all themes. Built purely from the gap
 * data already computed for the river itself — no separate LLM call, no
 * interpretation of why, only what the dates show.
 */
function buildInsight(themes: RiverTheme[]): RiverInsight | null {
  let best: RiverInsight | null = null;
  for (const theme of themes) {
    for (const milestone of theme.milestones) {
      if (!milestone.isReturnAfterGap || !milestone.previousMonth) continue;
      const gapMonths = monthsBetween(milestone.previousMonth, milestone.month);
      if (gapMonths < 2) continue; // "a while" — skip a merely one-month skip
      if (!best || milestone.month > best.returnedMonth) {
        best = {
          kind: "returned_after_gap",
          themeId: theme.id,
          label: theme.label,
          returnedMonth: milestone.month,
          previousMonth: milestone.previousMonth,
          gapMonths,
          entryId: milestone.entryId,
          entryDate: milestone.entryDate,
        };
      }
    }
  }
  return best;
}

export async function getMyCluster(
  clusterId: string,
): Promise<ClusterWithEntries | null> {
  const userId = await requireUserId();
  return MindmapRepository.getClusterWithEntries(clusterId, userId);
}

/**
 * Recomputes the whole map for one user: group embedded entries by month,
 * cluster each month by theme, label each cluster with the LLM, and replace
 * the stored map transactionally.
 *
 * Called in the background after an entry is summarized (see
 * summarization.service.ts) — never on page load. Takes a userId rather than
 * reading the session, because its caller runs inside next/server's after()
 * where there's no request to read from.
 */
export async function recomputeMindmapForUser(userId: string): Promise<void> {
  const [embedded, firstSeen, existingLabels] = await Promise.all([
    MindmapRepository.listEmbeddedEntriesForUser(userId),
    MindmapRepository.getFirstSeenMap(userId),
    MindmapRepository.getLabelsByMembership(userId),
  ]);

  if (embedded.length === 0) {
    await MindmapRepository.replaceForUser(userId, [], firstSeen);
    return;
  }

  const byMonth = new Map<string, EmbeddedEntry[]>();
  for (const e of embedded) {
    const list = byMonth.get(e.month);
    if (list) list.push(e);
    else byMonth.set(e.month, [e]);
  }

  // A theme keeps its shade across recomputes by hashing its label, rather
  // than taking whatever index it landed at this pass — otherwise every node
  // would change color whenever an unrelated new cluster appeared.
  const computed: ComputedCluster[] = [];
  for (const [month, monthEntries] of byMonth) {
    const k = clusterCountFor(monthEntries.length);
    const groups = kMeansCluster(monthEntries, (e) => e.embedding, k);

    for (const group of groups) {
      const entryIds = group.items.map((e) => e.entryId);

      // Reuse the stored label when this exact set of entries was already
      // labeled. Every new entry triggers a recompute, so relabeling every
      // cluster each time would burn the LLM provider's quota (a real 429
      // seen during development) and make labels drift between synonyms even
      // when nothing about the cluster changed.
      // UNLABELED_THEME is never reused: it means a previous labeling attempt
      // failed (a provider error or rate limit), so retrying is the whole
      // point — otherwise one transient 429 would leave a node named "Other"
      // permanently.
      const reused = existingLabels.get(membershipKey(month, entryIds));
      const label =
        reused && reused !== UNLABELED_THEME
          ? reused
          : await labelCluster(
              mostRepresentative(group, (e) => e.embedding, LABEL_SAMPLE_SIZE),
            );

      computed.push({
        label,
        month,
        colorIndex: tintIndexFor(label),
        entryIds,
      });
    }
  }

  await MindmapRepository.replaceForUser(userId, computed, firstSeen);
}

/** Stable label -> tint index, so a given theme always draws in the same shade. */
function tintIndexFor(label: string): number {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % MINDMAP_TINT_COUNT;
}

/**
 * One label for one cluster. A failed or empty LLM call degrades to
 * UNLABELED_THEME rather than throwing — a map with one generically-named
 * node is far better than no map at all, and the next recompute retries.
 */
async function labelCluster(sample: EmbeddedEntry[]): Promise<string> {
  const excerpts = sample
    .map((e) => stripFormatting(e.text ?? "").trim())
    .filter(Boolean);
  if (excerpts.length === 0) return UNLABELED_THEME;

  try {
    const provider = getLLMProvider();
    const { text } = await provider.complete(buildThemeLabelMessages(excerpts));
    return parseThemeLabel(text);
  } catch (err) {
    console.error("Theme labeling failed for a cluster:", err);
    return UNLABELED_THEME;
  }
}
