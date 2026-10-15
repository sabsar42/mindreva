/**
 * Reuses one signed URL per Storage object for as long as it stays valid.
 *
 * Every server render and every /api/entries/thumbnails call signs photos
 * afresh, and each signature carries a new token, so the same photo arrived
 * under a different URL on every visit. The browser keys its image cache by
 * URL, so it re-downloaded the full file each time (measured on the live
 * deploy: one 2.4MB photo fetched three times in three visits, ~1-2s each).
 * Handing back the first URL seen for an object keeps it a cache hit for the
 * rest of the session, until the token is close to expiring.
 *
 * Browser-only on purpose: a module-level map on the server would be shared
 * across users and requests, so on the server every call is a pass-through.
 */

// Swap to a fresh URL this long before the cached one's token expires, so an
// image never starts loading on a URL that dies mid-session.
const MIN_REMAINING_MS = 5 * 60 * 1000;

const byObject = new Map<string, { url: string; expiresAt: number }>();
const thumbnailByEntry = new Map<string, string>();

/** The signed URL's Storage path, without the per-signature token. */
function objectKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.has("token") ? parsed.pathname : null;
  } catch {
    return null;
  }
}

/** Expiry (ms) from the signed URL's token, a JWT with an `exp` claim. */
function tokenExpiresAt(url: string): number | null {
  try {
    const token = new URL(url).searchParams.get("token");
    const payload = token?.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function isFresh(entry: { expiresAt: number }): boolean {
  return entry.expiresAt - Date.now() > MIN_REMAINING_MS;
}

/**
 * The URL to render for a signed photo URL: the one already handed out for
 * the same object if it's still valid, otherwise this one (now remembered).
 * Anything that isn't a signed Storage URL (default artwork) passes through.
 */
export function stablePhotoUrl(url: string): string {
  if (typeof window === "undefined") return url;
  const key = objectKey(url);
  if (!key) return url;
  const cached = byObject.get(key);
  if (cached && isFresh(cached)) return cached.url;
  const expiresAt = tokenExpiresAt(url);
  if (expiresAt !== null) byObject.set(key, { url, expiresAt });
  return url;
}

/** Cover thumbnails already known for list rows, keyed by entry id. Only
 * entries whose URL is still fresh are returned. */
export function knownEntryThumbnails(
  entryIds: string[],
): Record<string, string> {
  const known: Record<string, string> = {};
  for (const id of entryIds) {
    const url = thumbnailByEntry.get(id);
    const key = url ? objectKey(url) : null;
    const entry = key ? byObject.get(key) : undefined;
    if (url && entry && isFresh(entry)) known[id] = url;
  }
  return known;
}

/** Remember an entry's list thumbnail (and route it through the object
 * cache). Call this whenever an entry's cover changes, so the list never
 * shows the old one from memory. Returns the URL to render. */
export function rememberEntryThumbnail(entryId: string, url: string): string {
  const stable = stablePhotoUrl(url);
  if (typeof window !== "undefined") {
    thumbnailByEntry.set(entryId, stable);
    entriesWithoutCover.delete(entryId);
  }
  return stable;
}

// Entries known (this session) to have no cover, so a revisit can show the
// default artwork immediately instead of a placeholder that then swaps.
const entriesWithoutCover = new Set<string>();

export function rememberNoCover(entryId: string): void {
  if (typeof window !== "undefined") entriesWithoutCover.add(entryId);
}

export function isKnownWithoutCover(entryId: string): boolean {
  return entriesWithoutCover.has(entryId);
}
