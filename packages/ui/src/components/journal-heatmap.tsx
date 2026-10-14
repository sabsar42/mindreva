"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { cn } from "../lib/utils";

export interface HeatmapDay {
  /** "YYYY-MM-DD" */
  date: string;
  count: number;
  /** 0 = no entries, 1-4 = increasing activity. */
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapEntrySummary {
  id: string;
  title: string | null;
  snippet: string | null;
  /** Pre-formatted, e.g. "9:14 AM" — the app's own time formatting, not
   * reformatted here, so this component stays free of locale/timezone logic. */
  timeLabel: string | null;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Level -> mint shade. 0 is a neutral, barely-there cell (never blank), 1-4 climb the scale — matching the app's own "dark mint is for emphasis" rule. */
const LEVEL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-secondary",
  1: "bg-mint-200",
  2: "bg-mint-400",
  3: "bg-mint-600",
  4: "bg-mint-800",
};

/** Day-number colour per level. Keyed to the cell's own shade, not the theme:
 * the mint scale is the same hex in light and dark, so `text-foreground`
 * (near-white in dark mode) vanished on the light level 1-2 cells. Only
 * level 0 follows the theme, because `bg-secondary` does too. */
const LEVEL_TEXT_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "text-foreground/70",
  1: "text-mint-900",
  2: "text-mint-900",
  3: "text-mint-50",
  4: "text-mint-50",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function monthKey(year: number, monthIndex0: number): string {
  return `${year}-${pad2(monthIndex0 + 1)}`;
}

function dateKey(year: number, monthIndex0: number, day: number): string {
  return `${year}-${pad2(monthIndex0 + 1)}-${pad2(day)}`;
}

/** Monday-first weekday index (0 = Monday ... 6 = Sunday), matching the rest of the app's calendar. */
function mondayFirstDow(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function formatDayLong(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function levelFor(
  days: Record<string, HeatmapDay>,
  key: string,
): 0 | 1 | 2 | 3 | 4 {
  return days[key]?.level ?? 0;
}
function countFor(days: Record<string, HeatmapDay>, key: string): number {
  return days[key]?.count ?? 0;
}

function Legend() {
  return (
    <div className="text-muted-foreground mt-3 flex items-center justify-end gap-1.5 text-xs">
      <span>Less</span>
      {([0, 1, 2, 3, 4] as const).map((level) => (
        <span
          key={level}
          aria-hidden
          className={cn("size-2.5 rounded-[3px]", LEVEL_CLASSES[level])}
        />
      ))}
      <span>More</span>
    </div>
  );
}

function DayDetailPanel({
  selectedDate,
  entries,
  loading,
  onOpenEntry,
}: {
  selectedDate: string | null;
  entries: HeatmapEntrySummary[] | null;
  loading: boolean;
  onOpenEntry: (id: string) => void;
}) {
  if (!selectedDate) return null;
  return (
    <div className="border-border mt-4 border-t pt-4">
      <p className="text-foreground text-sm font-semibold">
        {formatDayLong(selectedDate)}
      </p>
      {loading ? (
        <p className="text-muted-foreground mt-2 text-sm">Loading…</p>
      ) : !entries || entries.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-sm">
          No entries for this day.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {entries.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onOpenEntry(e.id)}
                className="border-border bg-card hover:bg-secondary press w-full rounded-2xl border p-3 text-left transition-colors"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-foreground truncate text-sm font-semibold">
                    {e.title || "Untitled entry"}
                  </span>
                  {e.timeLabel && (
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {e.timeLabel}
                    </span>
                  )}
                </span>
                {e.snippet && (
                  <span className="text-muted-foreground mt-0.5 block truncate text-xs leading-relaxed">
                    {e.snippet}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The compact single-month grid. */
function MonthGrid({
  year,
  monthIndex0,
  days,
  selectedDate,
  onSelectDay,
}: {
  year: number;
  monthIndex0: number;
  days: Record<string, HeatmapDay>;
  selectedDate: string | null;
  onSelectDay: (key: string) => void;
}) {
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const firstDow = mondayFirstDow(new Date(year, monthIndex0, 1));

  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to a whole number of weeks so the grid doesn't ragged-edge.
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="text-muted-foreground text-center text-[10px] font-semibold uppercase"
          >
            {w[0]}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const key = dateKey(year, monthIndex0, day);
          const level = levelFor(days, key);
          const count = countFor(days, key);
          const isSelected = key === selectedDate;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
              aria-label={`${formatDayLong(key)}: ${count} ${count === 1 ? "entry" : "entries"}`}
              aria-pressed={isSelected}
              className={cn(
                "press focus-visible:ring-ring aspect-square rounded-[6px] text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2",
                LEVEL_CLASSES[level],
                LEVEL_TEXT_CLASSES[level],
                isSelected &&
                  "ring-primary ring-offset-background ring-2 ring-offset-1",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The expanded full-year grid: 12 months side by side, GitHub-contribution
 * style, weeks running horizontally and weekdays running vertically. Scrolls
 * horizontally on narrow screens rather than shrinking cells unreadably. */
function YearGrid({
  year,
  days,
  selectedDate,
  onSelectDay,
}: {
  year: number;
  days: Record<string, HeatmapDay>;
  selectedDate: string | null;
  onSelectDay: (key: string) => void;
}) {
  // One continuous week-column grid spanning Jan 1 - Dec 31, with month label
  // breaks positioned above the column where that month's first week starts.
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const firstDow = mondayFirstDow(jan1);
  const totalDays =
    Math.round((dec31.getTime() - jan1.getTime()) / 86_400_000) + 1;
  const totalCells = firstDow + totalDays;
  const weekCount = Math.ceil(totalCells / 7);

  // weeks[w][dow] = date key or null
  const weeks: (string | null)[][] = Array.from({ length: weekCount }, () =>
    Array<string | null>(7).fill(null),
  );
  for (let d = 0; d < totalDays; d++) {
    const cellIndex = firstDow + d;
    const w = Math.floor(cellIndex / 7);
    const dow = cellIndex % 7;
    const date = new Date(year, 0, 1 + d);
    weeks[w]![dow] = dateKey(year, date.getMonth(), date.getDate());
  }

  // Which week-column each month's label should sit above: the column
  // containing that month's 1st.
  const monthStartWeek = new Map<number, number>();
  for (let m = 0; m < 12; m++) {
    const first = new Date(year, m, 1);
    const d = Math.round((first.getTime() - jan1.getTime()) / 86_400_000);
    const cellIndex = firstDow + d;
    monthStartWeek.set(m, Math.floor(cellIndex / 7));
  }

  const cellSize = 11;
  const gap = 3;
  const colWidth = cellSize + gap;

  const scrollRef = React.useRef<HTMLDivElement>(null);
  // The grid runs the whole year left to right (52+ columns), so without
  // this a freshly-opened year view shows January — scroll to whichever
  // month is most relevant: today's month for the current year, December's
  // column for a past year, so there's always something to see without
  // the viewer having to discover they can scroll sideways first.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const now = new Date();
    const targetMonth = year === now.getFullYear() ? now.getMonth() : 11;
    const targetWeek = monthStartWeek.get(targetMonth) ?? 0;
    el.scrollLeft = Math.max(0, targetWeek * colWidth - 40);
  }, [year, colWidth, monthStartWeek]);

  return (
    <div ref={scrollRef} className="overflow-x-auto pb-1">
      <div
        className="relative"
        style={{ width: weekCount * colWidth + 24, paddingLeft: 24 }}
      >
        {/* Month labels */}
        <div className="relative h-4">
          {[...monthStartWeek.entries()].map(([m, w]) => (
            <span
              key={m}
              className="text-muted-foreground absolute text-[10px] font-medium"
              style={{ left: 24 + w * colWidth }}
            >
              {MONTH_NAMES[m]!.slice(0, 3)}
            </span>
          ))}
        </div>

        <div className="flex">
          {/* Weekday labels, every other row to stay uncluttered. */}
          <div className="mr-1 flex flex-col gap-[3px]" style={{ width: 20 }}>
            {WEEKDAY_LABELS.map((w, i) => (
              <span
                key={w}
                className="text-muted-foreground flex items-center text-[9px]"
                style={{ height: cellSize }}
              >
                {i % 2 === 1 ? w[0] : ""}
              </span>
            ))}
          </div>

          <div className="flex gap-[3px]">
            {weeks.map((week, w) => (
              <div key={w} className="flex flex-col gap-[3px]">
                {week.map((key, dow) => {
                  if (!key) {
                    return (
                      <div
                        key={dow}
                        style={{ width: cellSize, height: cellSize }}
                      />
                    );
                  }
                  const level = levelFor(days, key);
                  const count = countFor(days, key);
                  const isSelected = key === selectedDate;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onSelectDay(key)}
                      aria-label={`${formatDayLong(key)}: ${count} ${count === 1 ? "entry" : "entries"}`}
                      aria-pressed={isSelected}
                      className={cn(
                        "press focus-visible:ring-ring rounded-[2px] transition-colors focus-visible:outline-none focus-visible:ring-2",
                        LEVEL_CLASSES[level],
                        isSelected && "ring-primary ring-2",
                      )}
                      style={{ width: cellSize, height: cellSize }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface JournalHeatmapProps {
  /** Entry counts for whichever period is currently displayed, keyed by "YYYY-MM-DD". */
  monthDays: Record<string, HeatmapDay>;
  /** Only fetched/populated once the year view is opened. */
  yearDays: Record<string, HeatmapDay> | null;
  yearStats: {
    totalDaysJournaled: number;
    totalEntries: number;
    currentStreak: number;
  } | null;
  loadingYear: boolean;
  month: Date;
  onMonthChange: (month: Date) => void;
  year: number;
  onYearChange: (year: number) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
  selectedDayEntries: HeatmapEntrySummary[] | null;
  loadingSelectedDay: boolean;
  onOpenEntry: (id: string) => void;
  className?: string;
}

/**
 * GitHub-style contribution heatmap, adapted for journaling: a compact
 * single-month grid that expands in place (no navigation, no modal) into the
 * full year. Selecting a day shows its details inline, directly beneath the
 * grid — never a popup or tooltip, per the brief.
 */
function JournalHeatmap({
  monthDays,
  yearDays,
  yearStats,
  loadingYear,
  month,
  onMonthChange,
  year,
  onYearChange,
  expanded,
  onExpandedChange,
  selectedDate,
  onSelectDay,
  selectedDayEntries,
  loadingSelectedDay,
  onOpenEntry,
  className,
}: JournalHeatmapProps) {
  const monthLabel = `${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`;

  return (
    <div className={cn("w-full", className)}>
      {!expanded ? (
        <>
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => {
                const next = new Date(month);
                next.setMonth(next.getMonth() - 1);
                onMonthChange(next);
              }}
              className="hover:bg-secondary press text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-full transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-foreground text-sm font-semibold">
              {monthLabel}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Next month"
                onClick={() => {
                  const next = new Date(month);
                  next.setMonth(next.getMonth() + 1);
                  onMonthChange(next);
                }}
                className="hover:bg-secondary press text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-full transition-colors"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Expand to full year"
                onClick={() => {
                  onYearChange(month.getFullYear());
                  onExpandedChange(true);
                }}
                className="hover:bg-secondary press text-muted-foreground hover:text-foreground ml-1 flex size-7 items-center justify-center rounded-full transition-colors"
              >
                <Maximize2 className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-2">
            <MonthGrid
              year={month.getFullYear()}
              monthIndex0={month.getMonth()}
              days={monthDays}
              selectedDate={selectedDate}
              onSelectDay={onSelectDay}
            />
          </div>
          <Legend />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous year"
              onClick={() => onYearChange(year - 1)}
              className="hover:bg-secondary press text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-full transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-foreground text-sm font-semibold">
              {year}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Next year"
                onClick={() => onYearChange(year + 1)}
                className="hover:bg-secondary press text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-full transition-colors"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Back to month view"
                onClick={() => onExpandedChange(false)}
                className="hover:bg-secondary press text-muted-foreground hover:text-foreground ml-1 flex size-7 items-center justify-center rounded-full transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {loadingYear ? (
            <div className="bg-secondary mt-3 h-28 w-full animate-pulse rounded-xl" />
          ) : (
            <div className="mt-3">
              <YearGrid
                year={year}
                days={yearDays ?? {}}
                selectedDate={selectedDate}
                onSelectDay={onSelectDay}
              />
            </div>
          )}
          <Legend />

          {yearStats && (
            <div className="border-border mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-center">
              <div>
                <p className="text-foreground text-sm font-bold">
                  {yearStats.totalDaysJournaled}
                </p>
                <p className="text-muted-foreground text-[10px]">
                  days written
                </p>
              </div>
              <div>
                <p className="text-foreground text-sm font-bold">
                  {yearStats.totalEntries}
                </p>
                <p className="text-muted-foreground text-[10px]">entries</p>
              </div>
              <div>
                <p className="text-foreground text-sm font-bold">
                  {yearStats.currentStreak}
                </p>
                <p className="text-muted-foreground text-[10px]">
                  day{yearStats.currentStreak === 1 ? "" : "s"} streak
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <DayDetailPanel
        selectedDate={selectedDate}
        entries={selectedDayEntries}
        loading={loadingSelectedDay}
        onOpenEntry={onOpenEntry}
      />
    </div>
  );
}

export { JournalHeatmap, monthKey };
