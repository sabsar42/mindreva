import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import {
  EntryNotFoundError,
  addVoiceToEntry,
} from "@/lib/services/entries.service";
import { DailyLimitReachedError } from "@/lib/services/usage.service";

const MAX_DURATION_MS = 10 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AUDIO_BYTES = 4.5 * 1024 * 1024;
const TOO_LARGE_MESSAGE =
  "This recording is too large to upload. Your audio is kept; try a shorter one.";

/** Add a voice recording to an existing entry. Returns the new transcript id
 *  so the client can poll for the pending addon. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { entryId } = await params;
  // A malformed id is a 404, not a database error surfacing as a 500.
  if (!UUID.test(entryId)) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_AUDIO_BYTES + 64 * 1024) {
    return NextResponse.json({ error: TOO_LARGE_MESSAGE }, { status: 413 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: TOO_LARGE_MESSAGE }, { status: 413 });
  }

  const file = form.get("audio");
  const durationMsRaw = form.get("durationMs");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty recording" }, { status: 400 });
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: TOO_LARGE_MESSAGE }, { status: 413 });
  }
  if (file.type && !file.type.startsWith("audio/")) {
    return NextResponse.json({ error: "Not an audio file" }, { status: 400 });
  }

  const durationMs = Number(durationMsRaw);
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return NextResponse.json({ error: "Invalid durationMs" }, { status: 400 });
  }
  if (durationMs > MAX_DURATION_MS) {
    return NextResponse.json({ error: "Recording too long" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { transcriptId } = await addVoiceToEntry(entryId, {
      audio: buffer,
      mimeType: file.type || "audio/webm",
      durationMs,
    });
    return NextResponse.json({ transcriptId }, { status: 201 });
  } catch (err) {
    if (err instanceof EntryNotFoundError) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    if (err instanceof DailyLimitReachedError) {
      return NextResponse.json(
        { error: err.message, code: "limit" },
        { status: 429 },
      );
    }
    console.error(`POST /api/entries/${entryId}/recordings failed:`, err);
    return NextResponse.json(
      { error: "Failed to add recording" },
      { status: 500 },
    );
  }
}
