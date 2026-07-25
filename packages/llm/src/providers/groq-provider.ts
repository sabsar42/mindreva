import Groq from "groq-sdk";
import type { CompleteOptions, LLMMessage, LLMProvider } from "../types";

const COMPLETION_MODEL = "llama-3.3-70b-versatile";

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
  ): Promise<string> {
    const client = this.getClient();
    const completion = await client.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: options?.maxTokens,
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error("Groq returned an empty completion");
    return text;
  }

  async embed(_text: string): Promise<number[]> {
    throw new Error(
      "GroqLLMProvider does not support embeddings. The factory must never route embed() calls to this provider.",
    );
  }
}
