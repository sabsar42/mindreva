import type { LLMProvider } from "./types";
import { FallbackLLMProvider } from "./providers/fallback-provider";
import { GeminiLLMProvider } from "./providers/gemini-provider";
import { GroqLLMProvider } from "./providers/groq-provider";
import { ClaudeLLMProvider } from "./providers/claude-provider";
import { OpenRouterLLMProvider } from "./providers/openrouter-provider";

/**
 * The single entry point every caller uses. As boring as the ASR factory: one
 * env var, zero conditionals in business logic. Claude is explicit opt-in
 * only — never the implicit default, even if unset falls through here.
 *
 * OpenRouter is a temporary stand-in for Gemini (blocked by an account/region
 * quota issue, unrelated to this codebase — see docs/roadmap.md ADR-5).
 * LLM_PROVIDER=openrouter is set explicitly in .env for now; the code default
 * when LLM_PROVIDER is unset stays "gemini", the documented long-term choice.
 */
function createProvider(name: string): LLMProvider {
  switch (name) {
    case "groq":
      return new GroqLLMProvider();
    case "claude":
      return new ClaudeLLMProvider();
    case "openrouter":
      return new OpenRouterLLMProvider();
    case "gemini":
    default:
      return new GeminiLLMProvider();
  }
}

// One instance per configuration, so the fallback wrapper's rate-limit
// cooldown survives across calls within a server instance.
let cached: { key: string; provider: LLMProvider } | null = null;

/**
 * LLM_FALLBACK_PROVIDER (optional, e.g. "groq") takes over completions when
 * the primary fails; embeddings never use it (see FallbackLLMProvider).
 */
export function getLLMProvider(): LLMProvider {
  const primary = process.env.LLM_PROVIDER ?? "gemini";
  const fallback = process.env.LLM_FALLBACK_PROVIDER?.trim() || null;
  const key = `${primary}|${fallback ?? ""}`;
  if (cached?.key === key) return cached.provider;

  const provider =
    fallback && fallback !== primary
      ? new FallbackLLMProvider(
          createProvider(primary),
          createProvider(fallback),
        )
      : createProvider(primary);
  cached = { key, provider };
  return provider;
}
