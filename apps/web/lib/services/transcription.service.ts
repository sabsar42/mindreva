import "server-only";
import { getASRProvider } from "@mindreva/asr";
import {
  RecordingsRepository,
  TranscriptsRepository,
} from "@mindreva/database";
import { createClient } from "@mindreva/auth/server";

/**
 * Runs the ASR call for an entry's recording and updates the transcript row
 * to 'done' or 'failed'. Called synchronously right after upload (Phase 4's
 * documented tradeoff — see docs/roadmap.md Common mistakes on function
 * timeouts). Never branches on which ASRProvider is active; that knowledge
 * stays inside packages/asr.
 */
export async function transcribeEntry(
  entryId: string,
  userId: string,
): Promise<void> {
  const recording = await RecordingsRepository.getByEntry(entryId, userId);
  if (!recording) throw new Error("Recording not found for entry");

  const transcript = await TranscriptsRepository.getByEntry(entryId, userId);
  if (!transcript) throw new Error("Transcript not found for entry");

  try {
    await TranscriptsRepository.setResult(transcript.id, userId, {
      status: "processing",
    });

    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from("recordings")
      .download(recording.storagePath);
    if (error || !data) {
      throw new Error(
        `Could not download recording: ${error?.message ?? "unknown error"}`,
      );
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const mimeType = recording.mimeType ?? "audio/webm";

    const result = await getASRProvider().transcribe(buffer, mimeType);

    await TranscriptsRepository.setResult(transcript.id, userId, {
      status: "done",
      rawText: result.text,
      language: result.language,
      provider: result.provider,
    });
  } catch (err) {
    await TranscriptsRepository.setResult(transcript.id, userId, {
      status: "failed",
    }).catch(() => {});
    throw err;
  }
}
