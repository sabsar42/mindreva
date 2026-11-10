/**
 * The pictures an entry gets until it has a photo of its own: airy, abstract
 * pieces on off-white grounds in the app's mint, deep green and sand. Square
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
] as const;

const ARTWORKS = NAMES.map((n) => `/defaults/${n}.svg`);
const ARTWORKS_WIDE = NAMES.map((n) => `/defaults/${n}-wide.svg`);

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Square artwork for NoteCard thumbnails and calendar day cells. */
export function getDefaultArtwork(seed: string): string {
  return ARTWORKS[hashSeed(seed) % ARTWORKS.length]!;
}

/** Wide artwork (400×200 viewBox) for full-width hero images on entry detail. */
export function getDefaultArtworkWide(seed: string): string {
  return ARTWORKS_WIDE[hashSeed(seed) % ARTWORKS_WIDE.length]!;
}
