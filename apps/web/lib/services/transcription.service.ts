import "server-only";
import { getASRProvider } from "@mindreva/asr";
import {
  RecordingsRepository,
  TranscriptsRepository,
  type TranscriptSegmentRow,
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
      // Kept so the transcript view can show timestamps. Providers that return
      // no timing (the Hugging Face fallback) store null rather than [].
      segments: result.segments.length > 0 ? result.segments : null,
    });
  } catch (err) {
    await TranscriptsRepository.setResult(transcript.id, userId, {
      status: "failed",
    }).catch(() => {});
    throw err;
  }
}

export class RecordingNotFoundError extends Error {
  constructor() {
    super("There is no saved recording for this entry.");
    this.name = "RecordingNotFoundError";
  }
}

export class NoTimestampsError extends Error {
  constructor() {
    super("The speech recognizer returned no timestamps for this recording.");
    this.name = "NoTimestampsError";
  }
}

/**
 * Adds timestamps to a transcript that was made before segments were stored,
 * by running the recognizer on the saved recording again. It writes ONLY the
 * segments: the transcript's raw_text and any edits the user made are left
 * untouched, so nothing they wrote is overwritten.
 *
 * Costs one ASR call, so it only runs when the user asks for it.
 */
export async function backfillTranscriptSegments(
  entryId: string,
  userId: string,
): Promise<TranscriptSegmentRow[]> {
  const recording = await RecordingsRepository.getByEntry(entryId, userId);
  if (!recording) throw new RecordingNotFoundError();
  const transcript = await TranscriptsRepository.getByEntry(entryId, userId);
  if (!transcript) throw new Error("Transcript not found for entry");

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("recordings")
    .download(recording.storagePath);
  if (error || !data) {
    throw new Error(
      `Could not download recording: ${error?.message ?? "unknown error"}`,
    );
  }

  const result = await getASRProvider().transcribe(
    Buffer.from(await data.arrayBuffer()),
    recording.mimeType ?? "audio/webm",
  );
  if (result.segments.length === 0) throw new NoTimestampsError();

  await TranscriptsRepository.setSegments(
    transcript.id,
    userId,
    result.segments,
  );
  return result.segments;
}
