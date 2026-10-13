"use client";

import * as React from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { DATE_PLACEHOLDER } from "@/lib/format-entry";
import { TabHeaderActions } from "./tab-header-actions";
import { useAccount } from "./account-context";

function greetingFor(hour: number): string {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function GreetingName({ prefix }: { prefix: string }) {
  const account = useAccount();
  const first = account?.name.split(/\s+/)[0];
  return <>{first ? `${prefix}, ${first}` : prefix}</>;
}

/**
 * The Home screen's header: date eyebrow, weekday title, a time-of-day
 * greeting, and the avatar (account menu).
 *
 * The date and greeting depend on the viewer's clock and time zone, which the
 * server can't know, so they render only after hydration (with a same-height
 * placeholder) rather than risk a server/client mismatch.
 */
export function HomeHeader() {
  const hydrated = useHydrated();
  const now = hydrated ? new Date() : null;

  const eyebrow = now
    ? now
        .toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        .toUpperCase()
    : DATE_PLACEHOLDER;
  const weekday = now
    ? now.toLocaleDateString("en-US", { weekday: "long" })
    : DATE_PLACEHOLDER;

  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-primary text-xs font-bold uppercase tracking-widest">
          {eyebrow}
        </p>
        <h1 className="text-foreground mt-0.5 text-4xl font-bold leading-tight tracking-tight">
          {weekday}
        </h1>
        <p className="text-muted-foreground mt-1.5 min-h-5 text-sm">
          {now && (
            <React.Suspense fallback={greetingFor(now.getHours())}>
              <GreetingName prefix={greetingFor(now.getHours())} />
            </React.Suspense>
          )}
        </p>
      </div>

      <TabHeaderActions />
    </header>
  );
}
