/**
 * Undo an optimistic removal: put `id` back where it was in `snapshot`
 * (the list before the removal), relative to whatever is in the list now.
 * Items that arrived or left in the meantime are kept as they are. A no-op
 * when the item is already back (e.g. a refresh restored it first).
 */
export function restoreRemoved<T extends { id: string }>(
  snapshot: readonly T[],
  current: readonly T[],
  id: string,
): T[] {
  const index = snapshot.findIndex((e) => e.id === id);
  const item = snapshot[index];
  if (!item || current.some((e) => e.id === id)) return [...current];

  // Insert right after the last item that preceded it originally.
  const before = new Set(snapshot.slice(0, index).map((e) => e.id));
  let at = 0;
  current.forEach((e, i) => {
    if (before.has(e.id)) at = i + 1;
  });
  return [...current.slice(0, at), item, ...current.slice(at)];
}

/** True when the request reached the server and succeeded. */
export async function requestOk(input: string, init: RequestInit) {
  try {
    return (await fetch(input, init)).ok;
  } catch {
    return false; // offline / network error
  }
}
