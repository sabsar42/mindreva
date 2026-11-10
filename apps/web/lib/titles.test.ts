import { describe, expect, it } from "vitest";
import { parseTitleLine } from "@mindreva/llm";
import { titleFromWords } from "@mindreva/types";

describe("titleFromWords", () => {
  it("keeps the first four words and marks the cut", () => {
    expect(titleFromWords("Went for a slow loop around the park")).toBe(
      "Went for a slow…",
    );
  });
  it("keeps a short sentence whole, without its full stop", () => {
    expect(titleFromWords("Dinner with Mum. We cooked dal.")).toBe(
      "Dinner with Mum",
    );
  });
  it("strips formatting and is null for empty text", () => {
    expect(titleFromWords("**Run** number nine today")).toBe(
      "Run number nine today",
    );
    expect(titleFromWords("   ")).toBeNull();
  });
});

describe("parseTitleLine", () => {
  it("splits a TITLE line off the reply", () => {
    expect(
      parseTitleLine("TITLE: Morning walk plans\n\nYou went out."),
    ).toEqual({
      title: "Morning walk plans",
      rest: "\nYou went out.",
    });
  });
  it("leaves a reply without one untouched", () => {
    expect(parseTitleLine("You went out.")).toEqual({
      title: null,
      rest: "You went out.",
    });
  });
  it("drops quotes and a trailing full stop", () => {
    expect(parseTitleLine('TITLE: "A hard day."\nText').title).toBe(
      "A hard day",
    );
  });
});
