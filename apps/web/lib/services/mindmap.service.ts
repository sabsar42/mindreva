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

export interface MindmapNode {
  id: string;
  label: string;
  month: string;
  entryCount: number;
  colorIndex: number;
  /** ISO timestamp of when this theme first appeared — the UI fades in nodes newer than the user's last visit. */
  firstSeenAt: string;
}

export interface MindmapGraph {
  nodes: MindmapNode[];
  /** Undirected links between clusters that share at least one entry. */
  links: { source: string; target: string; weight: number }[];
  computedAt: string | null;
}

/**
 * The precomputed graph. Reads stored clusters only — never triggers a
 * recompute, so opening the map is a plain DB read (see recomputeMindmap for
 * where the work actually happens).
 */
export async function getMyMindmap(): Promise<MindmapGraph> {
  const userId = await requireUserId();
  const [clusters, memberships] = await Promise.all([
    MindmapRepository.listClustersForUser(userId),
    MindmapRepository.listMembershipsForUser(userId),
  ]);

  return {
    nodes: clusters.map(toNode),
    links: buildLinks(clusters, memberships),
    computedAt: clusters[0]?.computedAt.toISOString() ?? null,
  };
}

function toNode(c: MindmapCluster): MindmapNode {
  return {
    id: c.id,
    label: c.label,
    month: c.month,
    entryCount: c.entryCount,
    colorIndex: c.colorIndex,
    firstSeenAt: c.firstSeenAt.toISOString(),
  };
}

/**
 * Links two clusters when they share entries. With one cluster per
 * (theme, month), a shared entry means the same writing fed two themes — which
 * is exactly the connection worth drawing on a map of how topics relate.
 */
function buildLinks(
  clusters: MindmapCluster[],
  memberships: { clusterId: string; entryId: string }[],
): { source: string; target: string; weight: number }[] {
  const byEntry = new Map<string, string[]>();
  for (const m of memberships) {
    const list = byEntry.get(m.entryId);
    if (list) list.push(m.clusterId);
    else byEntry.set(m.entryId, [m.clusterId]);
  }

  const known = new Set(clusters.map((c) => c.id));
  const weights = new Map<string, number>();
  for (const clusterIds of byEntry.values()) {
    const valid = clusterIds.filter((id) => known.has(id));
    for (let i = 0; i < valid.length; i++) {
      for (let j = i + 1; j < valid.length; j++) {
        // Sorted key so A-B and B-A are the same undirected link.
        const key = [valid[i]!, valid[j]!].sort().join("::");
        weights.set(key, (weights.get(key) ?? 0) + 1);
      }
    }
  }

  return [...weights.entries()].map(([key, weight]) => {
    const [source, target] = key.split("::");
    return { source: source!, target: target!, weight };
  });
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
    const raw = await provider.complete(buildThemeLabelMessages(excerpts));
    return parseThemeLabel(raw);
  } catch (err) {
    console.error("Theme labeling failed for a cluster:", err);
    return UNLABELED_THEME;
  }
}
