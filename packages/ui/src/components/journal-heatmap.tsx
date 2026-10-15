"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

export interface HeatmapDay {
  /** "YYYY-MM-DD" */
  date: string;
  /** Entries recorded that day (0 if the app was only opened). */
  count: number;
  visited: boolean;
  /** 0 = nothing, 1 = opened the app, 2-4 = also recorded (1, 2, 3+ entries). */
  level: 0 | 1 | 2 | 3 | 4;
}

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Muted amber, not the app's mint: this is a streak board, and mint is
 * reserved for things you tap to act. The --heat ramp deepens in light mode
 * and brightens in dark mode (see tokens.css). */
const LEVEL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-secondary",
  1: "bg-heat-1",
  2: "bg-heat-2",
  3: "bg-heat-3",
  4: "bg-heat-4",
};

const CELL = 14;
const GAP = 4;
const COL = CELL + GAP;
const GRID_HEIGHT = 16 + 6 + 7 * COL - GAP;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Monday-first weekday index (0 = Monday ... 6 = Sunday), matching the rest of the app's calendar. */
function mondayFirstDow(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function describe(day: HeatmapDay | undefined, label: string): string {
  if (!day || day.level === 0) return `${label} · No activity`;
  if (day.count > 0)
    return `${label} · ${day.count} ${day.count === 1 ? "recording" : "recordings"}`;
  return `${label} · Opened app`;
}

interface YearLayout {
  /** weeks[w][dow] = date key, or null for padding before Jan 1 / after Dec 31. */
  weeks: (string | null)[][];
  monthStartWeek: number[];
  /** "Oct 5" per date key — built once per year, not per render. */
  labels: Map<string, string>;
}

const layoutCache = new Map<number, YearLayout>();

function yearLayout(year: number): YearLayout {
  const cached = layoutCache.get(year);
  if (cached) return cached;
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  const jan1 = new Date(year, 0, 1);
  const firstDow = mondayFirstDow(jan1);
  const totalDays =
    Math.round(
      (new Date(year, 11, 31).getTime() - jan1.getTime()) / 86_400_000,
    ) + 1;
  const weekCount = Math.ceil((firstDow + totalDays) / 7);
  const weeks: (string | null)[][] = Array.from({ length: weekCount }, () =>
    Array<string | null>(7).fill(null),
  );
  const labels = new Map<string, string>();
  for (let i = 0; i < totalDays; i++) {
    const cell = firstDow + i;
    const date = new Date(year, 0, 1 + i);
    const key = `${year}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    weeks[Math.floor(cell / 7)]![cell % 7] = key;
    labels.set(key, fmt.format(date));
  }
  const monthStartWeek: number[] = [];
  for (let m = 0; m < 12; m++) {
    const offset = Math.round(
      (new Date(year, m, 1).getTime() - jan1.getTime()) / 86_400_000,
    );
    monthStartWeek.push(Math.floor((firstDow + offset) / 7));
  }
  const layout = { weeks, monthStartWeek, labels };
  layoutCache.set(year, layout);
  return layout;
}

/** The grid itself, memoized so hover/status updates in the parent never
 * re-render 365 cells. One delegated listener reads the cell's data-key
 * instead of three handlers per cell. */
const YearGrid = React.memo(function YearGrid({
  year,
  days,
  onStatus,
}: {
  year: number;
  days: Record<string, HeatmapDay>;
  onStatus: (text: string | null) => void;
}) {
  const { weeks, monthStartWeek, labels } = yearLayout(year);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // A 53-column year opens on January by default; bring the current month
  // (or December, for another year) into view so there's something to see.
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const now = new Date();
    let week = weeks.length - 1;
    if (year === now.getFullYear()) {
      const key = `${year}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
      week = weeks.findIndex((w) => w.includes(key));
    } else if (year > now.getFullYear()) {
      week = 0;
    }
    el.scrollLeft = Math.max(0, week * COL - el.clientWidth * 0.65);
  }, [year, weeks]);

  function statusFor(target: EventTarget | null): string | null {
    const key = (target as HTMLElement | null)?.dataset?.key;
    return key ? describe(days[key], labels.get(key) ?? key) : null;
  }

  return (
    <div
      ref={scrollRef}
      data-swipe-nav-ignore
      className="heatmap-year-scroll mt-3 overflow-x-auto overflow-y-hidden pb-3"
      onMouseOver={(e) => {
        const s = statusFor(e.target);
        if (s) onStatus(s);
      }}
      onMouseLeave={() => onStatus(null)}
      onFocus={(e) => onStatus(statusFor(e.target))}
      onClick={(e) => onStatus(statusFor(e.target))}
    >
      <div
        className="relative"
        style={{ width: weeks.length * COL - GAP, height: GRID_HEIGHT }}
      >
        <div className="relative mb-1.5 h-4">
          {monthStartWeek.map((w, m) => (
            <span
              key={m}
              className="text-muted-foreground absolute text-xs font-medium"
              style={{ left: w * COL }}
            >
              {MONTH_SHORT[m]}
            </span>
          ))}
        </div>
        <div className="flex" style={{ gap: GAP }}>
          {weeks.map((week, w) => (
            <div key={w} className="flex flex-col" style={{ gap: GAP }}>
              {week.map((key, dow) => {
                if (!key)
                  return (
                    <span key={dow} style={{ width: CELL, height: CELL }} />
                  );
                const day = days[key];
                return (
                  <button
                    key={key}
                    type="button"
                    data-key={key}
                    aria-label={describe(day, labels.get(key)!)}
                    className={cn(
                      "focus-visible:ring-ring rounded-[4px] transition-[transform,background-color] duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2",
                      LEVEL_CLASSES[day?.level ?? 0],
                    )}
                    style={{ width: CELL, height: CELL }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export interface JournalHeatmapProps {
  /** Day data for the grid on screen, keyed by "YYYY-MM-DD"; null before any
   * data exists at all (renders a same-height placeholder). */
  days: Record<string, HeatmapDay> | null;
  /** The selected year's data hasn't arrived yet: the previous grid stays up,
   * dimmed, instead of a skeleton. */
  pending?: boolean;
  year: number;
  onYearChange: (year: number) => void;
  /** Furthest year the forward arrow may reach. */
  maxYear?: number;
  /** Consecutive active days ending today; shown when nothing is hovered. */
  currentStreak?: number;
  className?: string;
}

const EMPTY: Record<string, HeatmapDay> = {};

/**
 * GitHub-contribution-style activity card. Opening the app marks the day;
 * recording deepens it. Always visible, one year at a time, scrolled to the
 * current month.
 */
function JournalHeatmap({
  days,
  pending = false,
  year,
  onYearChange,
  maxYear,
  currentStreak = 0,
  className,
}: JournalHeatmapProps) {
  const [status, setStatus] = React.useState<string | null>(null);
  const onStatus = React.useCallback((s: string | null) => setStatus(s), []);
  // The grid follows the data actually on screen, which lags the year label
  // by one fetch when the selected year isn't cached yet.
  const [gridYear, setGridYear] = React.useState(year);
  if (!pending && gridYear !== year) setGridYear(year);
  React.useEffect(() => setStatus(null), [year]);

  const idleStatus = pending
    ? "Loading…"
    : currentStreak > 0
      ? `${currentStreak}-day streak`
      : "No activity yet";

  return (
    <section
      aria-label="Your activity"
      aria-busy={pending}
      className={cn(
        "border-border bg-card shadow-subtle rounded-2xl border px-5 pb-4 pt-5",
        className,
      )}
    >
      <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.12em]">
        Your activity
      </p>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous year"
          onClick={() => onYearChange(year - 1)}
          className="text-muted-foreground hover:bg-secondary hover:text-foreground press flex size-9 items-center justify-center rounded-full transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-foreground text-lg font-bold tabular-nums tracking-tight">
          {year}
        </span>
        <button
          type="button"
          aria-label="Next year"
          disabled={maxYear !== undefined && year >= maxYear}
          onClick={() => onYearChange(year + 1)}
          className="text-muted-foreground hover:bg-secondary hover:text-foreground press flex size-9 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {days === null ? (
        <div
          className="bg-secondary mb-3 mt-3 w-full animate-pulse rounded-xl"
          style={{ height: GRID_HEIGHT }}
        />
      ) : (
        <div
          className={cn(
            "transition-opacity duration-200",
            pending && "opacity-40",
          )}
        >
          <YearGrid year={gridYear} days={days ?? EMPTY} onStatus={onStatus} />
        </div>
      )}

      <div className="border-border mt-2 flex items-center justify-between gap-3 border-t pt-3">
        <span
          aria-live="polite"
          className="text-muted-foreground min-w-0 flex-1 truncate text-sm"
        >
          {status ?? idleStatus}
        </span>
        <div className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-sm">
          <span>Less</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span
              key={level}
              aria-hidden
              className={cn("size-3 rounded-[3px]", LEVEL_CLASSES[level])}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </section>
  );
}

export { JournalHeatmap };
