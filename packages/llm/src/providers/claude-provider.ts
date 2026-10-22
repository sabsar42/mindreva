import Anthropic from "@anthropic-ai/sdk";
import type {
  CompleteOptions,
  CompletionResult,
  LLMMessage,
  LLMProvider,
  StreamOptions,
} from "../types";

const COMPLETION_MODEL = "claude-sonnet-5";
const DEFAULT_MAX_TOKENS = 1024;

/**
 * Premium provider. Only ever used when LLM_PROVIDER=claude is explicitly
 * set — never the default. Anthropic has no embedding endpoint, so embed()
 * always throws, same as GroqLLMProvider.
 */
export class ClaudeLLMProvider implements LLMProvider {
  readonly name = "claude" as const;
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          "ANTHROPIC_API_KEY is not set. Add it to your environment to use the Claude LLM provider.",
        );
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async complete(
    messages: LLMMessage[],
    options?: CompleteOptions,
  ): Promise<CompletionResult> {
    const client = this.getClient();
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const conversation = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }) as const);

    const response = await client.messages.create({
      model: COMPLETION_MODEL,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: system || undefined,
      messages: conversation,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude returned an empty completion");
    }
    return {
      text: textBlock.text,
      model: COMPLETION_MODEL,
      provider: this.name,
    };
  }

  /** No real streaming here: the whole answer arrives as one piece. */
  async stream(
    messages: LLMMessage[],
    options: StreamOptions,
  ): Promise<CompletionResult> {
    const result = await this.complete(messages, options);
    options.onDelta(result.text);
    return result;
  }

  async embed(_text: string): Promise<number[]> {
    throw new Error(
      "ClaudeLLMProvider does not support embeddings (Anthropic has no embedding endpoint).",
    );
  }

  async embedMany(_texts: string[]): Promise<number[][]> {
    throw new Error(
      "ClaudeLLMProvider does not support embeddings (Anthropic has no embedding endpoint).",
    );
  }
}
