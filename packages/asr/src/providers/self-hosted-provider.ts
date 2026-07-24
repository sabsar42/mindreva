import type {
  ASRProvider,
  TranscribeOptions,
  TranscriptionResult,
} from "../types";

/**
 * Stub for the self-hosted Nemotron 3.5 ASR adapter (see docs/roadmap.md
 * ADR-4). The interface is satisfied now so the abstraction is visibly
 * complete; the real implementation is a deliberately separate Phase 9
 * deliverable, not a Phase 4 one.
 */
export class SelfHostedNemotronProvider implements ASRProvider {
  readonly name = "nemotron-self-hosted" as const;

  async transcribe(
    _audio: Buffer,
    _mimeType: string,
    _options?: TranscribeOptions,
  ): Promise<TranscriptionResult> {
    throw new Error(
      "The self-hosted Nemotron ASR provider is not yet configured. It ships in Phase 9. Set ASR_PROVIDER=groq or ASR_PROVIDER=huggingface for now.",
    );
  }
}
