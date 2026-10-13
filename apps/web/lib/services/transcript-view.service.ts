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
    fallbackText: transcript.rawText ?? transcript.editedText ?? null,
    canGenerateTimestamps,
  };
}

/** Runs the recognizer again to add timestamps. See backfillTranscriptSegments. */
export async function generateMyTranscriptTimestamps(
  entryId: string,
): Promise<TranscriptSegmentRow[]> {
  const userId = await requireUserId();
  return backfillTranscriptSegments(entryId, userId);
}
