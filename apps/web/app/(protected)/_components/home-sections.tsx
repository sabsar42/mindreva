"use client";

import * as React from "react";
import { ChevronRight, Flame, Mic, PenLine } from "lucide-react";
import { cn } from "@mindreva/ui";
import { PrefetchLink } from "./prefetch-link";
import type { Lookback } from "@/lib/on-this-day";
import { yearsAgoLabel } from "@/lib/on-this-day";
import type { EntryListItemWithThumbnail } from "@/lib/services/entries.service";

const ROW =
  "flex min-h-[3.75rem] w-full items-center gap-3 px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/**
 * The two ways to add to the journal, as one grouped inset list: Record (the
 * primary action, the only tinted tile on the screen) and Write.
 */
export function QuickActions({
  streak,
  onRecord,
  onWrite,
  className,
}: {
  streak: number;
  onRecord: () => void;
  onWrite: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card border-border shadow-subtle grouped-list overflow-hidden rounded-2xl border [--row-inset:4rem]",
        className,
      )}
    >
      <button type="button" onClick={onRecord} className={ROW}>
        <span className="bg-gradient-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
          <Mic className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-headline text-foreground block">
            Record a voice note
          </span>
          <span className="text-footnote text-muted-foreground flex items-center gap-1 tabular-nums">
            {streak > 0 ? (
              <>
                <Flame
                  className="text-heat-3 fill-heat-3 size-3.5"
                  aria-hidden
                />
                {streak}-day streak
              </>
            ) : (
              "Start your streak today"
            )}
          </span>
        </span>
        <ChevronRight
          className="text-label-tertiary size-5 shrink-0"
          aria-hidden
        />
      </button>
      <button type="button" onClick={onWrite} className={ROW}>
        <span className="bg-secondary text-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
          <PenLine className="size-[1.125rem]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-headline text-foreground block">
            Write an entry
          </span>
          <span className="text-footnote text-muted-foreground block">
            Type it out instead
          </span>
        </span>
        <ChevronRight
          className="text-label-tertiary size-5 shrink-0"
          aria-hidden
        />
      </button>
    </div>
  );
}

function monthYear(dateKey: string): string {
  const [y, m] = dateKey.split("-").map(Number) as [number, number];
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/**
 * The look-back teaser: "On this day" when an earlier year has an entry on
 * today's date, otherwise one older memory for today. Links to the entry,
 * with a quiet way into Re-live Me. Absent for brand-new users.
 */
export function LookbackCard({
  lookback,
  todayKey,
  thumbnailFor,
  className,
}: {
  lookback: Lookback<EntryListItemWithThumbnail>;
  todayKey: string;
  thumbnailFor: (entry: EntryListItemWithThumbnail) => string | null;
  className?: string;
}) {
  if (!lookback) return null;
  const entry =
    lookback.kind === "on-this-day" ? lookback.entries[0]! : lookback.entry;
  const dateKey =
    lookback.kind === "on-this-day"
      ? (entry.entryDate ?? todayKey)
      : lookback.dateKey;
  const eyebrow =
    lookback.kind === "on-this-day"
      ? `On this day · ${yearsAgoLabel(dateKey, todayKey)}`
      : `A memory · ${monthYear(dateKey)}`;
  const more =
    lookback.kind === "on-this-day" && lookback.entries.length > 1
      ? `${lookback.entries.length - 1} more from this day`
      : null;
  const cover = thumbnailFor(entry);

  return (
    <section aria-label={eyebrow} className={className}>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-title-3 text-foreground font-bold">Look back</h2>
        <PrefetchLink
          href="/chat"
          className="text-subhead text-primary hit-44 font-medium"
        >
          Re-live
        </PrefetchLink>
      </div>
      <PrefetchLink
        href={`/entries/${entry.id}`}
        className="bg-card border-border shadow-subtle press focus-visible:ring-ring flex items-center gap-3 overflow-hidden rounded-2xl border p-4 focus-visible:outline-none focus-visible:ring-2"
      >
        <span className="min-w-0 flex-1">
          <span className="text-caption text-primary block font-semibold uppercase tracking-wide">
            {eyebrow}
          </span>
          <span className="text-headline text-foreground mt-1 line-clamp-2 block">
            {entry.title || "Untitled entry"}
          </span>
          {entry.snippet && (
            <span className="text-footnote text-muted-foreground mt-0.5 line-clamp-2 block">
              {entry.snippet}
            </span>
          )}
          {more && (
            <span className="text-caption text-muted-foreground mt-1.5 block">
              {more}
            </span>
          )}
        </span>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URLs, already resized thumbnails
          <img
            src={cover}
            alt=""
            width={72}
            height={72}
            className="bg-secondary size-18 shrink-0 rounded-xl object-cover"
          />
        )}
      </PrefetchLink>
    </section>
  );
}
