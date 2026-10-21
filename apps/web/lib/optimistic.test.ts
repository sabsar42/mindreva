import { describe, expect, it } from "vitest";
import { restoreRemoved } from "./optimistic";

const a = { id: "a" };
const b = { id: "b" };
const c = { id: "c" };
const d = { id: "d" };

describe("restoreRemoved", () => {
  it("puts the item back at its original position", () => {
    expect(restoreRemoved([a, b, c], [a, c], "b")).toEqual([a, b, c]);
  });

  it("restores the first and last items", () => {
    expect(restoreRemoved([a, b, c], [b, c], "a")).toEqual([a, b, c]);
    expect(restoreRemoved([a, b, c], [a, b], "c")).toEqual([a, b, c]);
  });

  it("keeps items that arrived or left meanwhile", () => {
    // d arrived on top, a was removed by another action.
    expect(restoreRemoved([a, b, c], [d, c], "b")).toEqual([b, d, c]);
    expect(restoreRemoved([a, b, c], [d, a, c], "b")).toEqual([d, a, b, c]);
  });

  it("is a no-op when the item is already back or unknown", () => {
    expect(restoreRemoved([a, b], [a, b], "b")).toEqual([a, b]);
    expect(restoreRemoved([a, b], [a], "zzz")).toEqual([a]);
  });
});
