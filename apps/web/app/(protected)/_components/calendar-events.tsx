"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@mindreva/ui";
import type { CalendarEvent } from "@/lib/integrations/google/calendar-api";

/**
 * Calendar events beside entries. Read-only and optional: every component
 * here renders nothing until events actually exist, so a disconnected or
 * failing calendar leaves no gap, no spinner and no layout shift elsewhere.
 * Requests for the same range are shared (one fetch per range per visit).
 */

const cache = new Map<string, Promise<CalendarEvent[]>>();

function fetchRange(start: string, end: string): Promise<CalendarEvent[]> {
  const key = `${start}|${end}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/api/calendar/events?start=${start}&end=${end}`)
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d: { events?: CalendarEvent[] }) => d.events ?? [])
      .catch(() => {
        cache.delete(key); // let a later mount retry
        return [];
      });
    cache.set(key, p);
  }
  return p;
}

export function useCalendarEvents(
  start: string | null,
  end: string | null = start,
  enabled = true,
): CalendarEvent[] | null {
  const [events, setEvents] = React.useState<CalendarEvent[] | null>(null);
  React.useEffect(() => {
    if (!enabled || !start || !end) return;
    let live = true;
    void fetchRange(start, end).then((e) => live && setEvents(e));
    return () => {
      live = false;
    };
  }, [start, end, enabled]);
  return events;
}

/** "All day" or "9:30 AM", in the viewer's own clock. */
export function eventTime(e: CalendarEvent): string {
  if (e.allDay) return "All day";
  return new Date(e.start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Home: today's events as one compact grouped list, max 4 rows. */
export function TodayEvents({
  todayKey,
  className,
}: {
  todayKey: string;
  className?: string;
}) {
  const events = useCalendarEvents(todayKey);
  if (!events || events.length === 0) return null;
  const shown = events.slice(0, 4);
  return (
    <section
      aria-label="Today's calendar"
      className={cn("motion-safe:animate-fade-in", className)}
    >
      <h2 className="text-title-3 text-foreground px-1 font-bold">Today</h2>
      <ul className="bg-card border-border shadow-subtle grouped-list mt-2 overflow-hidden rounded-2xl border [--row-inset:4.75rem]">
        {shown.map((e) => (
          <li
            key={`${e.calendarId}:${e.id}`}
            className="flex min-h-11 items-center gap-3 px-4 py-2.5"
          >
            <span className="text-footnote text-muted-foreground w-[3.75rem] shrink-0 tabular-nums">
              {eventTime(e)}
            </span>
            <span className="text-subhead text-foreground min-w-0 flex-1 truncate">
              {e.title}
            </span>
          </li>
        ))}
        {events.length > shown.length && (
          <li className="text-footnote text-muted-foreground px-4 py-2.5">
            {events.length - shown.length} more
          </li>
        )}
      </ul>
    </section>
  );
}

/** A quiet line of that day's events (entry page, memory cards). */
export function DayEventsInline({
  dateKey,
  className,
}: {
  dateKey: string;
  className?: string;
}) {
  const events = useCalendarEvents(dateKey);
  if (!events || events.length === 0) return null;
  const titles = events.slice(0, 2).map((e) => e.title);
  const more = events.length - titles.length;
  return (
    <p
      className={cn(
        "text-footnote text-muted-foreground motion-safe:animate-fade-in flex items-start gap-1.5",
        className,
      )}
    >
      <CalendarDays className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="sr-only">On your calendar that day: </span>
        {titles.join(" · ")}
        {more > 0 && ` · +${more}`}
      </span>
    </p>
  );
}
