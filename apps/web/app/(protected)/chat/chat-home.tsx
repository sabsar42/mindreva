"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History } from "lucide-react";
import { Button, Input, cn, toast } from "@mindreva/ui";
import { PrefetchLink } from "../_components/prefetch-link";
import { SwipeNav } from "../_components/swipe-nav";

interface SessionSummary {
  id: string;
  title: string | null;
  createdAt: string;
}

function relativeDate(iso: string): string {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return then.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export function ChatHome({
  sessions,
  availableYears,
  entryCountsByYear,
}: {
  sessions: SessionSummary[];
  availableYears: number[];
  entryCountsByYear: Record<number, number>;
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
      const data = (await res.json()) as { session: { id: string } };
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

  const selectedCount = selectedYear
    ? (entryCountsByYear[selectedYear] ?? 0)
    : 0;

  return (
    <SwipeNav>
      <main className="mx-auto min-h-screen px-5 pb-24 pt-6 md:max-w-2xl md:pb-10">
        <h1 className="text-foreground font-serif text-3xl font-bold leading-tight tracking-tight">
          Chat with your past self
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Pick a period and ask what you were thinking. Every answer is grounded
          only in what you actually wrote.
        </p>

        {availableYears.length === 0 ? (
          <div className="border-border bg-card mt-8 rounded-xl border p-6 text-center">
            <History className="text-muted-foreground mx-auto size-6" />
            <p className="text-foreground mt-3 text-sm font-medium">
              Nothing to look back on yet
            </p>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
              Record or write a few entries, and they&apos;ll show up here as
              periods you can talk to.
            </p>
            <Button asChild variant="secondary" className="mt-4">
              <Link href="/record">Record your first entry</Link>
            </Button>
          </div>
        ) : (
          <>
            <section className="mt-7">
              <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                Choose a period
              </h2>

              {/* A compact grid rather than stacked full-width cards: with several
                years the old list ran past the fold before reaching the button,
                and the entry count per year is the thing that actually informs
                the choice. */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {availableYears.map((year) => {
                  const count = entryCountsByYear[year] ?? 0;
                  const isSelected = !customRange && selectedYear === year;
                  return (
                    <button
                      key={year}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setCustomRange(false);
                        setSelectedYear(year);
                      }}
                      className={cn(
                        "focus-visible:ring-ring flex flex-col items-center gap-0.5 rounded-xl border px-2 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:bg-accent",
                      )}
                    >
                      <span className="font-serif text-xl font-bold leading-none">
                        {year}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] leading-none",
                          isSelected
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground",
                        )}
                      >
                        {count} {count === 1 ? "entry" : "entries"}
                      </span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  aria-pressed={customRange}
                  onClick={() => setCustomRange(true)}
                  className={cn(
                    "focus-visible:ring-ring flex flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2",
                    customRange
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-accent",
                  )}
                >
                  <span className="text-sm font-medium leading-tight">
                    Custom
                  </span>
                  <span className="text-[11px] leading-none">range</span>
                </button>
              </div>

              {customRange && (
                <div className="border-border bg-card mt-2 flex items-center gap-3 rounded-lg border p-4">
                  <Input
                    type="number"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    className="text-center"
                    aria-label="Start year"
                  />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input
                    type="number"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    className="text-center"
                    aria-label="End year"
                  />
                </div>
              )}

              {!customRange && selectedYear !== null && selectedCount < 5 && (
                <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                  {selectedCount === 0
                    ? `There's nothing written from ${selectedYear} yet. You can still ask, but there won't be much to draw on.`
                    : `Only ${selectedCount} ${selectedCount === 1 ? "entry" : "entries"} from ${selectedYear}, so there may not be much to go on.`}
                </p>
              )}

              <Button
                className="mt-4 w-full"
                size="lg"
                onClick={handleStart}
                disabled={starting || (!customRange && !selectedYear)}
              >
                {starting ? "Starting…" : "Start chat"}
              </Button>
            </section>

            {sessions.length > 0 && (
              <section className="mt-9">
                <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  Past conversations
                </h2>
                <div className="mt-3 space-y-2">
                  {sessions.map((s) => (
                    <PrefetchLink
                      key={s.id}
                      href={`/chat/${s.id}`}
                      className="border-border bg-card hover:bg-accent flex items-center gap-3 rounded-xl border p-3.5 transition-colors"
                    >
                      <span className="bg-secondary flex size-9 shrink-0 items-center justify-center rounded-full">
                        <History className="text-primary size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-foreground block font-serif text-lg font-semibold leading-tight">
                          {s.title ?? "Chat"}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {relativeDate(s.createdAt)}
                        </span>
                      </span>
                    </PrefetchLink>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </SwipeNav>
  );
}
