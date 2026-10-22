import { describe, expect, it, vi } from "vitest";
import { ThinkTagFilter } from "../../../packages/llm/src/stream-filter";
import { FallbackLLMProvider, type LLMProvider } from "@mindreva/llm";

function run(chunks: string[]): string {
  const f = new ThinkTagFilter();
  return chunks.map((c) => f.push(c)).join("") + f.flush();
}

describe("ThinkTagFilter", () => {
  it("passes ordinary text straight through", () => {
    expect(run(["Hello ", "there."])).toBe("Hello there.");
  });

  it("removes a think block split across chunks", () => {
    expect(run(["<thi", "nk>secret plan</th", "ink>The answer."])).toBe(
      "The answer.",
    );
    expect(run(["A", "<thinking>x", "y</thinking>", "B"])).toBe("AB");
  });

  it("holds back a possible tag start until it knows, then releases it", () => {
    const f = new ThinkTagFilter();
    expect(f.push("5 <")).toBe("5 ");
    expect(f.push(" 6")).toBe("< 6");
  });

  it("drops an unclosed think block at the end", () => {
    expect(run(["Visible. <think>never closed"])).toBe("Visible. ");
  });
});

const MSG = [{ role: "user" as const, content: "hi" }];
function streamer(
  name: LLMProvider["name"],
  impl: LLMProvider["stream"],
): LLMProvider {
  return {
    name,
    complete: vi.fn(),
    embed: vi.fn(),
    embedMany: vi.fn(),
    stream: vi.fn(impl),
  } as unknown as LLMProvider;
}

describe("FallbackLLMProvider.stream", () => {
  it("falls back when the primary fails before any token", async () => {
    const primary = streamer("openrouter", async () => {
      throw new Error("OpenRouter completion failed (502)");
    });
    const fallback = streamer("groq", async (_m, o) => {
      o.onDelta("from groq");
      return { text: "from groq", model: "g", provider: "groq" };
    });
    const seen: string[] = [];
    const r = await new FallbackLLMProvider(primary, fallback).stream(MSG, {
      onDelta: (t) => seen.push(t),
    });
    expect(r.provider).toBe("groq");
    expect(seen).toEqual(["from groq"]);
  });

  it("does NOT switch provider halfway through an answer", async () => {
    const primary = streamer("openrouter", async (_m, o) => {
      o.onDelta("half an ans");
      throw new Error("connection reset");
    });
    const fallback = streamer("groq", async () => ({
      text: "x",
      model: "g",
      provider: "groq",
    }));
    await expect(
      new FallbackLLMProvider(primary, fallback).stream(MSG, {
        onDelta: () => {},
      }),
    ).rejects.toThrow("connection reset");
    expect(fallback.stream).not.toHaveBeenCalled();
  });
});
