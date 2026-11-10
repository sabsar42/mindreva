/**
 * The pictures an entry gets until it has a photo of its own: airy, abstract
 * pieces (twelve of them, for variety) on off-white grounds in the app's mint, deep green and sand. Square
 * for card thumbnails and day cells, wide (400×200) for the entry hero.
 * Entries without a photo pick one by a hash of their id, so each keeps its
 * picture. (Renaming a file here also busts browser caches of the old art.)
 */
const NAMES = [
  "arches",
  "sprig",
  "ripple",
  "bloom",
  "contours",
  "petals",
  "dunes",
  "stems",
  "moons",
  "tiles",
  "sunrise",
  "orbit",
] as const;

const ARTWORKS = NAMES.map((n) => `/defaults/${n}.svg`);
const ARTWORKS_WIDE = NAMES.map((n) => `/defaults/${n}-wide.svg`);

function hashSeed(seed: string): number {
  // FNV-1a plus a final avalanche, so ids that differ in a few characters
  // still spread across every picture instead of clustering on a few.
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

/** Square artwork for NoteCard thumbnails and calendar day cells. */
export function getDefaultArtwork(seed: string): string {
  return ARTWORKS[hashSeed(seed) % ARTWORKS.length]!;
}

/** Wide artwork (400×200 viewBox) for full-width hero images on entry detail. */
export function getDefaultArtworkWide(seed: string): string {
  return ARTWORKS_WIDE[hashSeed(seed) % ARTWORKS_WIDE.length]!;
}
