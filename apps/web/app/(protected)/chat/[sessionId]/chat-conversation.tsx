"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { buttonVariants, cn, toast } from "@mindreva/ui";
// Imported via the direct subpath, NOT the "@mindreva/llm" barrel: the barrel
// re-exports getLLMProvider, which pulls the Anthropic/Google/Groq SDKs into
// whatever bundle imports it. This is a client component, so that would ship
// all three to the browser (the same barrel-leak mistake documented twice in
// docs/CHANGELOG.md for @mindreva/ui's Lexical export).
import { isNoRecordReply } from "@mindreva/llm/persona-chat-prompt";
import type { ChatRole } from "@mindreva/database";
import { RangeContextPanel } from "./range-context-panel";
import { CitationChips, type CitationInfo } from "./citation-chips";
import { MessageBubble, type BubbleStatus } from "./message-bubble";
import { ChatComposer } from "./chat-composer";

interface Message {
  id: string;
  role: ChatRole;
  content: string;
  citedEntryIds: string[];
  status?: BubbleStatus;
}

/** The real pipeline steps, mirrored from persona-chat.service.ts. */
type Stage = "embedding" | "retrieving" | "generating";

/**
 * Warm copy tied to what's genuinely happening in the pipeline — the server
 * streams each stage as it actually begins, so these aren't on a timer.
 */
const STAGE_COPY: Record<Stage, string> = {
  embedding: "Listening for what you're asking…",
  retrieving: "Flipping back through the pages…",
  generating: "Finding the words you used back then…",
};

/** Questions that exercise retrieval well; shown before the first message. */
const SUGGESTIONS = [
  "What was on my mind most in these months?",
  "What made me happy back then?",
  "What was I worried about?",
  "Who did I spend time with?",
];

/** Follow new content only if the reader is already near the bottom. */
const NEAR_BOTTOM_PX = 140;
const draftKey = (sessionId: string) => `mindreva:chat-draft:${sessionId}`;

export interface OpeningLine {
  entryId: string;
  entryDate: string | null;
  text: string;
}

interface FinalEvent {
  reply?: { id: string; content: string };
  citedEntries?: {
    entryId: string;
    entryDate: string | null;
    entryTitle?: string | null;
  }[];
  stopped?: boolean;
  error?: string;
  notice?: string;
}

function isNearBottom(): boolean {
  return (
    window.innerHeight + window.scrollY >=
    document.documentElement.scrollHeight - NEAR_BOTTOM_PX
  );
}

function scrollToBottom(behavior: ScrollBehavior) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({
    top: document.documentElement.scrollHeight,
    behavior: reduce ? "auto" : behavior,
  });
}

export function ChatConversation({
  sessionId,
  title,
  rangeLabel,
  yearStart,
  initialMessages,
  initialCitationInfo,
  entryCountInRange,
  suggestedMinEntries,
  entriesPerMonth,
  monthRange,
  isSingleYear,
  openingLine,
}: {
  sessionId: string;
  title: string;
  /** e.g. "January – June 2026", from the session's own range. */
  rangeLabel: string;
  yearStart: number | null;
  initialMessages: Message[];
  initialCitationInfo: Record<string, CitationInfo>;
  entryCountInRange: number;
  suggestedMinEntries: number;
  entriesPerMonth: Record<number, number>;
  monthRange: [number, number];
  isSingleYear: boolean;
  openingLine: OpeningLine | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<Message[]>(initialMessages);
  const [info, setInfo] =
    React.useState<Record<string, CitationInfo>>(initialCitationInfo);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [stage, setStage] = React.useState<Stage | null>(null);
  /** The reply being written right now, or null. */
  const [streaming, setStreaming] = React.useState<string | null>(null);
  // A calm "come back tomorrow" note when today's chat limit is reached.
  const [notice, setNotice] = React.useState<string | null>(null);
  const [showJump, setShowJump] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const followRef = React.useRef(true);

  // The draft survives leaving the screen (restored after hydration, so the
  // server and client render the same empty box first).
  React.useEffect(() => {
    try {
      const saved = sessionStorage.getItem(draftKey(sessionId));
      if (saved) setInput(saved);
    } catch {
      /* storage blocked */
    }
  }, [sessionId]);
  const updateInput = React.useCallback(
    (value: string) => {
      setInput(value);
      try {
        if (value) sessionStorage.setItem(draftKey(sessionId), value);
        else sessionStorage.removeItem(draftKey(sessionId));
      } catch {
        /* storage blocked */
      }
    },
    [sessionId],
  );

  // Track whether the reader is at the bottom, and offer a way back if not.
  React.useEffect(() => {
    const onScroll = () => {
      const near = isNearBottom();
      followRef.current = near;
      setShowJump(!near);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Start at the latest message.
  React.useEffect(() => {
    if (initialMessages.length) scrollToBottom("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New content: follow it only if the reader was already at the bottom.
  React.useEffect(() => {
    if (followRef.current)
      scrollToBottom(streaming !== null ? "auto" : "smooth");
  }, [messages, streaming, stage, notice]);

  // The keyboard opening shrinks the visual viewport: keep the last message
  // in view instead of letting it slide under the keyboard.
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      if (followRef.current) scrollToBottom("auto");
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  const lastAssistantIndex = messages.findLastIndex(
    (m) => m.role === "assistant",
  );

  async function run(opts: {
    question: string;
    regenerate?: boolean;
    retryId?: string;
  }) {
    if (busy) return;
    const { question, regenerate = false, retryId } = opts;
    setBusy(true);
    setNotice(null);
    setStage(null);
    followRef.current = true;

    // Optimistic: the question appears at once (or a failed one is retried
    // in place). Regenerate keeps the old reply visible until the new one
    // starts, and restores it if anything goes wrong.
    const localId = retryId ?? `local-${Date.now()}`;
    let replaced: Message | null = null;
    if (regenerate) {
      const last = messages.at(-1);
      if (last?.role === "assistant") replaced = last;
    } else if (retryId) {
      setMessages((prev) =>
        prev.map((m) => (m.id === retryId ? { ...m, status: "sending" } : m)),
      );
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: localId,
          role: "user",
          content: question,
          citedEntryIds: [],
          status: "sending",
        },
      ]);
      updateInput("");
    }

    const controller = new AbortController();
    abortRef.current = controller;
    let text = "";
    let frame = 0;
    const flush = () => {
      frame = 0;
      setStreaming(text);
    };

    try {
      const res = await fetch(`/api/chat/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(regenerate ? { regenerate: true } : { question }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to send");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let final: FinalEvent | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.stage) {
            setStage(event.stage as Stage);
          } else if (typeof event.delta === "string") {
            if (!text && regenerate && replaced) {
              setMessages((prev) => prev.filter((m) => m.id !== replaced!.id));
            }
            text += event.delta;
            // One render per frame, however fast the tokens arrive.
            if (!frame) frame = requestAnimationFrame(flush);
          } else {
            final = event as FinalEvent;
          }
        }
      }
      if (frame) cancelAnimationFrame(frame);

      if (final?.notice) {
        // Not an error: the question goes back in the box for tomorrow.
        setNotice(final.notice);
        if (regenerate) {
          if (replaced) {
            setMessages((prev) =>
              prev.some((m) => m.id === replaced!.id)
                ? prev
                : [...prev, replaced!],
            );
          }
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== localId));
          updateInput(question);
        }
        return;
      }
      if (!final?.reply) throw new Error(final?.error ?? "Failed to send");

      const { reply, citedEntries = [], stopped = false } = final;
      setInfo((prev) => {
        const next = { ...prev };
        for (const c of citedEntries) {
          next[c.entryId] = { date: c.entryDate, title: c.entryTitle ?? null };
        }
        return next;
      });
      setMessages((prev) => [
        ...prev
          .filter((m) => !(regenerate && replaced && m.id === replaced.id))
          .map((m) =>
            m.id === localId ? { ...m, status: "sent" as const } : m,
          ),
        {
          id: reply.id,
          role: "assistant",
          content: reply.content,
          citedEntryIds: citedEntries.map((c) => c.entryId),
          status: stopped ? "stopped" : "sent",
        },
      ]);
    } catch (err) {
      if (frame) cancelAnimationFrame(frame);
      if (controller.signal.aborted) {
        // Stopped by the user: keep what was already written (the server
        // saved the same partial reply).
        setMessages((prev) => {
          const kept = prev.map((m) =>
            m.id === localId ? { ...m, status: "sent" as const } : m,
          );
          if (text.trim()) {
            return [
              ...kept.filter((m) => !(replaced && m.id === replaced.id)),
              {
                id: `stopped-${Date.now()}`,
                role: "assistant" as const,
                content: text.trim(),
                citedEntryIds: [],
                status: "stopped" as const,
              },
            ];
          }
          return replaced && !kept.some((m) => m.id === replaced!.id)
            ? [...kept, replaced]
            : kept;
        });
      } else {
        const message =
          err instanceof Error ? err.message : "Something went wrong";
        if (regenerate) {
          if (replaced) {
            setMessages((prev) =>
              prev.some((m) => m.id === replaced!.id)
                ? prev
                : [...prev, replaced!],
            );
          }
          toast.error(message);
        } else {
          // The question stays on screen, marked, with an inline Retry.
          setMessages((prev) =>
            prev.map((m) =>
              m.id === localId ? { ...m, status: "failed" } : m,
            ),
          );
          if (
            message !== "Failed to send" &&
            message !== "Failed to send message"
          ) {
            toast.error(message);
          }
        }
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      setStage(null);
      setStreaming(null);
    }
  }

  const empty = messages.length === 0;

  return (
    <main className="min-h-app mx-auto flex flex-col px-4 pb-2">
      <header className="bg-material border-separator pt-safe sticky top-0 z-10 -mx-4 flex items-center gap-1 border-b-[0.5px] px-2 pb-2">
        <button
          type="button"
          onClick={() => {
            // router.back() reuses the Router Cache for /chat instead of a
            // fresh server render; router.push() to the same URL is always a
            // fresh navigation. See entry-detail.tsx's back button.
            if (window.history.length > 1) router.back();
            else router.push("/chat");
          }}
          aria-label="Back"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "[&_svg]:size-7",
          )}
        >
          <ChevronLeft />
        </button>
        <div className="min-w-0 pt-2">
          <h1 className="text-foreground text-headline truncate">{title}</h1>
          <p className="text-muted-foreground text-caption">{rangeLabel}</p>
        </div>
      </header>

      {isSingleYear && entryCountInRange < suggestedMinEntries && (
        <RangeContextPanel
          entryCount={entryCountInRange}
          suggestedMin={suggestedMinEntries}
          entriesPerMonth={entriesPerMonth}
          monthRange={monthRange}
          year={yearStart}
        />
      )}

      <div className="mt-5 flex-1 pb-4">
        {empty && (
          <section aria-label="Start the conversation" className="mb-6">
            {/* Opens with something the user actually wrote, so the
                conversation starts from real text rather than an invented
                greeting. */}
            {openingLine && (
              <MessageBubble role="assistant" content={openingLine.text}>
                <CitationChips
                  entryIds={[openingLine.entryId]}
                  info={{
                    [openingLine.entryId]: {
                      date: openingLine.entryDate,
                      title: null,
                    },
                  }}
                />
              </MessageBubble>
            )}
            <p className="text-muted-foreground text-subhead mb-3 mt-2">
              Ask about anything you wrote in these months. A few ideas:
            </p>
            <div className="flex flex-col items-start gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => void run({ question: s })}
                  className="border-separator bg-card text-foreground text-subhead focus-visible:ring-ring press min-h-11 rounded-full border-[0.5px] px-4 text-left focus-visible:outline-none focus-visible:ring-2"
                >
                  {s}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Finished messages are a log: screen readers hear each new one
            once. The reply being written is outside it (below), so it isn't
            read out token by token. */}
        <div role="log" aria-live="polite" aria-label="Conversation">
          {messages.map((m, i) => {
            const next = messages[i + 1];
            const lastInGroup = !next || next.role !== m.role;
            const noRecord =
              m.role === "assistant" && isNoRecordReply(m.content);
            return (
              <MessageBubble
                key={m.id}
                role={m.role}
                content={m.content}
                status={m.status}
                noRecord={noRecord}
                lastInGroup={lastInGroup}
                canRegenerate={
                  m.role === "assistant" &&
                  i === lastAssistantIndex &&
                  i === messages.length - 1 &&
                  !busy
                }
                onRegenerate={() =>
                  void run({ question: "", regenerate: true })
                }
                onRetry={() => void run({ question: m.content, retryId: m.id })}
              >
                {m.role === "assistant" && !noRecord && (
                  <CitationChips entryIds={m.citedEntryIds} info={info} />
                )}
              </MessageBubble>
            );
          })}
        </div>

        {busy && streaming === null && (
          <div className="mb-3 flex flex-col items-start">
            <div
              className="bg-card border-separator flex h-10 items-center gap-1 rounded-xl rounded-bl-md border-[0.5px] px-4"
              aria-hidden
            >
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="bg-muted-foreground/60 size-2 rounded-full motion-safe:animate-bounce"
                  style={{ animationDelay: `${d * 140}ms` }}
                />
              ))}
            </div>
            <p
              className="text-muted-foreground text-caption mt-1 px-1"
              role="status"
            >
              {stage ? STAGE_COPY[stage] : "Thinking back…"}
            </p>
          </div>
        )}

        {streaming !== null && (
          <div aria-hidden>
            <MessageBubble role="assistant" content={streaming || " "} />
          </div>
        )}
        {streaming !== null && (
          <p className="sr-only" role="status">
            Writing a reply…
          </p>
        )}

        {notice && (
          <div className="mb-3 flex flex-col items-start" role="status">
            <div className="border-border text-muted-foreground max-w-[80%] rounded-xl rounded-bl-md border border-dashed px-4 py-2.5 font-serif text-[1.0625rem] italic leading-relaxed">
              {notice}
            </div>
          </div>
        )}
      </div>

      <div className="bg-material border-separator pb-safe-3 sticky bottom-0 -mx-4 border-t-[0.5px] px-4 pt-2.5">
        {showJump && (messages.length > 0 || busy) && (
          <button
            type="button"
            onClick={() => {
              followRef.current = true;
              scrollToBottom("smooth");
            }}
            className="bg-card border-separator text-foreground text-footnote shadow-elevated press motion-safe:animate-fade-in absolute -top-12 left-1/2 inline-flex h-9 -translate-x-1/2 items-center gap-1 rounded-full border-[0.5px] px-3 font-semibold"
          >
            <ChevronDown className="size-4" aria-hidden />
            Jump to latest
          </button>
        )}
        <ChatComposer
          value={input}
          onChange={updateInput}
          onSend={() => void run({ question: input.trim() })}
          onStop={() => abortRef.current?.abort()}
          busy={busy}
          paused={notice !== null}
          pausedHint="You can ask again tomorrow"
        />
      </div>
    </main>
  );
}
