"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { Button, Input, toast } from "@mindreva/ui";
import type { ChatRole } from "@mindreva/database";

interface Message {
  id: string;
  role: ChatRole;
  content: string;
  citedEntryIds: string[];
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
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground text-xs">
        Based on {entryIds.length} {entryIds.length === 1 ? "entry" : "entries"}
        :
      </span>
      {entryIds.map((id) => (
        <Link
          key={id}
          href={`/entries/${id}`}
          className="border-mint-200 bg-accent text-accent-foreground hover:bg-mint-100 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors"
        >
          {shortDateLabel(entryDates[id])}
        </Link>
      ))}
    </div>
  );
}

export function ChatConversation({
  sessionId,
  title,
  yearStart,
  yearEnd,
  initialMessages,
  initialEntryDates,
  entryCountInRange,
}: {
  sessionId: string;
  title: string;
  yearStart: number | null;
  yearEnd: number | null;
  initialMessages: Message[];
  initialEntryDates: Record<string, string | null>;
  entryCountInRange: number;
}) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<Message[]>(initialMessages);
  const [entryDates, setEntryDates] =
    React.useState<Record<string, string | null>>(initialEntryDates);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const rangeLabel =
    yearStart && yearEnd && yearStart !== yearEnd
      ? `${yearStart} – ${yearEnd}`
      : `Jan 1 – Dec 31, ${yearStart ?? yearEnd}`;

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to send");

      const citedEntryIds = (
        data.citedEntries as { entryId: string; entryDate: string | null }[]
      ).map((c) => c.entryId);
      setEntryDates((prev) => {
        const next = { ...prev };
        for (const c of data.citedEntries as {
          entryId: string;
          entryDate: string | null;
        }[]) {
          next[c.entryId] = c.entryDate;
        }
        return next;
      });

      setMessages((prev) => [
        ...prev,
        {
          id: data.reply.id,
          role: "assistant",
          content: data.reply.content,
          citedEntryIds,
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      setInput(question);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-5">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/chat")}
          aria-label="Back"
          className="text-foreground hover:bg-warm-100 -ml-2 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h1 className="text-foreground font-serif text-3xl font-bold leading-none tracking-tight">
            {title}
          </h1>
          <p className="text-muted-foreground mt-1 text-xs">{rangeLabel}</p>
        </div>
      </header>

      {entryCountInRange < 3 && (
        <div className="border-warning/30 bg-warning/10 text-foreground mt-4 rounded-lg border p-3.5 text-sm">
          {entryCountInRange === 0
            ? `There are no entries from this period, so I won't have anything to go on yet.`
            : `There ${entryCountInRange === 1 ? "is only 1 entry" : `are only ${entryCountInRange} entries`} from this period, so I might not have much to go on yet.`}
        </div>
      )}

      <div className="mt-4 flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="bg-warm-100 text-foreground max-w-[85%] rounded-2xl px-4 py-2.5 text-sm">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={m.id} className="flex flex-col items-start">
              <p className="text-foreground max-w-[90%] font-serif text-base leading-relaxed">
                {m.content}
              </p>
              <CitationChips
                entryIds={m.citedEntryIds}
                entryDates={entryDates}
              />
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-border flex items-center gap-2 border-t pt-3">
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
          disabled={sending}
          className="flex-1"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={sending || !input.trim()}
          aria-label="Send"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </main>
  );
}
