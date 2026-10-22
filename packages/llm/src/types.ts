export type LLMProviderName = "gemini" | "groq" | "claude" | "openrouter";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  maxTokens?: number;
}

/** What a completion returned, and who actually wrote it. With fallbacks
 * (OpenRouter's model list, then LLM_FALLBACK_PROVIDER) the answering model
 * is often not the configured one, so callers store these alongside output. */
export interface CompletionResult {
  text: string;
  /** The model id that answered, as the provider reported it. */
  model: string;
  provider: LLMProviderName;
}

export interface LLMProvider {
  readonly name: LLMProviderName;
  complete(
    messages: LLMMessage[],
    options?: CompleteOptions,
  ): Promise<CompletionResult>;
  embed(text: string): Promise<number[]>;
}

/**
 * Mirrors profiles.summary_style (see packages/database/src/schema.ts and
 * apps/web/lib/services/profile.service.ts). Kept as a local literal union,
 * not imported, so this package never depends on apps/web.
 */
export type SummaryStyle =
  "general" | "meetings" | "interviews" | "lectures" | "personal";
