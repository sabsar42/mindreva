import "server-only";
import {
  RecordingsRepository,
  TranscriptsRepository,
  type TranscriptSegmentRow,
  type TranscriptStatus,
} from "@mindreva/database";
import { getUser } from "@mindreva/auth/server";
import { backfillTranscriptSegments } from "./transcription.service";

async function requireUserId(): Promise<string> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export interface TranscriptView {
  status: TranscriptStatus | null;
  /** Timed segments, oldest first. Null when none were stored. */
  segments: TranscriptSegmentRow[] | null;
  /**
   * The recognized words as plain text, used when there are no segments. This
   * is the recognizer's own output (raw_text), not the user's edited body.
   */
  fallbackText: string | null;
  /** True when timestamps could be produced now (a recording exists). */
  canGenerateTimestamps: boolean;
}

/** One recording's transcript data, as shown in the multi-recording sheet. */
export interface RecordingTranscriptView extends TranscriptView {
  /** 1-based index shown to the user ("Recording 1", "Recording 2", …). */
  recordingIndex: number;
  /** ISO timestamp of when this recording was saved. */
  recordedAt: string;
}

/** Read-only transcript for the "view transcript" panel. Never returns audio. */
export async function getMyTranscriptView(
  entryId: string,
): Promise<TranscriptView | null> {
  const userId = await requireUserId();
  const transcript = await TranscriptsRepository.getByEntry(entryId, userId);
  if (!transcript) return null;

  const segments =
    transcript.segments && transcript.segments.length > 0
      ? [...transcript.segments].sort((a, b) => a.startMs - b.startMs)
      : null;

  let canGenerateTimestamps = false;
  if (!segments && transcript.status === "done") {
    canGenerateTimestamps = Boolean(
      await RecordingsRepository.getByEntry(entryId, userId),
    );
  }

  return {
    status: transcript.status,
    segments,
    // editedText first: for entries with addon recordings, appendToEditedText
    // accumulates all paragraphs there. rawText only has the first recording.
    fallbackText: transcript.editedText ?? transcript.rawText ?? null,
    canGenerateTimestamps,
  };
}

/**
 * All recordings for an entry, each paired with its transcript data.
 * Used by the transcript sheet to show per-recording sections with timestamps.
 * Recordings and transcripts are matched by creation order (oldest first).
 */
export async function getAllMyTranscriptViews(
  entryId: string,
): Promise<RecordingTranscriptView[]> {
  const userId = await requireUserId();
  const [allRecordings, allTranscripts] = await Promise.all([
    RecordingsRepository.getAllByEntry(entryId, userId),
    TranscriptsRepository.getAllByEntry(entryId, userId),
  ]);

  if (allRecordings.length === 0) return [];

  // Text entries have one transcript (the body) that has no corresponding
  // recording; voice entries have a 1:1 transcript-to-recording mapping.
  // The offset skips any leading non-recording transcripts so each recording
  // is paired with the transcript that was created alongside it.
  const offset = Math.max(0, allTranscripts.length - allRecordings.length);
  const recordingTranscripts = allTranscripts.slice(offset);

  const firstTranscript = recordingTranscripts[0];
  const firstHasSegments =
    firstTranscript?.segments != null && firstTranscript.segments.length > 0;
  const firstCanGenerate =
    !firstHasSegments && firstTranscript?.status === "done";

  return allRecordings.map((recording, i) => {
    const transcript = recordingTranscripts[i];
    const segments =
      transcript?.segments && transcript.segments.length > 0
        ? [...transcript.segments].sort((a, b) => a.startMs - b.startMs)
        : null;
    return {
      recordingIndex: i + 1,
      recordedAt: recording.createdAt.toISOString(),
      status: transcript?.status ?? null,
      segments,
      fallbackText: transcript?.rawText ?? transcript?.editedText ?? null,
      canGenerateTimestamps: i === 0 ? firstCanGenerate : false,
    };
  });
}

/** Runs the recognizer again to add timestamps. See backfillTranscriptSegments. */
export async function generateMyTranscriptTimestamps(
  entryId: string,
): Promise<TranscriptSegmentRow[]> {
  const userId = await requireUserId();
  return backfillTranscriptSegments(entryId, userId);
}
