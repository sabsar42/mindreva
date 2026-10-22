"use client";

import * as React from "react";
import { Droplets } from "lucide-react";
import { PrefetchLink } from "../_components/prefetch-link";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
  Button,
  IconTile,
  cn,
} from "@mindreva/ui";
import { RiverGraph, type RiverSelection } from "./river-graph";
import type {
  RiverData,
  RiverMilestone,
  RiverTheme,
} from "@/lib/services/mindmap.service";

export type RiverRange = "3m" | "6m" | "1y" | "all";

const RANGE_OPTIONS: { value: RiverRange; label: string }[] = [
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "1y", label: "1 year" },
  { value: "all", label: "All time" },
];

/** "2026-06" minus n months -> "2026-01" (n=5). Pure string/calendar math. */
function monthsBefore(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const total = y * 12 + (m - 1) - n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * Slices the already-fetched river down to the months a range covers.
 * Client-side, so switching ranges is instant. Anchored on the most recent
 * month the user actually wrote in, NOT the device's current date — writing
 * stopped a while ago (or simply isn't from "real time", e.g. a future-dated
 * fixture) must not silently empty out "last 3/6 months", which would make
 * the preview and every range look broken for no reason evidence-wise.
 */
function monthsForRange(allMonths: string[], range: RiverRange): string[] {
  if (range === "all" || allMonths.length === 0) return allMonths;
  const mostRecent = allMonths[allMonths.length - 1]!;
  const spanMonths = range === "3m" ? 3 : range === "6m" ? 6 : 12;
  const cutoff = monthsBefore(mostRecent, spanMonths - 1);
  return allMonths.filter((m) => m >= cutoff);
}

function formatMonthLong(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatDate(date: string | null): string {
  if (!date) return "Undated";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RiverInsightBanner({ data }: { data: RiverData }) {
  const insight = data.insight;
  if (!insight) return null;
  return (
    <div className="border-border bg-secondary/60 mt-3 rounded-2xl border px-4 py-3">
      <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-widest">
        A theme that returned
      </p>
      <p className="text-foreground mt-1 text-sm leading-relaxed">
        You wrote about{" "}
        <span className="font-semibold">{insight.label.toLowerCase()}</span>{" "}
        again in {formatMonthLong(insight.returnedMonth)}, after your last
        recorded mention in {formatMonthLong(insight.previousMonth)}.
      </p>
      <PrefetchLink
        href={`/entries/${insight.entryId}`}
        className="text-primary mt-1.5 inline-block text-xs font-semibold underline underline-offset-2"
      >
        View that entry
      </PrefetchLink>
    </div>
  );
}

/**
 * The river itself, plus its detail panel (theme / milestone / intersection)
 * and an optional range selector. Shared by the compact preview on Re-live Me
 * and the full expanded view, so both behave identically — only `compact` and
 * `showControls` differ.
 */
export function RiverExplorer({
  data,
  compact = false,
  showControls = false,
}: {
  data: RiverData;
  compact?: boolean;
  showControls?: boolean;
}) {
  const [range, setRange] = React.useState<RiverRange>(compact ? "6m" : "1y");
  const [selection, setSelection] = React.useState<RiverSelection | null>(null);

  const months = React.useMemo(
    () => monthsForRange(data.monthsCovered, range),
    [data.monthsCovered, range],
  );

  const themeById = React.useMemo(
    () => new Map(data.themes.map((t) => [t.id, t])),
    [data.themes],
  );

  if (data.themes.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center text-center",
          compact ? "px-4 py-6" : "px-6 py-10",
        )}
      >
        <IconTile size={compact ? "md" : "lg"}>
          <Droplets />
        </IconTile>
        <p className="text-foreground mt-4 text-base font-semibold">
          Your river hasn&apos;t started flowing yet
        </p>
        <p className="text-muted-foreground mt-1.5 max-w-xs text-sm leading-relaxed">
          Recurring themes appear here once you&apos;ve written a few entries
          and they&apos;ve been summarized. There isn&apos;t enough history yet
          to show a pattern.
        </p>
      </div>
    );
  }

  const selectedTheme =
    selection?.themeId !== undefined
      ? themeById.get(selection.themeId)
      : undefined;
  const selectedMilestone =
    selection?.kind === "milestone" && selectedTheme
      ? selectedTheme.milestones.find((m) => m.entryId === selection.entryId)
      : undefined;

  return (
    <div>
      {showControls && (
        <div
          role="radiogroup"
          aria-label="Time range"
          className="flex gap-1.5 px-4 pt-3"
        >
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={range === opt.value}
              onClick={() => setRange(opt.value)}
              className={cn(
                "press rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                range === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div className={cn(showControls ? "mt-3" : "", "px-2 py-2")}>
        <RiverGraph
          data={data}
          months={months}
          compact={compact}
          onSelect={setSelection}
        />
      </div>

      {!compact && <RiverInsightBanner data={data} />}

      <BottomSheet
        open={selection !== null}
        onOpenChange={(open) => {
          if (!open) setSelection(null);
        }}
      >
        <BottomSheetContent>
          {selection?.kind === "intersection" && selection.intersection ? (
            <IntersectionDetail intersection={selection.intersection} />
          ) : selectedMilestone && selectedTheme ? (
            <MilestoneDetail
              theme={selectedTheme}
              milestone={selectedMilestone}
            />
          ) : selectedTheme ? (
            <ThemeDetail theme={selectedTheme} />
          ) : (
            <>
              <BottomSheetTitle>Theme</BottomSheetTitle>
              <BottomSheetDescription className="sr-only">
                Details about this theme.
              </BottomSheetDescription>
            </>
          )}
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}

function ThemeDetail({ theme }: { theme: RiverTheme }) {
  const first = theme.months[0];
  const last = theme.months[theme.months.length - 1];
  return (
    <>
      <BottomSheetTitle>{theme.label}</BottomSheetTitle>
      <BottomSheetDescription className="sr-only">
        First appearance, most recent appearance, and related entries for this
        theme.
      </BottomSheetDescription>
      <div className="mt-2 flex gap-4 text-xs">
        {first && (
          <div>
            <p className="text-muted-foreground">First appeared</p>
            <p className="text-foreground font-semibold">
              {formatMonthLong(first.month)}
            </p>
          </div>
        )}
        {last && (
          <div>
            <p className="text-muted-foreground">Most recent</p>
            <p className="text-foreground font-semibold">
              {formatMonthLong(last.month)}
            </p>
          </div>
        )}
      </div>
      <div className="mt-4 max-h-[50dvh] space-y-2 overflow-y-auto pb-2">
        {theme.milestones.map((m) => (
          <PrefetchLink
            key={m.entryId}
            href={`/entries/${m.entryId}`}
            className="border-border bg-card shadow-subtle press hover:bg-secondary block rounded-2xl border p-4"
          >
            <p className="text-muted-foreground text-xs">
              {formatDate(m.entryDate)}
              {m.isFirstAppearance && " · first appearance"}
              {m.isReturnAfterGap && " · returned after a gap"}
            </p>
            <p className="text-foreground mt-0.5 text-sm font-semibold">
              {m.title ?? "Untitled"}
            </p>
            {m.snippet && (
              <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-relaxed">
                {m.snippet}
              </p>
            )}
          </PrefetchLink>
        ))}
      </div>
    </>
  );
}

function MilestoneDetail({
  theme,
  milestone,
}: {
  theme: RiverTheme;
  milestone: RiverMilestone;
}) {
  return (
    <>
      <BottomSheetTitle>{theme.label}</BottomSheetTitle>
      <BottomSheetDescription>
        {formatDate(milestone.entryDate)}
        {milestone.isReturnAfterGap &&
          milestone.previousMonth &&
          ` — your last mention before this was ${formatMonthLong(milestone.previousMonth)}`}
      </BottomSheetDescription>
      <div className="border-border bg-card mt-3 rounded-2xl border p-4">
        <p className="text-foreground text-sm font-semibold">
          {milestone.title ?? "Untitled"}
        </p>
        {milestone.snippet && (
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            &ldquo;{milestone.snippet}&rdquo;
          </p>
        )}
      </div>
      <Button asChild className="mt-4 w-full">
        <PrefetchLink href={`/entries/${milestone.entryId}`}>
          Open the complete entry
        </PrefetchLink>
      </Button>
    </>
  );
}

function IntersectionDetail({
  intersection,
}: {
  intersection: {
    month: string;
    themeA: string;
    themeB: string;
    sharedEntryIds: string[];
  };
}) {
  return (
    <>
      <BottomSheetTitle>
        {intersection.themeA} &amp; {intersection.themeB}
      </BottomSheetTitle>
      <BottomSheetDescription>
        Connected because{" "}
        {intersection.sharedEntryIds.length === 1 ? "an entry" : "entries"} from{" "}
        {formatMonthLong(intersection.month)} mentioned both — a connection the
        data supports, not an interpretation of why.
      </BottomSheetDescription>
      <div className="mt-3 space-y-2">
        {intersection.sharedEntryIds.map((entryId) => (
          <PrefetchLink
            key={entryId}
            href={`/entries/${entryId}`}
            className="border-border bg-card shadow-subtle press hover:bg-secondary block rounded-2xl border p-4 text-sm font-semibold"
          >
            Open this entry
          </PrefetchLink>
        ))}
      </div>
    </>
  );
}
