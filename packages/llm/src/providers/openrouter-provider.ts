import type {
  CompleteOptions,
  CompletionResult,
  LLMMessage,
  LLMProvider,
} from "../types";

const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";

// Matches vector(2048) in packages/database/src/schema.ts — the schema was
// migrated to this model's native output dimension (see the comment on
// embeddings.embedding there). embed() verifies against this and throws
// rather than silently reshaping a mismatch.
const EXPECTED_EMBEDDING_DIMENSIONS = 2048;

// OpenRouter's own router over whatever free models are up right now. Always
// the last entry in the fallback list: it can pick a model we have never
// seen, which is why the reasoning suppression below stays on for every call.
const LAST_RESORT_MODEL = "openrouter/free";

// OpenRouter's hard cap on the `models` array of one request.
const MAX_MODELS_PER_REQUEST = 3;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

// Models emit an internal reasoning trace by default, and the fallback models
// each do it differently. We suppress it three ways: the OpenRouter `reasoning.exclude` param (strips reasoning
// tokens server-side even if the model generates them), a system-prompt
// instruction, and — as a last-resort safety net — stripping any <think>
// tags that still leak into `content` before returning it.
const REASONING_TAG_PATTERN = /<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi;
const NO_REASONING_INSTRUCTION =
  "Respond with only your final answer. Do not include any visible reasoning, thinking steps, chain-of-thought, or <think> tags — output the finished text only.";

interface OpenRouterChatResponse {
  /** The model that actually answered (may be a fallback). */
  model?: string;
  choices?: { message?: { content?: string } }[];
}

interface OpenRouterEmbeddingsResponse {
  data?: { embedding?: number[] }[];
}

/**
 * OPENROUTER_MODEL, then OPENROUTER_FALLBACK_MODELS (comma-separated), then
 * openrouter/free. OpenRouter tries them in order on any error, rate limits
 * included. Duplicates and blanks are dropped.
 */
export function completionModelList(
  primary: string,
  fallbacks: string | undefined,
): string[] {
  const all = [primary, ...(fallbacks ?? "").split(","), LAST_RESORT_MODEL].map(
    (m) => m.trim(),
  );
  return [...new Set(all.filter(Boolean))];
}

function stripReasoningTags(text: string): string {
  return text.replace(REASONING_TAG_PATTERN, "").trim();
}

function withNoReasoningInstruction(messages: LLMMessage[]): LLMMessage[] {
  const systemMessages = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  const combinedSystem = [
    ...systemMessages.map((m) => m.content),
    NO_REASONING_INSTRUCTION,
  ].join("\n\n");
  return [{ role: "system", content: combinedSystem }, ...rest];
}

/**
 * Temporary default while a Gemini account/region issue is being resolved
 * (see docs/roadmap.md ADR-5 for the long-term plan). Uses OpenRouter's
 * OpenAI-compatible API. Chat completions and embeddings deliberately use two
 * DIFFERENT models (OPENROUTER_MODEL vs OPENROUTER_EMBEDDING_MODEL) — do not
 * collapse them into one env var.
 */
export class OpenRouterLLMProvider implements LLMProvider {
  readonly name = "openrouter" as const;

  private getApiKey(): string {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is not set. Add it to your environment to use the OpenRouter LLM provider.",
      );
    }
    return apiKey;
  }

  async complete(
    messages: LLMMessage[],
    options?: CompleteOptions,
  ): Promise<CompletionResult> {
    const apiKey = this.getApiKey();
    const model = process.env.OPENROUTER_MODEL;
    if (!model) {
      throw new Error(
        "OPENROUTER_MODEL is not set. Add it to your environment to use the OpenRouter LLM provider.",
      );
    }

    const body = {
      messages: withNoReasoningInstruction(messages),
      max_tokens: options?.maxTokens,
      reasoning: { exclude: true },
    };

    // OpenRouter rejects a `models` array longer than 3 (HTTP 400), so a
    // longer list goes out as consecutive requests of up to 3 models each.
    // Within a request OpenRouter does the fallback itself; between requests
    // we do, so the configured order holds either way.
    let lastError: Error | null = null;
    for (const batch of chunk(
      completionModelList(model, process.env.OPENROUTER_FALLBACK_MODELS),
      MAX_MODELS_PER_REQUEST,
    )) {
      try {
        return await this.requestCompletion(apiKey, batch, body);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw lastError ?? new Error("OpenRouter: no models configured");
  }

  private async requestCompletion(
    apiKey: string,
    models: string[],
    body: Record<string, unknown>,
  ): Promise<CompletionResult> {
    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, models }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `OpenRouter completion failed (${response.status}): ${detail.slice(0, 500)}`,
      );
    }

    const data = (await response.json()) as OpenRouterChatResponse;
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error("OpenRouter returned an empty completion");

    const cleaned = stripReasoningTags(raw);
    if (!cleaned) {
      throw new Error(
        "OpenRouter returned only a reasoning trace with no final answer",
      );
    }
    return {
      text: cleaned,
      model: data.model ?? models[0]!,
      provider: this.name,
    };
  }

  async embed(text: string): Promise<number[]> {
    const apiKey = this.getApiKey();
    const model = process.env.OPENROUTER_EMBEDDING_MODEL;
    if (!model) {
      throw new Error(
        "OPENROUTER_EMBEDDING_MODEL is not set. Add it to your environment to use OpenRouter embeddings. This must be a separate model from OPENROUTER_MODEL.",
      );
    }

    const response = await fetch(EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input: text }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `OpenRouter embedding failed (${response.status}): ${detail.slice(0, 500)}`,
      );
    }

    const data = (await response.json()) as OpenRouterEmbeddingsResponse;
    const values = data.data?.[0]?.embedding;
    if (!values || values.length === 0) {
      throw new Error("OpenRouter returned no embedding values");
    }

    if (values.length !== EXPECTED_EMBEDDING_DIMENSIONS) {
      throw new Error(
        `OpenRouter embedding model "${model}" returned a ${values.length}-dimension vector, but packages/database/src/schema.ts's embeddings.embedding column expects ${EXPECTED_EMBEDDING_DIMENSIONS} (vector(${EXPECTED_EMBEDDING_DIMENSIONS})). Not truncating or padding — either pick a model with matching output dimensions, or migrate the column.`,
      );
    }

    return values;
  }
}
