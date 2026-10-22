import { describe, expect, it } from "vitest";
import { extractKeywordQuery, matchedTerms } from "./keywords";
import {
  citationsFor,
  fuseResults,
  isKeywordEvidence,
  type CandidateChunk,
} from "./fuse";

describe("extractKeywordQuery", () => {
  it("pulls quoted phrases and names, and drops stop words from terms", () => {
    const q = extractKeywordQuery(
      'What did Priya say about "the blue notebook" at Café Rumi?',
    );
    expect(q.phrases).toEqual(
      expect.arrayContaining(["the blue notebook", "Priya", "Café Rumi"]),
    );
    expect(q.terms).toEqual(
      expect.arrayContaining(["priya", "blue", "notebook", "café", "rumi"]),
    );
    expect(q.terms).not.toContain("what");
    expect(q.terms).not.toContain("about");
  });

  it("does not treat a question opener or a lone sentence-start word as a name", () => {
    expect(extractKeywordQuery("What was on my mind?").phrases).toEqual([]);
    expect(extractKeywordQuery("Anything about running?").phrases).toEqual([]);
  });

  it("does not read apostrophes as quotes", () => {
    const q = extractKeywordQuery("What's Priya's plan? I'm unsure");
    expect(q.phrases).toEqual(["Priya"]);
  });

  it("keeps Bangla words as terms", () => {
    expect(extractKeywordQuery("নদীর ধারে হাঁটা").terms).toHaveLength(3);
  });
});

describe("matchedTerms", () => {
  it("prefix-matches longer terms and whole-matches short ones", () => {
    expect(
      matchedTerms("We went walking by the sea", ["walk", "se", "sea"]),
    ).toEqual(["walk", "sea"]);
  });
});

function chunk(id: string, entryId: string, content: string): CandidateChunk {
  return {
    chunkId: id,
    entryId,
    chunkIndex: 0,
    content: `Date: 2026-03-14 (Saturday)\n\n${content}`,
    entryDate: "2026-03-14",
    entryTitle: `Title ${entryId}`,
  };
}

describe("isKeywordEvidence", () => {
  const q = { terms: ["dentist", "appointment"], phrases: [] };
  it("needs two distinct question words, or a phrase", () => {
    expect(isKeywordEvidence("Booked the dentist appointment.", q)).toBe(true);
    expect(isKeywordEvidence("Thought about the dentist.", q)).toBe(false);
    expect(
      isKeywordEvidence("Lunch with Priya.", {
        terms: ["lunch", "x"],
        phrases: ["Priya"],
      }),
    ).toBe(true);
  });
});

describe("fuseResults", () => {
  const query = { terms: ["river", "walk"], phrases: [] };

  it("drops vector hits under the threshold unless keyword evidence keeps them", () => {
    const a = chunk("a", "e1", "Walked by the river after work.");
    const b = chunk("b", "e2", "Bought groceries.");
    const out = fuseResults({
      vector: [
        { ...a, similarity: 0.2 },
        { ...b, similarity: 0.25 },
      ],
      keyword: [a],
      query,
      minSimilarity: 0.3,
      topK: 8,
    });
    expect(out.map((c) => c.chunkId)).toEqual(["a"]);
    expect(out[0]).toMatchObject({
      source: "keyword",
      similarity: 0.2,
      vectorRank: null,
      keywordRank: 1,
    });
  });

  it("ranks a chunk found by both lists above one found by either", () => {
    const a = chunk("a", "e1", "River walk.");
    const b = chunk("b", "e2", "River walk again.");
    const c = chunk("c", "e3", "Something similar.");
    const out = fuseResults({
      vector: [
        { ...c, similarity: 0.9 },
        { ...a, similarity: 0.8 },
      ],
      keyword: [b, a],
      query,
      minSimilarity: 0.3,
      topK: 8,
    });
    expect(out[0]!.chunkId).toBe("a");
    expect(out[0]!.source).toBe("both");
  });

  it("returns nothing when nothing passes, and caps at topK", () => {
    expect(
      fuseResults({
        vector: [{ ...chunk("a", "e1", "x"), similarity: 0.1 }],
        keyword: [],
        query,
        minSimilarity: 0.3,
        topK: 8,
      }),
    ).toEqual([]);
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...chunk(`c${i}`, `e${i}`, "x"),
      similarity: 0.9 - i / 100,
    }));
    expect(
      fuseResults({
        vector: many,
        keyword: [],
        query,
        minSimilarity: 0.3,
        topK: 8,
      }),
    ).toHaveLength(8);
  });
});

describe("citationsFor", () => {
  it("gives one citation per entry, in order, with a snippet without the date line", () => {
    const hits = fuseResults({
      vector: [
        { ...chunk("a", "e1", "First chunk of entry one."), similarity: 0.9 },
        { ...chunk("b", "e2", "Entry two."), similarity: 0.8 },
        { ...chunk("c", "e1", "Second chunk of entry one."), similarity: 0.7 },
      ],
      keyword: [],
      query: { terms: [], phrases: [] },
      minSimilarity: 0.3,
      topK: 8,
    });
    const cites = citationsFor(hits);
    expect(cites.map((c) => c.entryId)).toEqual(["e1", "e2"]);
    expect(cites[0]!.snippet).toBe("First chunk of entry one.");
    expect(cites[0]!.entryTitle).toBe("Title e1");
  });
});
