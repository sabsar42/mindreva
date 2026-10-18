import { describe, expect, it } from "vitest";
import { LIMIT_MESSAGE, isLimitError } from "./limit-error";

describe("isLimitError", () => {
  it("recognises provider limit errors", () => {
    expect(
      isLimitError(new Error("OpenRouter completion failed (429): rate limit")),
    ).toBe(true);
    expect(isLimitError(new Error("RESOURCE_EXHAUSTED: quota exceeded"))).toBe(
      true,
    );
    expect(isLimitError(new Error("Too Many Requests"))).toBe(true);
    expect(
      isLimitError(new Error("embedding failed (402): insufficient credits")),
    ).toBe(true);
  });
  it("ignores unrelated failures", () => {
    expect(
      isLimitError(new Error("OpenRouter returned an empty completion")),
    ).toBe(false);
    expect(isLimitError(new Error("Not authenticated"))).toBe(false);
    expect(isLimitError(null)).toBe(false);
  });
  it("never mentions plans, upgrades or payment", () => {
    expect(LIMIT_MESSAGE).not.toMatch(/upgrade|plan|pro\b|pay|subscri|price/i);
  });
});
