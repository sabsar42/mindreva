import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { TranscriptsRepository } from "@mindreva/database";
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
  const [transcript, pendingCount] = await Promise.all([
    getMyEntryTranscript(entryId),
    TranscriptsRepository.countPendingByEntry(entryId, user.id),
  ]);
  if (!transcript) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Subtract 1 if the primary transcript itself is still in-flight so
  // pendingAddonCount only counts actual add-on recordings.
  const primaryIsPending =
    transcript.status === "pending" || transcript.status === "processing";
  const pendingAddonCount = Math.max(
    0,
    pendingCount - (primaryIsPending ? 1 : 0),
  );

  return NextResponse.json({
    id: transcript.id,
    status: transcript.status,
    rawText: transcript.rawText,
    editedText: transcript.editedText,
    language: transcript.language,
    provider: transcript.provider,
    pendingAddonCount,
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
  // An empty body is a valid edit now: the user may delete everything (the
  // journal editor supports real editing, including clearing a page).
  if (typeof editedText !== "string") {
    return NextResponse.json({ error: "Invalid editedText" }, { status: 400 });
  }
  // Autosave sends resummarize: false so a pause in typing doesn't spend an LLM
  // call; an explicit save (the default) still refreshes the summary.
  const resummarize = body?.resummarize !== false;

  const result = await saveMyTranscriptEdit(entryId, editedText, {
    resummarize,
  });
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: result.transcript.id,
    editedText: result.transcript.editedText,
    summary: result.summary
      ? {
          summaryText: result.summary.summaryText,
          provider: result.summary.provider,
        }
      : null,
    tasks: result.tasks,
  });
}
