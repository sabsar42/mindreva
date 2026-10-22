"use client";

import { useHydrated } from "@/lib/use-hydrated";
import { DATE_PLACEHOLDER } from "@/lib/format-entry";

function greetingFor(hour: number): string {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The Home screen's header, iOS style: the date as a small eyebrow, a calm
 * time-of-day greeting as the Large Title, and Mori on the right where an
 * avatar would sit. Both depend on the viewer's clock and time zone, which
 * the server can't know, so they render after hydration in a same-size box
 * (the greeting is one line at every width, so nothing shifts).
 */
export function HomeHeader({ leading }: { leading?: React.ReactNode }) {
  const hydrated = useHydrated();
  const now = hydrated ? new Date() : null;

  const eyebrow = now
    ? now
        .toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        })
        .toUpperCase()
    : DATE_PLACEHOLDER;

  return (
    <header className="flex items-end gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-footnote text-muted-foreground truncate font-semibold tracking-wide">
          {eyebrow}
        </p>
        <h1 className="text-large-title text-foreground mt-0.5 min-h-[2.5625rem] text-balance">
          {now ? greetingFor(now.getHours()) : DATE_PLACEHOLDER}
        </h1>
      </div>
      {leading}
    </header>
  );
}
