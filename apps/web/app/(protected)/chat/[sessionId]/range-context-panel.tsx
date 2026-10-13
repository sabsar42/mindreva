"use client";

import * as React from "react";

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

export function RangeContextPanel({
  entryCount,
  suggestedMin,
  entriesPerMonth,
  monthRange,
  year,
}: {
  entryCount: number;
  suggestedMin: number;
  entriesPerMonth: Record<number, number>;
  /** First and last month (1-12) to chart: a half-year session shows six. */
  monthRange: [number, number];
  year: number | null;
}) {
  const [firstMonth, lastMonth] = monthRange;
  const months = Array.from(
    { length: lastMonth - firstMonth + 1 },
    (_, i) => firstMonth + i,
  );
  const counts = months.map((m) => entriesPerMonth[m] ?? 0);
  const maxCount = Math.max(...counts, 1);

  return (
    <section className="border-border bg-card mt-4 rounded-xl border p-4">
      <p className="text-muted-foreground mb-3 text-xs">Entries per month</p>

      <div className="flex items-end justify-between gap-1" aria-hidden>
        {counts.map((count, i) => {
          // Bar height: min 4px when 0 entries, max 48px at the peak month
          const heightPx =
            count === 0 ? 4 : Math.max(8, Math.round((count / maxCount) * 48));
          // Opacity: lighter for fewer entries, full opacity at peak
          const opacity = count === 0 ? 0.15 : 0.3 + 0.7 * (count / maxCount);
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className="bg-primary w-full rounded-sm"
                style={{ height: `${heightPx}px`, opacity }}
              />
              <span className="text-muted-foreground text-[10px] leading-none">
                {MONTH_INITIALS[months[i]! - 1]}
              </span>
            </div>
          );
        })}
      </div>

      <p className="sr-only">
        {months
          .map((m, i) => `${MONTH_INITIALS[m - 1]}: ${counts[i]}`)
          .join(", ")}
      </p>

      <p className="text-foreground mt-3 text-sm font-semibold">
        Grounded in {entryCount} {entryCount === 1 ? "entry" : "entries"}
      </p>

      {entryCount < suggestedMin && entryCount > 0 && (
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          A few more entries will give this more to draw on. You can still ask
          anything.
        </p>
      )}
      {entryCount === 0 && (
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          Nothing written from {year ?? "this period"} yet. You can still ask;
          I&apos;ll say honestly when I don&apos;t have it.
        </p>
      )}
    </section>
  );
}
