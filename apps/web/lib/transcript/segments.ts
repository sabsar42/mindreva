/**
 * Turning raw recognizer segments into something readable and navigable.
 *
 * ASR segments are short (often 2-8 seconds), which is too fine-grained to read
 * as a transcript. These helpers merge neighbours into blocks of roughly half a
 * minute, format times, and map a typed timestamp to the block that contains it.
 * Pure functions; no audio is involved anywhere.
 */

export interface Segment {
  text: string;
  startMs: number;
  endMs: number;
}

export interface TranscriptBlock {
  /** Index in the grouped list, used as the element id for jumping. */
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

/** 0 -> "0:00", 65_000 -> "1:05", 3_725_000 -> "1:02:05". */
export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}

/** "0:19 – 0:42". */
export function formatRange(startMs: number, endMs: number): string {
  return `${formatTimestamp(startMs)} – ${formatTimestamp(endMs)}`;
}

/**
 * Parses what a person types into a "Jump to" field: "75", "1:15", "01:15" or
 * "1:02:05". Returns milliseconds, or null when it isn't a time.
 */
export function parseTimestamp(input: string): number | null {
  const value = input.trim();
  if (!/^\d+(:\d{1,2}){0,2}$/.test(value)) return null;
  const parts = value.split(":").map(Number);
  if (parts.length === 1) return parts[0]! * 1000;
  if (parts.length === 2) {
    const [m, s] = parts as [number, number];
    if (s >= 60) return null;
    return (m * 60 + s) * 1000;
  }
  const [h, m, s] = parts as [number, number, number];
  if (m >= 60 || s >= 60) return null;
  return (h * 3600 + m * 60 + s) * 1000;
}

/**
 * Merges consecutive segments into blocks until a block spans at least
 * `targetMs`. Segments are sorted and empty ones dropped first, so the output
 * is always chronological and every block has text.
 */
export function groupSegments(
  segments: Segment[],
  targetMs = 30_000,
): TranscriptBlock[] {
  const ordered = segments
    .filter((s) => s.text.trim().length > 0)
    .sort((a, b) => a.startMs - b.startMs);

  const blocks: TranscriptBlock[] = [];
  let current: { startMs: number; endMs: number; parts: string[] } | null =
    null;

  const close = () => {
    if (!current) return;
    blocks.push({
      index: blocks.length,
      startMs: current.startMs,
      endMs: current.endMs,
      text: current.parts.join(" "),
    });
    current = null;
  };

  for (const segment of ordered) {
    if (!current) {
      current = {
        startMs: segment.startMs,
        endMs: segment.endMs,
        parts: [segment.text.trim()],
      };
    } else {
      current.endMs = Math.max(current.endMs, segment.endMs);
      current.parts.push(segment.text.trim());
    }
    if (current.endMs - current.startMs >= targetMs) close();
  }
  close();
  return blocks;
}

/**
 * The block to show for a requested time: the one containing it, else the
 * latest block that starts before it, else the first. Null when there are none.
 */
export function findBlockAt(
  blocks: TranscriptBlock[],
  ms: number,
): TranscriptBlock | null {
  if (blocks.length === 0) return null;
  let found: TranscriptBlock = blocks[0]!;
  for (const block of blocks) {
    if (block.startMs <= ms) found = block;
    else break;
  }
  return found;
}
