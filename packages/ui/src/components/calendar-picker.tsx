"use client";

import * as React from "react";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./button";

export interface CalendarPickerProps {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  /** Dates that have at least one entry — rendered with a dot underneath, or
   * as a thumbnail if dayThumbnails has a matching entry. */
  entryDates?: Date[];
  /** Signed cover-photo URL per "YYYY-MM-DD" — days with a photo render it as
   * their cell background, matching new-date-picker.png's grid. Days without
   * one stay a plain neutral cell (never a blank gray box). */
  dayThumbnails?: Record<string, string>;
  onClear?: () => void;
  onToday?: () => void;
  className?: string;
}

function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ThumbnailDayButton(
  dayThumbnails: Record<string, string>,
): (props: DayButtonProps) => React.ReactElement {
  return function DayButtonWithThumbnail({
    day,
    modifiers,
    className,
    children,
    ...buttonProps
  }: DayButtonProps) {
    const ref = React.useRef<HTMLButtonElement>(null);
    React.useEffect(() => {
      if (modifiers.focused) ref.current?.focus();
    }, [modifiers.focused]);

    const thumbnailUrl = dayThumbnails[toDateKey(day.date)];

    return (
      <button
        ref={ref}
        className={className}
        style={
          thumbnailUrl
            ? {
                backgroundImage: `linear-gradient(rgba(15, 42, 27, 0.15), rgba(15, 42, 27, 0.15)), url(${thumbnailUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
        {...buttonProps}
      >
        <span className={thumbnailUrl ? "drop-shadow-sm" : undefined}>
          {children}
        </span>
      </button>
    );
  };
}

/**
 * Month grid matching new-date-picker.png's density and thumbnail treatment:
 * a day with an entry shows that entry's first photo as its cell background;
 * days without an entry stay a plain neutral cell. Selection/today use our
 * own dark mint accent, not the reference's blue. Clear / Today actions and
 * the tap-a-date interaction are unchanged from before. Fully themed with
 * design tokens (no react-day-picker default stylesheet imported).
 */
function CalendarPicker({
  selected,
  onSelect,
  entryDates,
  dayThumbnails,
  onClear,
  onToday,
  className,
}: CalendarPickerProps) {
  const [month, setMonth] = React.useState<Date>(selected ?? new Date());
  const thumbnails = dayThumbnails ?? {};
  const DayButton = React.useMemo(
    () => ThumbnailDayButton(thumbnails),
    [thumbnails],
  );
  // A date with a photo shows the photo itself as the "has an entry" signal —
  // stacking the dot on top of it would be redundant clutter.
  const dotDates = React.useMemo(
    () => (entryDates ?? []).filter((d) => !thumbnails[toDateKey(d)]),
    [entryDates, thumbnails],
  );

  return (
    <div className={cn("w-full", className)}>
      <DayPicker
        mode="single"
        weekStartsOn={1}
        showOutsideDays
        month={month}
        onMonthChange={setMonth}
        selected={selected}
        onSelect={onSelect}
        modifiers={{ hasEntry: dotDates }}
        classNames={{
          months: "relative",
          month: "space-y-3",
          month_caption: "flex h-9 items-center justify-center",
          caption_label: "text-sm font-semibold text-foreground",
          nav: "absolute inset-x-0 top-0 flex items-center justify-between",
          button_previous:
            "inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-warm-100 hover:text-foreground",
          button_next:
            "inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-warm-100 hover:text-foreground",
          month_grid: "w-full border-collapse border-spacing-1",
          weekdays: "flex",
          weekday:
            "w-9 flex-1 text-center text-xs font-medium uppercase text-muted-foreground",
          week: "mt-1 flex w-full gap-1",
          day: "flex-1 p-0 text-center",
          day_button:
            "relative mx-auto flex size-9 items-center justify-center rounded-md bg-warm-100 text-sm text-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          today: "[&>button]:ring-2 [&>button]:ring-primary",
          selected:
            "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:font-semibold",
          outside: "[&>button]:text-warm-400 [&>button]:opacity-50",
          disabled: "[&>button]:opacity-40",
          hidden: "invisible",
        }}
        modifiersClassNames={{
          hasEntry:
            "[&>button]:after:absolute [&>button]:after:bottom-1 [&>button]:after:left-1/2 [&>button]:after:size-1 [&>button]:after:-translate-x-1/2 [&>button]:after:rounded-full [&>button]:after:bg-primary",
        }}
        components={{
          Chevron: ({ orientation, className: cls }) =>
            orientation === "left" ? (
              <ChevronLeft className={cn("size-4", cls)} />
            ) : (
              <ChevronRight className={cn("size-4", cls)} />
            ),
          DayButton,
        }}
      />

      {(onClear || onToday) && (
        <div className="border-border mt-2 flex items-center justify-between border-t pt-3">
          {onClear ? (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear
            </Button>
          ) : (
            <span />
          )}
          {onToday && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const today = new Date();
                setMonth(today);
                onToday();
              }}
              className="bg-accent text-accent-foreground hover:bg-mint-100"
            >
              Today
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export { CalendarPicker };
