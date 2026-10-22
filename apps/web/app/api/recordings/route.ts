import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { createVoiceEntry } from "@/lib/services/entries.service";
import { timed } from "@/lib/timing";
import { DailyLimitReachedError } from "@/lib/services/usage.service";
import type { EntryType } from "@mindreva/database";

// Hard cap matching the client-side 10-minute hard stop, so a modified client
// (or bug) can't push an oversized upload through this route.
const MAX_DURATION_MS = 10 * 60 * 1000;
// The client's duration is only a claim, so the file itself is capped too, at
// the platform's real ceiling: Vercel functions reject request bodies over
// 4.5 MB. The recorder encodes speech at 32 kbps, so a full 10-minute take is
// ~2.4 MB and fits with room to spare.
const MAX_AUDIO_BYTES = 4.5 * 1024 * 1024;
const TOO_LARGE_MESSAGE =
  "This recording is too large to upload. Your audio is kept; try a shorter one.";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_AUDIO_BYTES + 64 * 1024) {
    return NextResponse.json({ error: TOO_LARGE_MESSAGE }, { status: 413 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    // An oversized body arrives truncated and can't be parsed.
    return NextResponse.json({ error: TOO_LARGE_MESSAGE }, { status: 413 });
  }
  const file = form.get("audio");
  const durationMsRaw = form.get("durationMs");
  const typeRaw = form.get("type");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Empty recording" }, { status: 400 });
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: TOO_LARGE_MESSAGE }, { status: 413 });
  }
  // Browsers label recordings audio/* (Safari: audio/mp4). An empty type is
  // let through and stored as webm, as before.
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

  const type: EntryType = typeRaw === "note" ? "note" : "journal";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { entryId } = await timed(
      "recording-upload",
      "total",
      createVoiceEntry({
        audio: buffer,
        mimeType: file.type || "audio/webm",
        durationMs,
        type,
      }),
    );
    return NextResponse.json({ entryId }, { status: 201 });
  } catch (err) {
    if (err instanceof DailyLimitReachedError) {
      return NextResponse.json(
        { error: err.message, code: "limit" },
        { status: 429 },
      );
    }
    console.error("POST /api/recordings failed:", err);
    return NextResponse.json(
      { error: "Failed to create recording" },
      { status: 500 },
    );
  }
}
