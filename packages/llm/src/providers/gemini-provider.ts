import { GoogleGenAI } from "@google/genai";
import type { CompleteOptions, LLMMessage, LLMProvider } from "../types";

const COMPLETION_MODEL = "gemini-2.5-flash";
// text-embedding-004 defaults to 768 dims, matching embeddings.embedding
// (vector(768)) in packages/database/src/schema.ts.
const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMENSIONS = 768;

export class GeminiLLMProvider implements LLMProvider {
  readonly name = "gemini" as const;
  private client: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GEMINI_API_KEY is not set. Add it to your environment to use the Gemini LLM provider.",
        );
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  async complete(
    messages: LLMMessage[],
    options?: CompleteOptions,
  ): Promise<string> {
    const client = this.getClient();
    const systemInstruction = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      }));

    const response = await client.models.generateContent({
      model: COMPLETION_MODEL,
      contents,
      config: {
        systemInstruction: systemInstruction || undefined,
        maxOutputTokens: options?.maxTokens,
      },
    });

    const text = response.text;
    if (!text) throw new Error("Gemini returned an empty completion");
    return text;
  }

  async embed(text: string): Promise<number[]> {
    const client = this.getClient();
    const response = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
      config: { outputDimensionality: EMBEDDING_DIMENSIONS },
    });
    const values = response.embeddings?.[0]?.values;
    if (!values) throw new Error("Gemini returned no embedding values");
    return values;
  }
}
