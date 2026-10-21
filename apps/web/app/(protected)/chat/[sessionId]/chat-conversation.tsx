"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Send } from "lucide-react";
import { Button, Input, buttonVariants, cn, toast } from "@mindreva/ui";
// Imported via the direct subpath, NOT the "@mindreva/llm" barrel: the barrel
// re-exports getLLMProvider, which pulls the Anthropic/Google/Groq SDKs into
// whatever bundle imports it. This is a client component, so that would ship
// all three to the browser (the same barrel-leak mistake documented twice in
// docs/CHANGELOG.md for @mindreva/ui's Lexical export).
import { NO_RECORD_REPLY } from "@mindreva/llm/persona-chat-prompt";
import type { ChatRole } from "@mindreva/database";
import { RangeContextPanel } from "./range-context-panel";
import { RiverPanel } from "../../river/river-panel";
import type { RiverData } from "@/lib/services/mindmap.service";
import { PrefetchLink } from "../../_components/prefetch-link";

interface Message {
  id: string;
  role: ChatRole;
  content: string;
  citedEntryIds: string[];
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

/**
 * A reply that honestly reports having nothing for this period gets a softer
 * treatment than a normal reply — it's a gentle answer, not an error. Matched
 * against the exact sentence the prompt instructs the model to use
 * (NO_RECORD_REPLY), so prompt and UI can't drift apart.
 */
function isNoRecordReply(content: string): boolean {
  return content.trim().toLowerCase().includes(NO_RECORD_REPLY.toLowerCase());
}

function shortDateLabel(dateKey: string | null | undefined): string {
  if (!dateKey) return "undated";
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function CitationChips({
  entryIds,
  entryDates,
}: {
  entryIds: string[];
  entryDates: Record<string, string | null>;
}) {
  if (entryIds.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-xs">From your entries:</span>
      {entryIds.map((id) => (
        <PrefetchLink
          key={id}
          href={`/entries/${id}`}
          className="border-border text-foreground hover:bg-secondary rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        >
          {shortDateLabel(entryDates[id])}
        </PrefetchLink>
      ))}
    </div>
  );
}

export interface OpeningLine {
  entryId: string;
  entryDate: string | null;
  text: string;
}

export function ChatConversation({
  sessionId,
  title,
  rangeLabel,
  yearStart,
  initialMessages,
  initialEntryDates,
  entryCountInRange,
  suggestedMinEntries,
  entriesPerMonth,
  monthRange,
  isSingleYear,
  openingLine,
  river,
}: {
  sessionId: string;
  title: string;
  /** e.g. "January – June 2026", from the session's own range. */
  rangeLabel: string;
  yearStart: number | null;
  initialMessages: Message[];
  initialEntryDates: Record<string, string | null>;
  entryCountInRange: number;
  suggestedMinEntries: number;
  entriesPerMonth: Record<number, number>;
  monthRange: [number, number];
  isSingleYear: boolean;
  openingLine: OpeningLine | null;
  river: RiverData;
}) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<Message[]>(initialMessages);
  const [entryDates, setEntryDates] =
    React.useState<Record<string, string | null>>(initialEntryDates);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [stage, setStage] = React.useState<Stage | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, stage]);

  async function handleSend() {
    const question = input.trim();
    if (!question || sending) return;
    setSending(true);
    setInput("");

    const userMessage: Message = {
      id: `local-${Date.now()}`,
      role: "user",
      content: question,
      citedEntryIds: [],
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const res = await fetch(`/api/chat/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok || !res.body) throw new Error("Failed to send");

      // Newline-delimited JSON: a {stage} event as each real pipeline step
      // begins, then a final {reply, citedEntries} or {error}.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let final: {
        reply?: { id: string; content: string };
        citedEntries?: { entryId: string; entryDate: string | null }[];
        error?: string;
      } | null = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.stage) setStage(event.stage as Stage);
          else final = event;
        }
      }

      if (!final || final.error || !final.reply) {
        throw new Error(final?.error ?? "Failed to send");
      }
      const { reply, citedEntries = [] } = final;

      setEntryDates((prev) => {
        const next = { ...prev };
        for (const c of citedEntries) next[c.entryId] = c.entryDate;
        return next;
      });

      setMessages((prev) => [
        ...prev,
        {
          id: reply.id,
          role: "assistant",
          content: reply.content,
          citedEntryIds: citedEntries.map((c) => c.entryId),
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      setInput(question);
    } finally {
      setSending(false);
      setStage(null);
    }
  }

  return (
    <main className="min-h-app mx-auto flex flex-col px-5 py-5">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            // router.back() reuses the Router Cache for /chat instead of a
            // fresh server render; router.push() to the same URL is always a
            // fresh navigation. See entry-detail.tsx's back button.
            if (window.history.length > 1) {
              router.back();
            } else {
              router.push("/chat");
            }
          }}
          aria-label="Back"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "-ml-3 [&_svg]:size-7",
          )}
        >
          <ChevronLeft />
        </button>
        <div>
          <h1 className="text-foreground text-2xl font-bold leading-none tracking-tight">
            {title}
          </h1>
          <p className="text-muted-foreground mt-1 text-xs">{rangeLabel}</p>
        </div>
      </header>

      {/* Collapsed by default here: the conversation owns this screen, the
          river is one tap away rather than competing for the space. */}
      <RiverPanel
        data={river}
        collapsible
        storageKey="mindreva:conversation-river"
        defaultOpen={false}
        className="mt-4"
      />

      {isSingleYear && entryCountInRange < suggestedMinEntries && (
        <RangeContextPanel
          entryCount={entryCountInRange}
          suggestedMin={suggestedMinEntries}
          entriesPerMonth={entriesPerMonth}
          monthRange={monthRange}
          year={yearStart}
        />
      )}

      <div className="mt-4 flex-1 space-y-4 overflow-y-auto pb-4">
        {/* Opens with something the user actually wrote, so the conversation
            starts from real text rather than a blank box or an invented
            greeting. Only shown before the first exchange. */}
        {openingLine && messages.length === 0 && (
          <div className="flex flex-col items-start">
            <p className="text-foreground max-w-[90%] font-serif text-base leading-relaxed">
              {openingLine.text}
            </p>
            <CitationChips
              entryIds={[openingLine.entryId]}
              entryDates={{ [openingLine.entryId]: openingLine.entryDate }}
            />
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div
              key={m.id}
              className="motion-safe:animate-page-in flex justify-end"
            >
              <p className="bg-gradient-primary text-primary-foreground shadow-subtle max-w-[85%] rounded-3xl rounded-br-lg px-4 py-2.5 text-sm leading-relaxed">
                {m.content}
              </p>
            </div>
          ) : (
            <div
              key={m.id}
              className="motion-safe:animate-page-in flex flex-col items-start"
            >
              <p
                className={cn(
                  "max-w-[90%] font-serif text-base leading-relaxed",
                  // An honest "nothing written about that" is a gentle
                  // answer, not an error — softer than a normal reply.
                  isNoRecordReply(m.content)
                    ? "text-muted-foreground italic"
                    : "text-foreground",
                )}
              >
                {m.content}
              </p>
              <CitationChips
                entryIds={m.citedEntryIds}
                entryDates={entryDates}
              />
            </div>
          ),
        )}

        {stage && (
          <p
            aria-live="polite"
            className="text-muted-foreground animate-pulse text-sm italic"
          >
            {STAGE_COPY[stage]}
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-separator bg-material pb-safe-3 sticky bottom-0 -mx-5 flex items-center gap-2 border-t-[0.5px] px-5 pt-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Ask your past self…"
          aria-label="Ask your past self"
          enterKeyHint="send"
          autoComplete="off"
          // readOnly, not disabled: a disabled field loses focus, which
          // drops the iOS keyboard after every message.
          readOnly={sending}
          className="flex-1"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={sending || !input.trim()}
          aria-label="Send"
          variant="primary"
        >
          <Send />
        </Button>
      </div>
    </main>
  );
}
