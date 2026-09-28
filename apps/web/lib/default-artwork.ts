const ARTWORKS = [
  "/defaults/sunset.svg",
  "/defaults/hills.svg",
  "/defaults/forest.svg",
  "/defaults/coffee.svg",
  "/defaults/mountain.svg",
  "/defaults/waves.svg",
] as const;

const ARTWORKS_WIDE = [
  "/defaults/sunset-wide.svg",
  "/defaults/hills-wide.svg",
  "/defaults/forest-wide.svg",
  "/defaults/coffee-wide.svg",
  "/defaults/mountain-wide.svg",
  "/defaults/waves-wide.svg",
] as const;

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

/** Wide artwork (400×160 viewBox) for full-width hero images on entry detail. */
export function getDefaultArtworkWide(seed: string): string {
  return ARTWORKS_WIDE[hashSeed(seed) % ARTWORKS_WIDE.length]!;
}
