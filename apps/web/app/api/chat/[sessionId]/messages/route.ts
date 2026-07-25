import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import {
  listMyChatMessages,
  sendPersonaChatMessage,
} from "@/lib/services/persona-chat.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { sessionId } = await params;
  const messages = await listMyChatMessages(sessionId);
  return NextResponse.json({ messages });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { sessionId } = await params;
  const body = await request.json().catch(() => null);
  const question = body?.question;
  if (typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "Invalid question" }, { status: 400 });
  }

  try {
    const { reply, citedEntries } = await sendPersonaChatMessage(
      sessionId,
      question.trim(),
    );
    return NextResponse.json({
      reply: {
        id: reply.id,
        content: reply.content,
        createdAt: reply.createdAt,
      },
      citedEntries,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    // The message-cap error is meant to be shown to the user verbatim; other
    // failures get a generic message.
    const isCapError = message.includes("message limit");
    return NextResponse.json(
      { error: isCapError ? message : "Failed to send message" },
      { status: isCapError ? 429 : 500 },
    );
  }
}
