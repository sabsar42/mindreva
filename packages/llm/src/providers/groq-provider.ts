import Groq from "groq-sdk";
import type {
  CompleteOptions,
  CompletionResult,
  LLMMessage,
  LLMProvider,
} from "../types";

// Groq retires models without notice (llama-3.3-70b-versatile started
// returning 404 in October 2026), so the model is an env var with a default
// that existed when this was written. gpt-oss is a reasoning model; see
// reasoning_format below.
const DEFAULT_COMPLETION_MODEL = "openai/gpt-oss-120b";

/** Fast fallback for completions. No embedding model — embed() always throws. */
export class GroqLLMProvider implements LLMProvider {
  readonly name = "groq" as const;
  private client: Groq | null = null;

  private getClient(): Groq {
    if (!this.client) {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GROQ_API_KEY is not set. Add it to your environment to use the Groq LLM provider.",
        );
      }
      this.client = new Groq({ apiKey });
    }
    return this.client;
  }

  async complete(
    messages: LLMMessage[],
    options?: CompleteOptions,
  ): Promise<CompletionResult> {
    const client = this.getClient();
    const model = process.env.GROQ_LLM_MODEL || DEFAULT_COMPLETION_MODEL;
    const completion = await client.chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: options?.maxTokens,
      // Keeps any reasoning trace out of `content` (ignored by non-reasoning
      // models). Same goal as OpenRouter's reasoning.exclude.
      reasoning_format: "hidden",
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error("Groq returned an empty completion");
    return { text, model: completion.model || model, provider: this.name };
  }

  async embed(_text: string): Promise<number[]> {
    throw new Error(
      "GroqLLMProvider does not support embeddings. The factory must never route embed() calls to this provider.",
    );
  }

  async embedMany(_texts: string[]): Promise<number[][]> {
    throw new Error(
      "GroqLLMProvider does not support embeddings. The factory must never route embed() calls to this provider.",
    );
  }
}
