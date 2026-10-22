import { LIMIT_MESSAGE, isLimitError } from "@/lib/limit-error";
import { DailyLimitReachedError } from "@/lib/services/usage.service";
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

/** Longest question accepted: plenty for a real question, bounded cost. */
const MAX_QUESTION_LENGTH = 2000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { sessionId } = await params;
  const body = (await request.json().catch(() => null)) as {
    question?: unknown;
    regenerate?: unknown;
  } | null;
  const regenerate = body?.regenerate === true;
  const question =
    typeof body?.question === "string" ? body.question.trim() : "";
  if (!regenerate && !question) {
    return NextResponse.json({ error: "Invalid question" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `Questions can be up to ${MAX_QUESTION_LENGTH} characters.` },
      { status: 400 },
    );
  }

  // Newline-delimited JSON, one event per line: {stage} as each real
  // pipeline step begins, {delta} for each piece of the reply as it is
  // written, then a final {reply, citedEntries, stopped}, {notice} (today's
  // limit) or {error}. If the browser goes away or presses Stop, generation
  // stops and the partial reply is kept.
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort());
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (event: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          open = false; // the client is gone
        }
      };
      try {
        const result = await sendPersonaChatMessage(sessionId, question, {
          regenerate,
          signal: abort.signal,
          onStage: (stage) => send({ stage }),
          onDelta: (text) => send({ delta: text }),
        });
        if (result) {
          send({
            reply: {
              id: result.reply.id,
              content: result.reply.content,
              createdAt: result.reply.createdAt,
            },
            citedEntries: result.citedEntries,
            stopped: result.stopped,
          });
        }
      } catch (err) {
        // Today's chat limit: a calm note in the conversation, not an error.
        if (err instanceof DailyLimitReachedError) {
          send({ notice: err.message });
          return;
        }
        if (abort.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        console.error(
          "POST /api/chat/[sessionId]/messages failed:",
          message.slice(0, 300),
        );
        // The message-cap and regenerate errors are meant for the user
        // verbatim; other failures get a generic message.
        send({
          error:
            message.includes("message limit") || message.includes("regenerate")
              ? message
              : isLimitError(err)
                ? LIMIT_MESSAGE
                : "Failed to send message",
        });
      } finally {
        if (open) {
          open = false;
          try {
            controller.close();
          } catch {
            // already closed by a cancel
          }
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
    },
  });
}
