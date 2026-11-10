import { and, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../client";
import { primaryTranscriptText } from "./primary-transcript";
import {
  embeddings,
  entries,
  mindmapClusterEntries,
  mindmapClusters,
  type MindmapCluster,
} from "../schema";

/** An entry with its vector, the raw material clustering runs over. */
export interface EmbeddedEntry {
  entryId: string;
  entryDate: string;
  /** "YYYY-MM", derived from entryDate. */
  month: string;
  text: string | null;
  embedding: number[];
}

export interface ClusterWithEntries extends MindmapCluster {
  entries: {
    entryId: string;
    entryDate: string | null;
    title: string | null;
    snippet: string | null;
  }[];
}

/** One cluster's computed shape, before it's persisted. */
export interface ComputedCluster {
  label: string;
  month: string;
  colorIndex: number;
  entryIds: string[];
}

/**
 * Identity of a cluster by what's actually in it. Sorted so membership order
 * (which k-means doesn't guarantee) never changes the key.
 */
export function membershipKey(month: string, entryIds: string[]): string {
  return `${month}::${[...entryIds].sort().join(",")}`;
}

export const MindmapRepository = {
  /**
   * Every active entry that has an embedding, with its vector — the input to
   * clustering. Entries without embeddings are simply absent (they haven't
   * been summarized yet); they'll join the map on the next recompute after
   * their embedding lands.
   */
  async listEmbeddedEntriesForUser(userId: string): Promise<EmbeddedEntry[]> {
    const rows = await getDb()
      .select({
        entryId: embeddings.entryId,
        entryDate: entries.entryDate,
        chunkText: embeddings.chunkText,
        // pgvector returns the vector as its text literal ("[1,2,3]") over the
        // wire; parsed below rather than in SQL.
        embedding: sql<string>`${embeddings.embedding}::text`,
      })
      .from(embeddings)
      .innerJoin(entries, eq(entries.id, embeddings.entryId))
      .where(
        and(
          eq(entries.userId, userId),
          isNull(entries.deletedAt),
          isNull(entries.archivedAt),
          isNotNull(entries.entryDate),
          isNotNull(embeddings.embedding),
        ),
      );

    return rows
      .filter((r) => r.entryDate && r.embedding)
      .map((r) => ({
        entryId: r.entryId,
        entryDate: r.entryDate!,
        month: r.entryDate!.slice(0, 7),
        text: r.chunkText,
        embedding: JSON.parse(r.embedding) as number[],
      }));
  },

  /** Existing label+month -> firstSeenAt, so a recompute can preserve when a theme first appeared. */
  async getFirstSeenMap(userId: string): Promise<Map<string, Date>> {
    const rows = await getDb()
      .select({
        label: mindmapClusters.label,
        month: mindmapClusters.month,
        firstSeenAt: mindmapClusters.firstSeenAt,
      })
      .from(mindmapClusters)
      .where(eq(mindmapClusters.userId, userId));
    return new Map(rows.map((r) => [`${r.month}::${r.label}`, r.firstSeenAt]));
  },

  /**
   * Existing clusters keyed by their exact entry membership, so a recompute
   * can reuse a label it already paid an LLM call for. Without this, every
   * new entry would relabel every cluster the user has — which burns the
   * provider's quota and makes labels flicker between synonyms on each
   * refresh even when a cluster's contents didn't change.
   */
  async getLabelsByMembership(userId: string): Promise<Map<string, string>> {
    const rows = await getDb()
      .select({
        clusterId: mindmapClusters.id,
        label: mindmapClusters.label,
        month: mindmapClusters.month,
        entryId: mindmapClusterEntries.entryId,
      })
      .from(mindmapClusters)
      .leftJoin(
        mindmapClusterEntries,
        eq(mindmapClusterEntries.clusterId, mindmapClusters.id),
      )
      .where(eq(mindmapClusters.userId, userId));

    const grouped = new Map<
      string,
      { label: string; month: string; entryIds: string[] }
    >();
    for (const r of rows) {
      const existing = grouped.get(r.clusterId);
      if (existing) {
        if (r.entryId) existing.entryIds.push(r.entryId);
      } else {
        grouped.set(r.clusterId, {
          label: r.label,
          month: r.month,
          entryIds: r.entryId ? [r.entryId] : [],
        });
      }
    }

    return new Map(
      [...grouped.values()].map((c) => [
        membershipKey(c.month, c.entryIds),
        c.label,
      ]),
    );
  },

  /**
   * Replaces the user's whole map in one transaction. Clusters are recomputed
   * wholesale rather than diffed — the dataset is small and a partial map is
   * worse than a slightly stale one. `firstSeenAt` carries over for any
   * label+month that already existed, so only genuinely-new nodes read as new
   * to the UI's fade-in.
   */
  async replaceForUser(
    userId: string,
    clusters: ComputedCluster[],
    firstSeen: Map<string, Date>,
  ): Promise<void> {
    await getDb().transaction(async (tx) => {
      // Cascades to mindmap_cluster_entries.
      await tx
        .delete(mindmapClusters)
        .where(eq(mindmapClusters.userId, userId));

      for (const c of clusters) {
        const key = `${c.month}::${c.label}`;
        const inserted = await tx
          .insert(mindmapClusters)
          .values({
            userId,
            label: c.label,
            month: c.month,
            entryCount: c.entryIds.length,
            colorIndex: c.colorIndex,
            firstSeenAt: firstSeen.get(key) ?? new Date(),
          })
          .returning({ id: mindmapClusters.id });

        const clusterId = inserted[0]!.id;
        if (c.entryIds.length > 0) {
          await tx.insert(mindmapClusterEntries).values(
            c.entryIds.map((entryId) => ({
              clusterId,
              entryId,
            })),
          );
        }
      }
    });
  },

  async listClustersForUser(userId: string): Promise<MindmapCluster[]> {
    return getDb()
      .select()
      .from(mindmapClusters)
      .where(eq(mindmapClusters.userId, userId))
      .orderBy(mindmapClusters.month, mindmapClusters.label);
  },

  /**
   * Every entry inside every one of this user's clusters, in one query —
   * the raw material for the river view's milestones (one dot per real
   * entry) and its cross-theme intersections. Unlike getClusterWithEntries
   * (one cluster at a time, for the old tap-a-node sheet), this fetches the
   * whole user's cluster membership at once since the river needs all of it
   * to lay out every theme's path.
   */
  async listClusterEntryDetailsForUser(userId: string): Promise<
    {
      clusterId: string;
      entryId: string;
      entryDate: string | null;
      title: string | null;
      snippet: string | null;
    }[]
  > {
    return getDb()
      .select({
        clusterId: mindmapClusterEntries.clusterId,
        entryId: entries.id,
        entryDate: entries.entryDate,
        title: entries.title,
        snippet: primaryTranscriptText,
      })
      .from(mindmapClusterEntries)
      .innerJoin(
        mindmapClusters,
        eq(mindmapClusters.id, mindmapClusterEntries.clusterId),
      )
      .innerJoin(entries, eq(entries.id, mindmapClusterEntries.entryId))
      .where(and(eq(mindmapClusters.userId, userId), isNull(entries.deletedAt)))
      .orderBy(entries.entryDate);
  },

  /** A single cluster with the entries inside it — what tapping a node opens. */
  async getClusterWithEntries(
    clusterId: string,
    userId: string,
  ): Promise<ClusterWithEntries | null> {
    const clusterRows = await getDb()
      .select()
      .from(mindmapClusters)
      .where(
        and(
          eq(mindmapClusters.id, clusterId),
          eq(mindmapClusters.userId, userId),
        ),
      )
      .limit(1);
    const cluster = clusterRows[0];
    if (!cluster) return null;

    const entryRows = await getDb()
      .select({
        entryId: entries.id,
        entryDate: entries.entryDate,
        title: entries.title,
        snippet: primaryTranscriptText,
      })
      .from(mindmapClusterEntries)
      .innerJoin(entries, eq(entries.id, mindmapClusterEntries.entryId))
      .where(
        and(
          eq(mindmapClusterEntries.clusterId, clusterId),
          isNull(entries.deletedAt),
        ),
      )
      .orderBy(entries.entryDate);

    return { ...cluster, entries: entryRows };
  },

  /** Entry ids per cluster, for building the graph's shared-entry links. */
  async listMembershipsForUser(
    userId: string,
  ): Promise<{ clusterId: string; entryId: string }[]> {
    const clusterIds = await getDb()
      .select({ id: mindmapClusters.id })
      .from(mindmapClusters)
      .where(eq(mindmapClusters.userId, userId));
    if (clusterIds.length === 0) return [];

    return getDb()
      .select({
        clusterId: mindmapClusterEntries.clusterId,
        entryId: mindmapClusterEntries.entryId,
      })
      .from(mindmapClusterEntries)
      .where(
        inArray(
          mindmapClusterEntries.clusterId,
          clusterIds.map((c) => c.id),
        ),
      );
  },
};
