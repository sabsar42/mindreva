import { describe, expect, it, vi } from "vitest";
import {
  FallbackLLMProvider,
  completionModelList,
  type LLMProvider,
} from "@mindreva/llm";

function fake(
  name: LLMProvider["name"],
  complete: LLMProvider["complete"],
): LLMProvider & {
  embed: ReturnType<typeof vi.fn>;
  embedMany: ReturnType<typeof vi.fn>;
} {
  return {
    name,
    complete: vi.fn(complete),
    embed: vi.fn(async () => [1]),
    embedMany: vi.fn(async (t: string[]) => t.map(() => [1])),
  };
}
const MSG = [{ role: "user" as const, content: "hi" }];
const ok = (provider: LLMProvider["name"], model: string) => async () => ({
  text: "answer",
  model,
  provider,
});

describe("completionModelList", () => {
  it("orders primary, fallbacks, then openrouter/free, without duplicates", () => {
    expect(
      completionModelList("a:free", " b:free, ,c:free,a:free, openrouter/free"),
    ).toEqual(["a:free", "b:free", "c:free", "openrouter/free"]);
    // Unset -> built-in defaults; empty -> deliberately none.
    expect(completionModelList("a:free", undefined)).toEqual([
      "a:free",
      "minimax/minimax-m3.1-flash:free",
      "poolside/laguna-s-2.1:free",
      "openrouter/free",
    ]);
    expect(completionModelList("a:free", "")).toEqual([
      "a:free",
      "openrouter/free",
    ]);
  });
});

describe("FallbackLLMProvider", () => {
  it("uses the primary when it answers", async () => {
    const primary = fake("openrouter", ok("openrouter", "m1"));
    const fallback = fake("groq", ok("groq", "g1"));
    const p = new FallbackLLMProvider(primary, fallback);
    expect(await p.complete(MSG)).toMatchObject({
      provider: "openrouter",
      model: "m1",
    });
    expect(fallback.complete).not.toHaveBeenCalled();
  });

  it("falls back on any primary failure and reports who answered", async () => {
    const primary = fake("openrouter", async () => {
      throw new Error("OpenRouter completion failed (502): upstream down");
    });
    const fallback = fake("groq", ok("groq", "openai/gpt-oss-120b"));
    const p = new FallbackLLMProvider(primary, fallback);
    expect(await p.complete(MSG)).toMatchObject({
      provider: "groq",
      model: "openai/gpt-oss-120b",
    });
  });

  it("skips a rate-limited primary for a while, then tries it again", async () => {
    let now = 0;
    const primary = fake("openrouter", async () => {
      throw new Error(
        "OpenRouter completion failed (429): free-models-per-day",
      );
    });
    const fallback = fake("groq", ok("groq", "g1"));
    const p = new FallbackLLMProvider(primary, fallback, () => now);
    await p.complete(MSG);
    await p.complete(MSG);
    expect(primary.complete).toHaveBeenCalledTimes(1);
    now = 6 * 60 * 1000;
    await p.complete(MSG);
    expect(primary.complete).toHaveBeenCalledTimes(2);
  });

  it("keeps both causes when everything fails, so a limit is still recognisable", async () => {
    const primary = fake("openrouter", async () => {
      throw new Error("OpenRouter completion failed (429): limit");
    });
    const fallback = fake("groq", async () => {
      throw new Error("Groq said no");
    });
    const p = new FallbackLLMProvider(primary, fallback);
    await expect(p.complete(MSG)).rejects.toThrow(/\(429\).*Groq said no/);
  });

  it("never sends embeddings to the fallback", async () => {
    const primary = fake("openrouter", ok("openrouter", "m1"));
    const fallback = fake("groq", ok("groq", "g1"));
    await new FallbackLLMProvider(primary, fallback).embed("text");
    expect(primary.embed).toHaveBeenCalledWith("text");
    expect(fallback.embed).not.toHaveBeenCalled();
  });
});

describe("OpenRouterLLMProvider model batching", () => {
  it("sends at most 3 models per request, in order, and moves to the next batch on failure", async () => {
    const { OpenRouterLLMProvider } =
      await import("../../../packages/llm/src/providers/openrouter-provider");
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    vi.stubEnv("OPENROUTER_MODEL", "m1");
    vi.stubEnv("OPENROUTER_FALLBACK_MODELS", "m2,m3,m4");
    const sent: string[][] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body);
        sent.push(body.models);
        expect(body.reasoning).toEqual({ exclude: true });
        if (sent.length === 1) {
          return new Response("rate limited", { status: 429 });
        }
        return new Response(
          JSON.stringify({
            model: "m4",
            choices: [{ message: { content: "<think>x</think>done" } }],
          }),
        );
      }),
    );
    const result = await new OpenRouterLLMProvider().complete(MSG);
    expect(sent).toEqual([
      ["m1", "m2", "m3"],
      ["m4", "openrouter/free"],
    ]);
    expect(result).toEqual({
      text: "done",
      model: "m4",
      provider: "openrouter",
    });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

describe("getLLMProvider fallback default", () => {
  it("wraps with Groq when only the key is present, and respects an explicit off", async () => {
    const { getLLMProvider } = await import("@mindreva/llm");
    vi.stubEnv("LLM_PROVIDER", "openrouter");
    vi.stubEnv("GROQ_API_KEY", "g");
    vi.stubEnv("LLM_FALLBACK_PROVIDER", undefined as unknown as string);
    delete process.env.LLM_FALLBACK_PROVIDER;
    expect(getLLMProvider()).toBeInstanceOf(FallbackLLMProvider);
    vi.stubEnv("LLM_FALLBACK_PROVIDER", "");
    expect(getLLMProvider()).not.toBeInstanceOf(FallbackLLMProvider);
    vi.unstubAllEnvs();
  });
});
