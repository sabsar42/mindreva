export type LLMProviderName = "gemini" | "groq" | "claude" | "openrouter";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  maxTokens?: number;
}

export interface LLMProvider {
  readonly name: LLMProviderName;
  complete(messages: LLMMessage[], options?: CompleteOptions): Promise<string>;
  embed(text: string): Promise<number[]>;
}

/**
 * Mirrors profiles.summary_style (see packages/database/src/schema.ts and
 * apps/web/lib/services/profile.service.ts). Kept as a local literal union,
 * not imported, so this package never depends on apps/web.
 */
export type SummaryStyle =
  "general" | "meetings" | "interviews" | "lectures" | "personal";
