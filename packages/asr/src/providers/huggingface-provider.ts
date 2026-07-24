import type {
  ASRProvider,
  TranscribeOptions,
  TranscriptionResult,
} from "../types";

const HF_MODEL_URL =
  "https://api-inference.huggingface.co/models/openai/whisper-large-v3";

interface HuggingFaceTranscriptionResponse {
  text: string;
}

/**
 * Documented fallback provider. The HF Inference API's basic response only
 * gives back text — no segments, language, or duration — so those fields are
 * best-effort (empty/zero) rather than absent, to satisfy TranscriptionResult.
 */
export class HuggingFaceASRProvider implements ASRProvider {
  readonly name = "huggingface" as const;

  async transcribe(
    audio: Buffer,
    mimeType: string,
    _options?: TranscribeOptions,
  ): Promise<TranscriptionResult> {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "HUGGINGFACE_API_KEY is not set. Add it to your environment to use the Hugging Face ASR provider.",
      );
    }

    const response = await fetch(HF_MODEL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": mimeType,
      },
      body: new Uint8Array(audio),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Hugging Face transcription failed (${response.status}): ${detail.slice(0, 500)}`,
      );
    }

    const data = (await response.json()) as HuggingFaceTranscriptionResponse;

    return {
      text: data.text.trim(),
      language: null,
      durationMs: 0,
      segments: [],
      provider: this.name,
    };
  }
}
