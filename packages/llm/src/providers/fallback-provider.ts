import type {
  CompleteOptions,
  CompletionResult,
  LLMMessage,
  LLMProvider,
} from "../types";

// After the primary says "rate limited", skip straight to the fallback for a
// while instead of paying for a doomed round trip (OpenRouter walks its whole
// model list before answering 429). Per server instance, best effort.
const PRIMARY_COOLDOWN_MS = 5 * 60 * 1000;

function isRateLimited(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /\(429\)|\b429\b|rate[\s_-]?limit|too many requests/i.test(message);
}

/**
 * Completions go to `primary`; if it fails for any reason (every model it
 * tried errored, or it was rate limited), the same messages go to
 * `fallback`. Embeddings ALWAYS stay on `primary` — the fallback's vectors
 * would be a different model and dimension, and mixing them in the
 * embeddings table would silently break retrieval.
 */
export class FallbackLLMProvider implements LLMProvider {
  readonly name: LLMProvider["name"];
  private primaryBlockedUntil = 0;

  constructor(
    private readonly primary: LLMProvider,
    private readonly fallback: LLMProvider,
    private readonly now: () => number = Date.now,
  ) {
    this.name = primary.name;
  }

  async complete(
    messages: LLMMessage[],
    options?: CompleteOptions,
  ): Promise<CompletionResult> {
    let primaryError: unknown = null;
    if (this.now() >= this.primaryBlockedUntil) {
      try {
        return await this.primary.complete(messages, options);
      } catch (err) {
        primaryError = err;
        if (isRateLimited(err)) {
          this.primaryBlockedUntil = this.now() + PRIMARY_COOLDOWN_MS;
        }
        console.warn(
          `LLM primary (${this.primary.name}) failed, falling back to ${this.fallback.name}:`,
          err instanceof Error ? err.message.slice(0, 200) : err,
        );
      }
    }

    try {
      return await this.fallback.complete(messages, options);
    } catch (fallbackError) {
      // Keep both causes in the message so callers can still tell "limit
      // reached" (see apps/web/lib/limit-error.ts) from a real failure.
      const describe = (e: unknown) =>
        e instanceof Error ? e.message : String(e ?? "");
      throw new Error(
        `All LLM providers failed. ${this.primary.name}: ${
          primaryError
            ? describe(primaryError)
            : "skipped (recently rate limited (429))"
        } | ${this.fallback.name}: ${describe(fallbackError)}`,
      );
    }
  }

  embed(text: string): Promise<number[]> {
    return this.primary.embed(text);
  }
}
