import { describe, expect, it } from "vitest";
import {
  MAX_CHUNK_TOKENS,
  MIN_TAIL_TOKENS,
  SINGLE_CHUNK_MAX_TOKENS,
  chunkContent,
  chunkText,
  contentHash,
  datePrefix,
  estimateTokens,
  prepareChunks,
} from "./chunker";

function sentence(i: number): string {
  return `This is sentence number ${i} about walking by the river with Priya.`;
}
function paragraphs(count: number, sentencesEach: number): string {
  let n = 0;
  return Array.from({ length: count }, () =>
    Array.from({ length: sentencesEach }, () => sentence(n++)).join(" "),
  ).join("\n\n");
}

describe("estimateTokens", () => {
  it("is characters / 4, rounded up", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });
});

describe("chunkText", () => {
  it("returns nothing for empty text", () => {
    expect(chunkText("   \n ")).toEqual([]);
  });

  it("keeps an entry at or under the single-chunk limit as one chunk", () => {
    const text = paragraphs(2, 10); // ~340 tokens
    expect(estimateTokens(text)).toBeLessThanOrEqual(SINGLE_CHUNK_MAX_TOKENS);
    expect(chunkText(text)).toHaveLength(1);
  });

  it("splits a long entry into several chunks under the ceiling", () => {
    const text = paragraphs(12, 8); // ~1600 tokens
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) {
      expect(estimateTokens(c)).toBeLessThanOrEqual(
        MAX_CHUNK_TOKENS + MIN_TAIL_TOKENS,
      );
    }
  });

  it("never cuts a word, and every sentence survives", () => {
    const text = paragraphs(12, 8);
    const joined = chunkText(text).join(" ");
    for (let i = 0; i < 96; i++) expect(joined).toContain(sentence(i));
  });

  it("overlaps consecutive chunks by whole sentences", () => {
    const chunks = chunkText(paragraphs(12, 8));
    for (let i = 1; i < chunks.length; i++) {
      const prevLast = chunks[i - 1]!.split(/(?<=\.)\s+/).at(-1)!;
      expect(
        chunks[i]!.startsWith(prevLast) || chunks[i]!.includes(prevLast),
      ).toBe(true);
    }
  });

  it("never leaves a tiny trailing chunk", () => {
    // Long body plus a short last line that would otherwise be its own chunk.
    const text = `${paragraphs(10, 8)}\n\nShort ending.`;
    const chunks = chunkText(text);
    expect(estimateTokens(chunks.at(-1)!)).toBeGreaterThanOrEqual(
      MIN_TAIL_TOKENS,
    );
    expect(chunks.at(-1)!).toContain("Short ending.");
  });

  it("splits Bangla/Urdu sentences on their own full stops", () => {
    const bn = Array.from(
      { length: 150 },
      (_, i) => `আমি আজ নদীর ধারে হাঁটলাম ${i}।`,
    ).join(" ");
    const chunks = chunkText(bn);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.endsWith("।")).toBe(true);
  });

  it("breaks a giant sentence on word boundaries", () => {
    const words = Array.from({ length: 900 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(words);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c).toMatch(/^word\d+( word\d+)*$/);
    }
  });
});

describe("chunk content and hash", () => {
  it("prefixes a fixed, readable date line", () => {
    expect(datePrefix("2025-03-14")).toBe("Date: 2025-03-14 (Friday)");
    expect(datePrefix(null)).toBe("Date: unknown");
    expect(chunkContent("Body.", "2025-03-14")).toBe(
      "Date: 2025-03-14 (Friday)\n\nBody.",
    );
  });

  it("hashes the same for the same text and changes with text or date", () => {
    const base = contentHash("hello", "2025-03-14");
    expect(contentHash("hello", "2025-03-14")).toBe(base);
    expect(contentHash("hello!", "2025-03-14")).not.toBe(base);
    expect(contentHash("hello", "2025-03-15")).not.toBe(base);
  });

  it("numbers chunks and counts tokens on the final content", () => {
    const prepared = prepareChunks(paragraphs(12, 8), "2025-03-14");
    expect(prepared.map((c) => c.chunkIndex)).toEqual(
      prepared.map((_, i) => i),
    );
    for (const c of prepared) {
      expect(c.content.startsWith("Date: 2025-03-14 (Friday)\n\n")).toBe(true);
      expect(c.tokenCount).toBe(estimateTokens(c.content));
    }
  });
});
