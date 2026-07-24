import type {
  ASRProvider,
  TranscribeOptions,
  TranscriptionResult,
} from "../types";

const GROQ_TRANSCRIPTION_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";
// Turbo model: fast enough to comfortably fit inside Vercel Hobby's function
// timeout for short journal entries (see docs/roadmap.md Phase 4).
const GROQ_MODEL = "whisper-large-v3-turbo";

interface GroqSegment {
  text: string;
  start: number; // seconds
  end: number; // seconds
}

interface GroqVerboseJsonResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: GroqSegment[];
}

function extensionFromMimeType(mimeType: string): string {
  const subtype = mimeType.split(";")[0]?.split("/")[1];
  return subtype ?? "webm";
}

export class GroqASRProvider implements ASRProvider {
  readonly name = "groq" as const;

  async transcribe(
    audio: Buffer,
    mimeType: string,
    options?: TranscribeOptions,
  ): Promise<TranscriptionResult> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY is not set. Add it to your environment to use the Groq ASR provider.",
      );
    }

    const form = new FormData();
    const blob = new Blob([new Uint8Array(audio)], { type: mimeType });
    form.set("file", blob, `audio.${extensionFromMimeType(mimeType)}`);
    form.set("model", GROQ_MODEL);
    form.set("response_format", "verbose_json");
    if (options?.languageHint) form.set("language", options.languageHint);
    if (options?.prompt) form.set("prompt", options.prompt);

    const response = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Groq transcription failed (${response.status}): ${detail.slice(0, 500)}`,
      );
    }

    const data = (await response.json()) as GroqVerboseJsonResponse;

    return {
      text: data.text.trim(),
      language: data.language ?? null,
      durationMs: data.duration ? Math.round(data.duration * 1000) : 0,
      segments: (data.segments ?? []).map((s) => ({
        text: s.text.trim(),
        startMs: Math.round(s.start * 1000),
        endMs: Math.round(s.end * 1000),
      })),
      provider: this.name,
    };
  }
}
