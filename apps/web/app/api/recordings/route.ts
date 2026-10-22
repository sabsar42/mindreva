import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { createVoiceEntry } from "@/lib/services/entries.service";
import { timed } from "@/lib/timing";
import type { EntryType } from "@mindreva/database";

// Hard cap matching the client-side 10-minute hard stop, so a modified client
// (or bug) can't push an oversized upload through this route.
const MAX_DURATION_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("audio");
  const durationMsRaw = form.get("durationMs");
  const typeRaw = form.get("type");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
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
    console.error("POST /api/recordings failed:", err);
    return NextResponse.json(
      { error: "Failed to create recording" },
      { status: 500 },
    );
  }
}
