import { createHash } from "node:crypto";

/**
 * Splitting entries into embedding chunks, and the text each chunk is
 * embedded (and searched, and shown to the model) as. Pure functions: no
 * I/O, so they are unit-tested directly (chunker.test.ts).
 *
 * Bump CHUNKER_VERSION whenever the output of anything here changes for the
 * same input. It is part of the content hash, so a bump makes every entry
 * re-chunk (and re-embed) on its next index pass — which is exactly what a
 * changed chunker needs, and nothing else ever causes it.
 */
export const CHUNKER_VERSION = "chunker-v1";

/** Approximation, not a tokenizer: ~4 characters per token for English, and
 * conservative (over-counts) for Bangla/Urdu script. The project has no
 * tokenizer dependency; chunk sizes only need to be roughly right. */
const CHARS_PER_TOKEN = 4;

/** Entries at or under this stay ONE chunk. */
export const SINGLE_CHUNK_MAX_TOKENS = 500;
/** Packing target for multi-chunk entries… */
export const TARGET_CHUNK_TOKENS = 400;
/** …and the hard ceiling for one chunk (before tail merging). */
export const MAX_CHUNK_TOKENS = 500;
/** Whole sentences carried from the end of one chunk into the next. */
export const OVERLAP_TOKENS = 50;
/** A final chunk smaller than this is merged into the one before it. */
export const MIN_TAIL_TOKENS = 120;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

interface Unit {
  text: string;
  tokens: number;
  /** Starts a new paragraph (joined with a blank line, not a space). */
  paragraphStart: boolean;
}

// A sentence ends at . ! ? … or the Bangla danda (।) / Urdu full stop (۔),
// plus any closing quotes/brackets, followed by whitespace.
const SENTENCE_END = /(?<=[.!?…।۔]["'”’)\]]*)\s+/u;

function splitLongSentence(sentence: string): string[] {
  const words = sentence.split(/\s+/).filter(Boolean);
  const pieces: string[] = [];
  let current: string[] = [];
  let length = 0;
  for (const word of words) {
    const extra = word.length + (current.length ? 1 : 0);
    if (
      current.length &&
      estimateTokens("x".repeat(length + extra)) > MAX_CHUNK_TOKENS
    ) {
      pieces.push(current.join(" "));
      current = [];
      length = 0;
    }
    current.push(word);
    length += word.length + (current.length > 1 ? 1 : 0);
  }
  if (current.length) pieces.push(current.join(" "));
  return pieces;
}

function toUnits(text: string): Unit[] {
  const units: Unit[] = [];
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  for (const paragraph of paragraphs) {
    const sentences = paragraph.split(SENTENCE_END).filter(Boolean);
    let first = true;
    for (const sentence of sentences) {
      const parts =
        estimateTokens(sentence) > MAX_CHUNK_TOKENS
          ? splitLongSentence(sentence)
          : [sentence];
      for (const part of parts) {
        units.push({
          text: part,
          tokens: estimateTokens(part),
          paragraphStart: first,
        });
        first = false;
      }
    }
  }
  return units;
}

function render(units: Unit[], from: number, to: number): string {
  let out = "";
  for (let i = from; i <= to; i++) {
    const u = units[i]!;
    if (i > from) out += u.paragraphStart ? "\n\n" : " ";
    out += u.text;
  }
  return out;
}

/**
 * Splits plain text (already through stripFormatting) into chunks: one chunk
 * when short, otherwise ~400-token chunks on paragraph then sentence
 * boundaries (never mid-word), each starting with the last ~50 tokens of
 * whole sentences from the previous chunk, and no tiny trailing chunk.
 */
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  if (estimateTokens(normalized) <= SINGLE_CHUNK_MAX_TOKENS) {
    // Whitespace tidied the same way as multi-chunk output.
    const units = toUnits(normalized);
    return [render(units, 0, units.length - 1)];
  }

  const units = toUnits(normalized);
  const spans: { from: number; to: number }[] = [];
  let from = 0;
  while (from < units.length) {
    let to = from;
    let tokens = units[from]!.tokens;
    while (
      to + 1 < units.length &&
      tokens + units[to + 1]!.tokens <= TARGET_CHUNK_TOKENS
    ) {
      to += 1;
      tokens += units[to]!.tokens;
    }
    spans.push({ from, to });
    if (to + 1 >= units.length) break;

    // Next chunk starts with trailing whole sentences of this one, up to the
    // overlap budget, but always advances by at least one unit.
    let next = to + 1;
    let overlap = 0;
    while (
      next - 1 > from &&
      overlap + units[next - 1]!.tokens <= OVERLAP_TOKENS
    ) {
      next -= 1;
      overlap += units[next]!.tokens;
    }
    from = next;
  }

  // Merge a small final chunk into the previous one (dropping its overlap,
  // which the previous chunk already contains).
  if (spans.length > 1) {
    const last = spans[spans.length - 1]!;
    const lastTokens = estimateTokens(render(units, last.from, last.to));
    if (lastTokens < MIN_TAIL_TOKENS) {
      spans.pop();
      spans[spans.length - 1]!.to = last.to;
    }
  }

  return spans.map((s) => render(units, s.from, s.to));
}

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** "Date: 2025-03-14 (Friday)" — fixed, human-readable, searchable. */
export function datePrefix(entryDate: string | null): string {
  if (!entryDate || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return "Date: unknown";
  }
  const [y, m, d] = entryDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `Date: ${entryDate} (${weekday})`;
}

/**
 * The exact text stored for, embedded for, keyword-indexed for, and shown to
 * the model for one chunk: the date line, a blank line, then the chunk. One
 * string for all four uses, so they can never drift apart.
 *
 * The title is deliberately NOT included: a new entry's title is usually
 * auto-derived from its own first sentence after the summary lands, so
 * embedding it would re-embed (and spend quota on) every new entry twice
 * for no new information. Citations show the title from `entries` instead.
 */
export function chunkContent(chunk: string, entryDate: string | null): string {
  return `${datePrefix(entryDate)}\n\n${chunk}`;
}

/**
 * SHA-256 over everything that affects what gets embedded: chunker version,
 * date and the stripped plain text. Equal hash = nothing to do (a
 * formatting-only edit strips to the same text, so it costs no API call).
 */
export function contentHash(
  plainText: string,
  entryDate: string | null,
): string {
  return createHash("sha256")
    .update([CHUNKER_VERSION, entryDate ?? "", plainText].join("\u0000"))
    .digest("hex");
}

export interface PreparedChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

/** Plain text -> the chunks to store, each with its final content. */
export function prepareChunks(
  plainText: string,
  entryDate: string | null,
): PreparedChunk[] {
  return chunkText(plainText).map((chunk, chunkIndex) => {
    const content = chunkContent(chunk, entryDate);
    return { chunkIndex, content, tokenCount: estimateTokens(content) };
  });
}
