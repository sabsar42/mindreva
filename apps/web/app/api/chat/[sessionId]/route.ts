import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { deleteMyChatSession } from "@/lib/services/persona-chat.service";

/** Soft-delete one conversation. Scoped to the caller's own sessions. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { sessionId } = await params;
  await deleteMyChatSession(sessionId);
  return NextResponse.json({ ok: true });
}
