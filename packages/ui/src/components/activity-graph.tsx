"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTitle,
} from "./bottom-sheet";
import { buttonVariants } from "./button-variants";
import { Tabs, TabsList, TabsTrigger } from "./tabs";

export interface HeatmapDay {
  /** "YYYY-MM-DD" */
  date: string;
  /** Entries recorded that day (0 if the app was only opened). */
  count: number;
  visited: boolean;
  /** 0 = nothing, 1 = opened the app, 2-4 = also recorded (1, 2, 3+ entries). */
  level: 0 | 1 | 2 | 3 | 4;
}

/** What the week on screen looks like; drives Mori's mood. */
export interface WeekInfo {
  /** Monday of the week shown. */
  monday: Date;
  /** Days with any activity (opening the app counts). */
  days: number;
  /** Recordings across the week. */
  recordings: number;
  /** Whether this is the current week. */
  isCurrent: boolean;
}

export type DayLookup = (key: string) => HeatmapDay | undefined;

const MONTHS = [
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
const MONTHS_LONG = [
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
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** Muted amber, not the app's mint: this is a streak board, and mint is
 * reserved for things you tap to act. The --heat ramp deepens in light mode
 * and brightens in dark mode (see tokens.css). */
const LEVEL_BG: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-secondary",
  1: "bg-heat-1",
  2: "bg-heat-2",
  3: "bg-heat-3",
  4: "bg-heat-4",
};
/** Text that stays readable on each shade, in both themes (see tokens.css). */
const LEVEL_TEXT: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "text-muted-foreground",
  1: "text-heat-on-1",
  2: "text-heat-on-2",
  3: "text-heat-on-3",
  4: "text-heat-on-4",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function keyOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
/** Monday-first, matching the rest of the app's calendar. */
function mondayOf(d: Date): Date {
  return addDays(dayStart(d), -((d.getDay() + 6) % 7));
}
function fromKey(key: string): Date {
  return new Date(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10));
}
function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}

function describe(day: HeatmapDay | undefined, key: string): string {
  const d = fromKey(key);
  const label = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  if (!day || day.level === 0) return `${label} · No activity`;
  if (day.count > 0)
    return `${label} · ${day.count} ${day.count === 1 ? "recording" : "recordings"}`;
  return `${label} · Opened app`;
}

/** Two short lines for a tapped day, shown in the strip's label column. */
function dayLines(day: HeatmapDay | undefined, key: string): [string, string] {
  const d = fromKey(key);
  const top = `${WEEKDAYS[(d.getDay() + 6) % 7]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  if (!day || day.level === 0) return [top, "No activity"];
  if (day.count > 0)
    return [
      top,
      `${day.count} ${day.count === 1 ? "recording" : "recordings"}`,
    ];
  return [top, "Opened app"];
}

/* ------------------------------------------------------------------------ */
/* Week strip                                                                */
/* ------------------------------------------------------------------------ */

const HOLD_MS = 650;
const MOVE_SLOP = 8;
const STRIP_BOX =
  "border-card-edge bg-card/92 shadow-card h-20 rounded-[18px] border-[0.5px]";

const WeekPage = React.memo(function WeekPage({
  monday,
  today,
  getDay,
}: {
  monday: Date;
  today: Date;
  getDay: DayLookup;
}) {
  const todayKey = keyOf(today);
  return (
    <div className="grid shrink-0 basis-full snap-start snap-always grid-cols-7 gap-1 px-[3px] py-1.5">
      {LETTERS.map((letter, i) => {
        const date = addDays(monday, i);
        const key = keyOf(date);
        const day = getDay(key);
        const isToday = key === todayKey;
        return (
          <div key={key} className="flex min-w-0 flex-col items-center gap-1">
            <span
              className={cn(
                "text-[11.5px] leading-none",
                isToday
                  ? "text-primary font-bold"
                  : "text-muted-foreground font-medium",
              )}
            >
              {letter}
            </span>
            <button
              type="button"
              data-key={key}
              data-dense
              aria-label={describe(day, key)}
              className={cn(
                "aspect-square w-full max-w-[34px] rounded-full",
                LEVEL_BG[day?.level ?? 0],
                isToday && "outline-primary outline-2 outline-offset-1",
                date > today && "opacity-45",
              )}
            />
          </div>
        );
      })}
    </div>
  );
});

export interface ActivityStripProps {
  getDay: DayLookup;
  /** Ask for a year's data (called as weeks scroll across year boundaries). */
  ensureYear?: (year: number) => void;
  /** The week on screen changed, or its data did. */
  onWeekChange?: (week: WeekInfo) => void;
  /** Press and hold (or Enter): show the full graph. */
  onOpen: () => void;
  className?: string;
}

/**
 * One week of activity, the same size as the record bar beside it. Swipe (or
 * drag) to move back through weeks, the label on the left follows; tap a day
 * for its details; press and hold for the full month and year.
 */
function ActivityStrip({
  getDay,
  ensureYear,
  onWeekChange,
  onOpen,
  className,
}: ActivityStripProps) {
  const mounted = useMounted();
  if (!mounted) {
    return (
      <div
        aria-hidden
        className={cn(STRIP_BOX, "animate-pulse", className)}
        style={{ opacity: 0.6 }}
      />
    );
  }
  return (
    <StripInner
      getDay={getDay}
      ensureYear={ensureYear}
      onWeekChange={onWeekChange}
      onOpen={onOpen}
      className={className}
    />
  );
}

function StripInner({
  getDay,
  ensureYear,
  onWeekChange,
  onOpen,
  className,
}: ActivityStripProps) {
  const today = React.useMemo(() => dayStart(new Date()), []);
  const first = React.useMemo(
    () => mondayOf(new Date(today.getFullYear() - 1, 0, 1)),
    [today],
  );
  const last = React.useMemo(() => mondayOf(today), [today]);
  const weekCount = Math.round((+last - +first) / 6048e5) + 1;
  const mondayAt = React.useCallback(
    (i: number) => addDays(first, i * 7),
    [first],
  );

  const stripRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(weekCount - 1);
  const [override, setOverride] = React.useState<[string, string] | null>(null);
  const [holding, setHolding] = React.useState(false);
  const overrideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const press = React.useRef({
    timer: null as ReturnType<typeof setTimeout> | null,
    x: 0,
    y: 0,
    held: false,
    dragged: false,
    drag: null as { x: number; left: number; id: number } | null,
  });

  // Start on the current week (the last page).
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  // Keep the label, Mori and the data in step with the week on screen.
  React.useEffect(() => {
    const monday = mondayAt(index);
    ensureYear?.(monday.getFullYear());
    ensureYear?.(addDays(monday, 6).getFullYear());
  }, [index, mondayAt, ensureYear]);

  const lastReported = React.useRef("");
  React.useEffect(() => {
    if (!onWeekChange) return;
    const monday = mondayAt(index);
    let days = 0;
    let recordings = 0;
    for (let i = 0; i < 7; i++) {
      const day = getDay(keyOf(addDays(monday, i)));
      if (day && day.level > 0) days += 1;
      recordings += day?.count ?? 0;
    }
    const stamp = `${index}:${days}:${recordings}`;
    if (stamp === lastReported.current) return;
    lastReported.current = stamp;
    onWeekChange({
      monday,
      days,
      recordings,
      isCurrent: index === weekCount - 1,
    });
  }, [index, getDay, mondayAt, onWeekChange, weekCount]);

  const label = React.useMemo<[string, string]>(() => {
    if (override) return override;
    const monday = mondayAt(index);
    const sunday = addDays(monday, 6);
    const thursday = addDays(monday, 3);
    const top =
      MONTHS[thursday.getMonth()] +
      (thursday.getFullYear() !== today.getFullYear()
        ? ` ${thursday.getFullYear()}`
        : "");
    const range =
      monday.getMonth() === sunday.getMonth()
        ? `${monday.getDate()}–${sunday.getDate()}`
        : `${MONTHS[monday.getMonth()]} ${monday.getDate()} – ${MONTHS[sunday.getMonth()]} ${sunday.getDate()}`;
    return [top, range];
  }, [override, index, mondayAt, today]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.max(
      0,
      Math.min(weekCount - 1, Math.round(el.scrollLeft / el.clientWidth)),
    );
    if (i !== index) {
      setIndex(i);
      setOverride(null);
    }
  }

  function cancelHold() {
    const p = press.current;
    if (p.timer) clearTimeout(p.timer);
    p.timer = null;
    setHolding(false);
  }

  function endDrag() {
    cancelHold();
    const p = press.current;
    const el = scrollRef.current;
    if (p.drag && el) {
      try {
        stripRef.current?.releasePointerCapture(p.drag.id);
      } catch {
        /* not captured */
      }
      p.drag = null;
      el.style.scrollSnapType = "";
      const w = el.clientWidth;
      el.scrollTo({
        left: Math.round(el.scrollLeft / w) * w,
        behavior: "smooth",
      });
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button > 0) return;
    const p = press.current;
    p.x = e.clientX;
    p.y = e.clientY;
    p.held = false;
    p.dragged = false;
    setHolding(true);
    p.timer = setTimeout(() => {
      p.held = true;
      p.timer = null;
      setHolding(false);
      if (p.drag && scrollRef.current) {
        p.drag = null;
        scrollRef.current.style.scrollSnapType = "";
      }
      onOpen();
    }, HOLD_MS);
    // Touch scrolls natively; a mouse needs help.
    if (e.pointerType === "mouse" && scrollRef.current) {
      p.drag = {
        x: e.clientX,
        left: scrollRef.current.scrollLeft,
        id: e.pointerId,
      };
      scrollRef.current.style.scrollSnapType = "none";
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = press.current;
    if (
      Math.abs(e.clientX - p.x) > MOVE_SLOP ||
      Math.abs(e.clientY - p.y) > MOVE_SLOP
    ) {
      cancelHold();
    }
    if (Math.abs(e.clientX - p.x) > 6 && !p.dragged) {
      p.dragged = true;
      if (p.drag) {
        try {
          stripRef.current?.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    }
    if (p.drag && scrollRef.current) {
      scrollRef.current.scrollLeft = p.drag.left - (e.clientX - p.drag.x);
    }
  }

  function onClick(e: React.MouseEvent) {
    const p = press.current;
    if (p.held || p.dragged) {
      p.held = false;
      p.dragged = false;
      return;
    }
    const key = (e.target as HTMLElement).dataset?.key;
    if (!key) return;
    setOverride(dayLines(getDay(key), key));
    if (overrideTimer.current) clearTimeout(overrideTimer.current);
    overrideTimer.current = setTimeout(() => setOverride(null), 2500);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const el = scrollRef.current;
      el?.scrollBy({
        left: (e.key === "ArrowLeft" ? -1 : 1) * (el?.clientWidth ?? 0),
        behavior: "smooth",
      });
    }
  }

  React.useEffect(
    () => () => {
      if (overrideTimer.current) clearTimeout(overrideTimer.current);
      if (press.current.timer) clearTimeout(press.current.timer);
    },
    [],
  );

  return (
    <div
      ref={stripRef}
      tabIndex={0}
      role="group"
      aria-label="This week's activity. Swipe for earlier weeks. Press and hold, or press Enter, for the full graph."
      data-swipe-nav-ignore
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
      onContextMenu={(e) => e.preventDefault()}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        STRIP_BOX,
        "focus-visible:ring-ring flex touch-pan-x select-none items-center gap-2 py-0 pl-[18px] pr-3 transition-[transform,box-shadow,border-color] duration-[650ms] ease-linear [-webkit-touch-callout:none] focus-visible:outline-none focus-visible:ring-2",
        holding && "border-primary ring-primary/15 scale-[0.985] ring-4",
        className,
      )}
    >
      <div
        className="w-[86px] min-w-0 shrink-0 leading-tight"
        aria-live="polite"
      >
        <b className="text-foreground block truncate text-[15px] font-bold tracking-tight">
          {label[0]}
        </b>
        <span className="text-muted-foreground mt-px block truncate text-xs tabular-nums">
          {label[1]}
        </span>
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex min-w-0 flex-1 cursor-grab snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {Array.from({ length: weekCount }, (_, i) => (
          <WeekPage
            key={i}
            monday={mondayAt(i)}
            today={today}
            getDay={getDay}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Full graph (press and hold)                                               */
/* ------------------------------------------------------------------------ */

const CELL = 13;
const GAP = 3;
const COL = CELL + GAP;

interface YearLayout {
  /** weeks[w][dow] = date key, or null for padding before Jan 1 / after Dec 31. */
  weeks: (string | null)[][];
  monthStartWeek: number[];
}
const layoutCache = new Map<number, YearLayout>();
function yearLayout(year: number): YearLayout {
  const cached = layoutCache.get(year);
  if (cached) return cached;
  const jan1 = new Date(year, 0, 1);
  const firstDow = (jan1.getDay() + 6) % 7;
  const total = Math.round((+new Date(year, 11, 31) - +jan1) / 864e5) + 1;
  const weeks: (string | null)[][] = Array.from(
    { length: Math.ceil((firstDow + total) / 7) },
    () => Array<string | null>(7).fill(null),
  );
  for (let i = 0; i < total; i++) {
    const cell = firstDow + i;
    weeks[Math.floor(cell / 7)]![cell % 7] = keyOf(new Date(year, 0, 1 + i));
  }
  const monthStartWeek = Array.from({ length: 12 }, (_, m) => {
    const offset = Math.round((+new Date(year, m, 1) - +jan1) / 864e5);
    return Math.floor((firstDow + offset) / 7);
  });
  const layout = { weeks, monthStartWeek };
  layoutCache.set(year, layout);
  return layout;
}

function YearGrid({
  year,
  getDay,
  today,
  onStatus,
}: {
  year: number;
  getDay: DayLookup;
  today: Date;
  onStatus: (text: string | null, transient?: boolean) => void;
}) {
  const { weeks, monthStartWeek } = yearLayout(year);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // A 53-column year opens on January; bring the current month into view.
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let week = year > today.getFullYear() ? 0 : weeks.length - 1;
    if (year === today.getFullYear()) {
      const key = keyOf(today);
      week = weeks.findIndex((w) => w.includes(key));
    }
    el.scrollLeft = Math.max(0, week * COL - el.clientWidth * 0.65);
  }, [year, weeks, today]);

  const statusFor = (target: EventTarget | null) => {
    const key = (target as HTMLElement | null)?.dataset?.key;
    return key ? describe(getDay(key), key) : null;
  };

  return (
    <div
      ref={scrollRef}
      data-swipe-nav-ignore
      className="heatmap-year-scroll overflow-x-auto overflow-y-hidden pb-2"
      onMouseOver={(e) => {
        const s = statusFor(e.target);
        if (s) onStatus(s);
      }}
      onMouseLeave={() => onStatus(null)}
      onClick={(e) => onStatus(statusFor(e.target), true)}
    >
      <div className="relative" style={{ width: weeks.length * COL - GAP }}>
        <div className="relative mb-1 h-3.5">
          {monthStartWeek.map((w, m) => (
            <span
              key={m}
              className="text-muted-foreground absolute text-[11px] font-medium leading-none"
              style={{ left: w * COL }}
            >
              {MONTHS[m]}
            </span>
          ))}
        </div>
        <div className="flex" style={{ gap: GAP }}>
          {weeks.map((week, w) => (
            <div key={w} className="flex flex-col" style={{ gap: GAP }}>
              {week.map((key, dow) =>
                key ? (
                  <button
                    key={key}
                    type="button"
                    data-key={key}
                    data-dense
                    aria-label={describe(getDay(key), key)}
                    className={cn(
                      "rounded-full",
                      LEVEL_BG[getDay(key)?.level ?? 0],
                    )}
                    style={{ width: CELL, height: CELL }}
                  />
                ) : (
                  <span key={dow} style={{ width: CELL, height: CELL }} />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthGrid({
  month,
  getDay,
  today,
  onStatus,
}: {
  month: Date;
  getDay: DayLookup;
  today: Date;
  onStatus: (text: string | null, transient?: boolean) => void;
}) {
  const y = month.getFullYear();
  const m = month.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const todayKey = keyOf(today);
  return (
    <div
      onMouseLeave={() => onStatus(null)}
      onClick={(e) => {
        const key = (e.target as HTMLElement).dataset?.key;
        if (key) onStatus(describe(getDay(key), key), true);
      }}
    >
      <div className="mb-1 grid grid-cols-7 gap-1.5">
        {LETTERS.map((l, i) => (
          <span
            key={i}
            className="text-muted-foreground pb-1 text-center text-[11px] font-medium"
          >
            {l}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: lead }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = new Date(y, m, i + 1);
          const key = keyOf(date);
          const day = getDay(key);
          return (
            <button
              key={key}
              type="button"
              data-key={key}
              aria-label={describe(day, key)}
              onMouseOver={() => onStatus(describe(day, key))}
              className={cn(
                "mx-auto aspect-square w-full max-w-[38px] rounded-full text-[13px] font-semibold tabular-nums",
                LEVEL_BG[day?.level ?? 0],
                LEVEL_TEXT[day?.level ?? 0],
                key === todayKey &&
                  "outline-primary outline-2 outline-offset-1",
                date > today && "opacity-45",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface ActivitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getDay: DayLookup;
  ensureYear?: (year: number) => void;
}

const ARROW = buttonVariants({ variant: "quiet", size: "icon-sm" });

/** The full graph: a month calendar or the whole year, in the app's bottom
 * sheet. Opened by pressing and holding the week strip. */
function ActivitySheet({
  open,
  onOpenChange,
  getDay,
  ensureYear,
}: ActivitySheetProps) {
  const today = React.useMemo(() => dayStart(new Date()), []);
  const thisYear = today.getFullYear();
  const [view, setView] = React.useState<"month" | "year">("year");
  const [year, setYear] = React.useState(thisYear);
  const [month, setMonth] = React.useState(
    () => new Date(thisYear, today.getMonth(), 1),
  );
  const [status, setStatus] = React.useState<string | null>(null);
  const statusTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Open on the current year and month every time.
  React.useEffect(() => {
    if (open) {
      setYear(thisYear);
      setMonth(new Date(thisYear, today.getMonth(), 1));
    }
  }, [open, thisYear, today]);

  React.useEffect(() => {
    if (!open) return;
    ensureYear?.(view === "year" ? year : month.getFullYear());
  }, [open, view, year, month, ensureYear]);

  const onStatus = React.useCallback(
    (text: string | null, transient = false) => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
      setStatus(text);
      if (text && transient) {
        statusTimer.current = setTimeout(() => setStatus(null), 2500);
      }
    },
    [],
  );
  React.useEffect(() => setStatus(null), [view, year, month]);
  React.useEffect(
    () => () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    },
    [],
  );

  const maxYear = thisYear + 1;
  const minYear = thisYear - 5;
  const title =
    view === "year"
      ? String(year)
      : `${MONTHS_LONG[month.getMonth()]} ${month.getFullYear()}`;
  const atMin =
    view === "year"
      ? year <= minYear
      : month.getFullYear() <= minYear && month.getMonth() === 0;
  const atMax =
    view === "year"
      ? year >= maxYear
      : month.getFullYear() >= maxYear && month.getMonth() === 11;

  function step(delta: 1 | -1) {
    if (view === "year") setYear((y) => y + delta);
    else setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent aria-describedby={undefined}>
        <BottomSheetTitle className="sr-only">Activity</BottomSheetTitle>
        <div className="flex items-center justify-between">
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as "month" | "year")}
          >
            <TabsList className="h-10">
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="year">Year</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="mt-3 flex h-8 items-center justify-between gap-2">
          <button
            type="button"
            aria-label={view === "year" ? "Previous year" : "Previous month"}
            disabled={atMin}
            onClick={() => step(-1)}
            className={ARROW}
          >
            <ChevronLeft />
          </button>
          <span
            aria-live="polite"
            className={cn(
              "min-w-0 flex-1 truncate text-center tabular-nums tracking-tight",
              status
                ? "text-primary text-sm font-semibold"
                : "text-foreground text-lg font-bold",
            )}
          >
            {status ?? title}
          </span>
          <button
            type="button"
            aria-label={view === "year" ? "Next year" : "Next month"}
            disabled={atMax}
            onClick={() => step(1)}
            className={ARROW}
          >
            <ChevronRight />
          </button>
        </div>

        <div className="mt-3 min-h-[196px]">
          {view === "year" ? (
            <YearGrid
              year={year}
              getDay={getDay}
              today={today}
              onStatus={onStatus}
            />
          ) : (
            <MonthGrid
              month={month}
              getDay={getDay}
              today={today}
              onStatus={onStatus}
            />
          )}
        </div>

        <div className="text-muted-foreground mt-2 flex items-center justify-end gap-1.5 text-xs">
          <span>Less</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span
              key={level}
              aria-hidden
              className={cn("size-3 rounded-full", LEVEL_BG[level])}
            />
          ))}
          <span>More</span>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}

export { ActivityStrip, ActivitySheet };
