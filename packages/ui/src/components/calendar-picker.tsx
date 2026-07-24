"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./button";

export interface CalendarPickerProps {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  /** Dates that have at least one entry — rendered with a dot underneath. */
  entryDates?: Date[];
  onClear?: () => void;
  onToday?: () => void;
  className?: string;
}

/**
 * Month grid with a dot under any date that has an entry, plus Clear / Today
 * actions. Matches the date-picker bottom-sheet in the reference. Fully themed
 * with design tokens (no react-day-picker default stylesheet imported).
 */
function CalendarPicker({
  selected,
  onSelect,
  entryDates,
  onClear,
  onToday,
  className,
}: CalendarPickerProps) {
  const [month, setMonth] = React.useState<Date>(selected ?? new Date());

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
        modifiers={{ hasEntry: entryDates ?? [] }}
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
          month_grid: "w-full border-collapse",
          weekdays: "flex",
          weekday:
            "w-9 flex-1 text-center text-xs font-medium uppercase text-muted-foreground",
          week: "mt-1 flex w-full",
          day: "flex-1 p-0 text-center",
          day_button:
            "relative mx-auto flex size-9 items-center justify-center rounded-md text-sm text-foreground transition-colors hover:bg-warm-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          today: "font-bold text-primary",
          selected:
            "[&>button]:border [&>button]:border-mint-500 [&>button]:font-semibold [&>button]:text-primary",
          outside: "[&>button]:text-warm-400",
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
