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
 * The Home screen's header: an optional leading companion (Mori), the date
 * eyebrow and a time-of-day greeting, the tab icons and avatar, and the weekday
 * as the title underneath. The weekday sits below the row, not beside the
 * icons, so even "Wednesday" has the full width.
 *
 * The date and greeting depend on the viewer's clock and time zone, which the
 * server can't know, so they render only after hydration (with a same-height
 * placeholder) rather than risk a server/client mismatch.
 */
export function HomeHeader({ leading }: { leading?: React.ReactNode }) {
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
    <header className="relative">
      <div className="flex items-center gap-3">
        {leading}
        <div className="min-w-0 flex-1">
          <p className="text-primary truncate text-xs font-bold uppercase tracking-widest">
            {eyebrow}
          </p>
          <p className="text-muted-foreground mt-0.5 min-h-5 truncate text-sm">
            {now && (
              <React.Suspense fallback={greetingFor(now.getHours())}>
                <GreetingName prefix={greetingFor(now.getHours())} />
              </React.Suspense>
            )}
          </p>
        </div>
        <TabHeaderActions className="pt-0" />
      </div>
      <h1 className="text-foreground mt-2 text-4xl font-bold leading-tight tracking-tight">
        {weekday}
      </h1>
    </header>
  );
}
