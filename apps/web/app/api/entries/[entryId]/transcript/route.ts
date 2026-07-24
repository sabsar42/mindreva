import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import {
  getMyEntryTranscript,
  saveMyTranscriptEdit,
} from "@/lib/services/entries.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { entryId } = await params;
  const transcript = await getMyEntryTranscript(entryId);
  if (!transcript) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: transcript.id,
    status: transcript.status,
    rawText: transcript.rawText,
    editedText: transcript.editedText,
    language: transcript.language,
    provider: transcript.provider,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { entryId } = await params;
  const body = await request.json().catch(() => null);
  const editedText = body?.editedText;
  if (typeof editedText !== "string" || editedText.trim().length === 0) {
    return NextResponse.json({ error: "Invalid editedText" }, { status: 400 });
  }

  const transcript = await saveMyTranscriptEdit(entryId, editedText);
  if (!transcript) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: transcript.id,
    editedText: transcript.editedText,
  });
}
