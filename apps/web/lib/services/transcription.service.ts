import "server-only";
import { getASRProvider } from "@mindreva/asr";
import {
  RecordingsRepository,
  TranscriptsRepository,
  type TranscriptSegmentRow,
} from "@mindreva/database";
import { createClient } from "@mindreva/auth/server";

/**
 * Transcribes one specific add-on recording and appends its recognized text
 * to the primary transcript's edited_text as a new paragraph. The add-on
 * transcript row stores the raw ASR output (raw_text + segments) so the
 * transcript sheet can show per-recording detail; the primary transcript's
 * edited_text is the single source of truth that the editor reads and writes.
 * Resolves to whether any text was added to the entry.
 */
export async function transcribeAddonRecording(
  entryId: string,
  userId: string,
  recordingId: string,
  addonTranscriptId: string,
  primaryTranscriptId: string,
): Promise<boolean> {
  const recording = await RecordingsRepository.getById(recordingId, userId);
  if (!recording) throw new Error("Recording not found");

  try {
    await TranscriptsRepository.setResult(addonTranscriptId, userId, {
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

    // Store ASR output on the addon transcript for the transcript sheet.
    await TranscriptsRepository.setResult(addonTranscriptId, userId, {
      status: "done",
      rawText: result.text,
      language: result.language,
      provider: result.provider,
      segments: result.segments.length > 0 ? result.segments : null,
    });

    // Append recognized text to the primary transcript so the editor sees
    // all recordings combined (atomically, so a simultaneous edit or a
    // second add-on isn't overwritten). When the add-on IS the primary (an
    // entry that had no transcript), its raw text already is the entry text;
    // appending it to itself would duplicate it. Silence appends nothing.
    if (primaryTranscriptId === addonTranscriptId)
      return Boolean(result.text.trim());
    return TranscriptsRepository.appendToEditedText(
      primaryTranscriptId,
      userId,
      result.text,
    );
  } catch (err) {
    await TranscriptsRepository.setResult(addonTranscriptId, userId, {
      status: "failed",
    }).catch(() => {});
    throw err;
  }
}

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
