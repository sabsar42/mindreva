import { describe, expect, it } from "vitest";
import { cardBlurb } from "./card-text";

describe("cardBlurb", () => {
  it("does not split on abbreviations like p.m.", () => {
    const out = cardBlurb(
      "Your week is busy. You have a dentist appointment at 3 p.m., and you need to book a table.",
    );
    expect(out).toContain("3 p.m., and you need");
    expect(out).not.toContain("busy.,");
  });

  it("strips markdown and list markers", () => {
    expect(cardBlurb("## Notes\n- **Call** Sam")).toBe("Notes Call Sam");
  });

  it("returns empty for no summary", () => {
    expect(cardBlurb(null)).toBe("");
  });

  it("cuts a single over-long sentence with an ellipsis", () => {
    const out = cardBlurb(`${"word ".repeat(80)}end.`, 60);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith("…")).toBe(true);
  });
});
