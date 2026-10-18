import { LIMIT_MESSAGE, isLimitError } from "@/lib/limit-error";
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

  // Streamed as newline-delimited JSON so the client can show which pipeline
  // step is genuinely running (embedding -> retrieving -> generating) rather
  // than a timed fake sequence. Each line is one event: {stage} while work is
  // in progress, then a final {reply, citedEntries} or {error}.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        const { reply, citedEntries } = await sendPersonaChatMessage(
          sessionId,
          question.trim(),
          (stage) => send({ stage }),
        );
        send({
          reply: {
            id: reply.id,
            content: reply.content,
            createdAt: reply.createdAt,
          },
          citedEntries,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        // The message-cap error is meant to be shown to the user verbatim;
        // other failures get a generic message.
        send({
          error: message.includes("message limit")
            ? message
            : isLimitError(err)
              ? LIMIT_MESSAGE
              : "Failed to send message",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
    },
  });
}
