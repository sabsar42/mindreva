export type ASRProviderName =
  "groq" | "huggingface" | "openai" | "elevenlabs" | "nemotron-self-hosted";

export interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
}

export interface TranscriptionResult {
  text: string;
  language: string | null;
  durationMs: number;
  segments: TranscriptSegment[];
  provider: ASRProviderName;
}

export interface TranscribeOptions {
  languageHint?: string;
  prompt?: string;
}

export interface ASRProvider {
  readonly name: ASRProviderName;
  transcribe(
    audio: Buffer,
    mimeType: string,
    options?: TranscribeOptions,
  ): Promise<TranscriptionResult>;
}
