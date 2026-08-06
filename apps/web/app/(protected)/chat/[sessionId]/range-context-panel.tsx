"use client";

import * as React from "react";
import { cn } from "@mindreva/ui";

const MONTH_INITIALS = [
  "J",
  "F",
  "M",
  "A",
  "M",
  "J",
  "J",
  "A",
  "S",
  "O",
  "N",
  "D",
];

/**
 * Shown when a session's range has fewer than the suggested minimum entries.
 * Deliberately encouragement, not a gate — the composer below stays enabled at
 * any count (see docs/roadmap.md Phase 6: the empty state matters more here
 * than anywhere else in the app, and should read warmly, not as a blocker).
 */
export function RangeContextPanel({
  entryCount,
  suggestedMin,
  monthsWithEntries,
  isSingleYear,
  year,
}: {
  entryCount: number;
  suggestedMin: number;
  monthsWithEntries: number[];
  isSingleYear: boolean;
  year: number | null;
}) {
  const filled = new Set(monthsWithEntries);
  const progress = Math.min(entryCount / suggestedMin, 1);

  return (
    <section className="border-border bg-card mt-4 rounded-lg border p-4">
      {isSingleYear && year && (
        <div className="mb-4">
          <p className="text-muted-foreground mb-2 text-xs">
            Your {year} at a glance
          </p>
          <div className="flex items-end justify-between gap-1">
            {MONTH_INITIALS.map((initial, i) => {
              const month = i + 1;
              const hasEntry = filled.has(month);
              return (
                <div
                  key={month}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 rounded-full transition-colors",
                      hasEntry ? "bg-primary" : "bg-warm-200",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[10px] leading-none",
                      hasEntry
                        ? "text-foreground font-medium"
                        : "text-muted-foreground",
                    )}
                  >
                    {initial}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="sr-only">
            {monthsWithEntries.length} of 12 months in {year} have entries.
          </p>
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-foreground text-sm font-medium">
            {entryCount} of {suggestedMin} entries
          </span>
        </div>
        <div
          className="bg-warm-200 h-1.5 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={entryCount}
          aria-valuemin={0}
          aria-valuemax={suggestedMin}
          aria-label={`${entryCount} of ${suggestedMin} suggested entries for this period`}
        >
          <div
            className="bg-primary h-full rounded-full transition-[width]"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {entryCount === 0
            ? "There's nothing written from this period yet, so there won't be much to draw on. You can still ask — I'll tell you honestly when I don't have it."
            : "A few more and this will have more to work with. You can still ask anything below."}
        </p>
      </div>
    </section>
  );
}
