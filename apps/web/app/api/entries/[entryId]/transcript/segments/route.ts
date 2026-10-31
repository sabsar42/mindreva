import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { getMyTranscriptView } from "@/lib/services/transcript-view.service";
import { generateMyTranscriptTimestamps } from "@/lib/services/transcript-view.service";
import {
  NoTimestampsError,
  RecordingNotFoundError,
} from "@/lib/services/transcription.service";

/**
 * Combined transcript for the transcript sheet.
 * Returns the primary transcript's editedText, which accumulates all recording
 * paragraphs via appendToEditedText — so the user sees everything at once.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { entryId } = await params;
  const view = await getMyTranscriptView(entryId);
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    recordings: [{ recordingIndex: 1, recordedAt: null, ...view }],
  });
}

/**
 * Add timestamps to a transcript recorded before they were stored, by running
 * the recognizer on the saved recording again. Writes only the segments.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { entryId } = await params;
  try {
    const segments = await generateMyTranscriptTimestamps(entryId);
    return NextResponse.json({ segments });
  } catch (err) {
    if (err instanceof RecordingNotFoundError) {
      return NextResponse.json(
        { error: "no_recording", message: err.message },
        { status: 404 },
      );
    }
    if (err instanceof NoTimestampsError) {
      return NextResponse.json(
        { error: "no_timestamps", message: err.message },
        { status: 422 },
      );
    }
    console.error(
      `POST /api/entries/${entryId}/transcript/segments failed:`,
      err,
    );
    return NextResponse.json(
      { error: "Couldn't generate timestamps" },
      { status: 500 },
    );
  }
}
