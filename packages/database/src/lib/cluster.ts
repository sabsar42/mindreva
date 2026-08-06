/**
 * Theme clustering for the mindmap view. Pure functions over embedding
 * vectors — no database or LLM access, so this is directly testable and
 * cheap to re-run.
 *
 * Deliberately simple: spherical k-means (cosine distance) over the entries
 * of a single month, with k derived from the month's entry count. The scale
 * this app operates at (tens of entries per month, not millions) doesn't
 * justify anything heavier, and the result only needs to be a stable,
 * sensible grouping — it's a reflective map, not a precision instrument.
 */

/** Cosine similarity. Vectors are assumed non-empty and equal length. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function meanVector(vectors: number[][]): number[] {
  const dims = vectors[0]!.length;
  const out = new Array<number>(dims).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dims; i++) out[i]! += v[i]!;
  }
  for (let i = 0; i < dims; i++) out[i]! /= vectors.length;
  return out;
}

/**
 * How many themes to look for in a month with `n` entries. Roughly sqrt(n),
 * clamped: one entry can't form two themes, and past ~4 clusters a single
 * month's map stops being readable at a glance.
 */
export function clusterCountFor(n: number): number {
  if (n <= 2) return 1;
  return Math.max(1, Math.min(4, Math.round(Math.sqrt(n))));
}

/**
 * Deterministic seeding (k-means++ style, but with a fixed first pick rather
 * than a random one): start from the first item, then repeatedly take the
 * item furthest from everything chosen so far. Determinism matters here —
 * the map is recomputed on every new entry, and random seeding would reshuffle
 * a user's themes on each refresh even when nothing meaningful changed.
 */
function seedCentroids(vectors: number[][], k: number): number[][] {
  const centroids: number[][] = [vectors[0]!];
  while (centroids.length < k) {
    let furthestIdx = 0;
    let furthestDist = -Infinity;
    for (let i = 0; i < vectors.length; i++) {
      // Distance to the nearest already-chosen centroid.
      let nearest = Infinity;
      for (const c of centroids) {
        const d = 1 - cosineSimilarity(vectors[i]!, c);
        if (d < nearest) nearest = d;
      }
      if (nearest > furthestDist) {
        furthestDist = nearest;
        furthestIdx = i;
      }
    }
    centroids.push(vectors[furthestIdx]!);
  }
  return centroids;
}

export interface ClusterAssignment<T> {
  items: T[];
  centroid: number[];
}

/**
 * Groups items into at most `k` clusters by cosine distance between their
 * vectors. Empty clusters are dropped, so the result may contain fewer than
 * `k` groups.
 */
export function kMeansCluster<T>(
  items: T[],
  vectorOf: (item: T) => number[],
  k: number,
  maxIterations = 25,
): ClusterAssignment<T>[] {
  if (items.length === 0) return [];
  if (k <= 1 || items.length <= 1) {
    return [{ items: [...items], centroid: meanVector(items.map(vectorOf)) }];
  }

  const vectors = items.map(vectorOf);
  const effectiveK = Math.min(k, items.length);
  let centroids = seedCentroids(vectors, effectiveK);
  const assignments = new Array<number>(items.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    for (let i = 0; i < vectors.length; i++) {
      let best = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const sim = cosineSimilarity(vectors[i]!, centroids[c]!);
        if (sim > bestSim) {
          bestSim = sim;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }

    const grouped: number[][][] = Array.from(
      { length: centroids.length },
      () => [],
    );
    for (let i = 0; i < vectors.length; i++) {
      grouped[assignments[i]!]!.push(vectors[i]!);
    }
    centroids = centroids.map((prev, c) =>
      grouped[c]!.length > 0 ? meanVector(grouped[c]!) : prev,
    );

    if (!changed) break;
  }

  const out: ClusterAssignment<T>[] = centroids.map((centroid) => ({
    items: [],
    centroid,
  }));
  for (let i = 0; i < items.length; i++) {
    out[assignments[i]!]!.items.push(items[i]!);
  }
  return out.filter((c) => c.items.length > 0);
}

/**
 * The entries closest to a cluster's centroid — the most representative of
 * its theme. Used to give the LLM a small, high-signal sample to label from
 * rather than every entry in the cluster.
 */
export function mostRepresentative<T>(
  cluster: ClusterAssignment<T>,
  vectorOf: (item: T) => number[],
  limit: number,
): T[] {
  return [...cluster.items]
    .map((item) => ({
      item,
      sim: cosineSimilarity(vectorOf(item), cluster.centroid),
    }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, limit)
    .map((x) => x.item);
}
