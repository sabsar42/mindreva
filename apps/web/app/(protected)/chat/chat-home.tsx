"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { Button, Card, Input, Logo, OptionCard, toast } from "@mindreva/ui";
import type { ChatSession } from "@mindreva/database";

export function ChatHome({
  sessions,
  availableYears,
}: {
  sessions: ChatSession[];
  availableYears: number[];
}) {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = React.useState<number | null>(
    availableYears[0] ?? null,
  );
  const [customRange, setCustomRange] = React.useState(false);
  const [rangeStart, setRangeStart] = React.useState(
    String(availableYears.at(-1) ?? new Date().getFullYear()),
  );
  const [rangeEnd, setRangeEnd] = React.useState(
    String(availableYears[0] ?? new Date().getFullYear()),
  );
  const [starting, setStarting] = React.useState(false);

  async function startSession(yearStart: number, yearEnd: number) {
    setStarting(true);
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearStart, yearEnd }),
      });
      if (!res.ok) throw new Error("Failed to start");
      const data = (await res.json()) as { session: ChatSession };
      router.push(`/chat/${data.session.id}`);
    } catch {
      toast.error("Couldn't start a new chat. Please try again.");
      setStarting(false);
    }
  }

  function handleStart() {
    if (customRange) {
      const start = Number(rangeStart);
      const end = Number(rangeEnd);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
        toast.error("Enter a valid year range.");
        return;
      }
      void startSession(start, end);
    } else if (selectedYear) {
      void startSession(selectedYear, selectedYear);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-6">
      <header className="flex items-center gap-3">
        <Link
          href="/journal"
          aria-label="Back"
          className="text-foreground hover:bg-warm-100 -ml-2 rounded-full p-2 transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <Logo size="sm" />
      </header>

      <h1 className="text-foreground mt-4 text-2xl font-bold tracking-tight">
        Chat with your past self
      </h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Pick a year and ask what you were thinking, grounded only in what you
        actually wrote.
      </p>

      {availableYears.length === 0 ? (
        <Card className="mt-6 p-5 text-center">
          <p className="text-muted-foreground text-sm">
            You don&apos;t have any journal entries yet. Record or write a few,
            then come back to chat with your past self.
          </p>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          <div className="space-y-2.5" role="radiogroup">
            {availableYears.map((year) => (
              <OptionCard
                key={year}
                title={String(year)}
                selected={!customRange && selectedYear === year}
                onSelect={() => {
                  setCustomRange(false);
                  setSelectedYear(year);
                }}
              />
            ))}
            <OptionCard
              title="Custom range"
              description={
                customRange ? undefined : "Pick your own start and end year"
              }
              selected={customRange}
              onSelect={() => setCustomRange(true)}
            />
          </div>

          {customRange && (
            <div className="border-border bg-card flex items-center gap-3 rounded-lg border p-4">
              <Input
                type="number"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="text-center"
                aria-label="Start year"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="number"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="text-center"
                aria-label="End year"
              />
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleStart}
            disabled={starting || (!customRange && !selectedYear)}
          >
            {starting ? "Starting…" : "Start chat"}
          </Button>
        </div>
      )}

      {sessions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Past conversations
          </h2>
          <div className="mt-3 space-y-2">
            {sessions.map((s) => (
              <Link key={s.id} href={`/chat/${s.id}`}>
                <Card className="hover:shadow-elevated flex items-center gap-3 p-4 transition-shadow">
                  <History className="text-primary size-5 shrink-0" />
                  <span className="text-foreground font-serif text-lg font-semibold">
                    {s.title}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
