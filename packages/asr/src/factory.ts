import type { ASRProvider } from "./types";
import { GroqASRProvider } from "./providers/groq-provider";
import { HuggingFaceASRProvider } from "./providers/huggingface-provider";
import { SelfHostedNemotronProvider } from "./providers/self-hosted-provider";

/**
 * The single entry point every caller uses. Nothing outside packages/asr/src/
 * providers should ever branch on which provider is active — that's exactly
 * what this factory (and the ASRProvider interface) exists to hide.
 */
export function getASRProvider(): ASRProvider {
  const provider = process.env.ASR_PROVIDER ?? "groq";
  switch (provider) {
    case "huggingface":
      return new HuggingFaceASRProvider();
    case "nemotron-self-hosted":
      return new SelfHostedNemotronProvider();
    case "groq":
    default:
      return new GroqASRProvider();
  }
}
