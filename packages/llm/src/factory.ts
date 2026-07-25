import type { LLMProvider } from "./types";
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
export function getLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER ?? "gemini";
  switch (provider) {
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
