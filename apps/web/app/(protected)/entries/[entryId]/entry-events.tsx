"use client";

import * as React from "react";
import { CalendarCheck, CalendarPlus, Loader2, X } from "lucide-react";
import { toast } from "@mindreva/ui";

interface SuggestedEvent {
  id: string;
  title: string;
  /** "YYYY-MM-DD" */
  startDate: string;
  /** "HH:MM" or null for all-day */
  startTime: string | null;
  status: "suggested" | "added" | "dismissed";
}

interface EventsResponse {
  configured: boolean;
  canAddEvents: boolean;
  events: SuggestedEvent[];
}

/** Cookie the Google callback reads to bring the user back to this entry. */
const AFTER_CONNECT_COOKIE = "mindreva_after_connect";

function formatWhen(e: Pick<SuggestedEvent, "startDate" | "startTime">) {
  const [y, m, d] = e.startDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  if (!e.startTime) return `${day} · All day`;
  const [h, min] = e.startTime.split(":").map(Number) as [number, number];
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${day} · ${hour12}:${String(min).padStart(2, "0")} ${suffix}`;
}

/**
 * Events mentioned in an entry ("dentist Thursday at 3"), each with one tap to
 * add it to Google Calendar. Nothing is added until the user taps. If the
 * calendar isn't connected (or was connected read-only), the same tap takes
 * them through Google's consent once and brings them back here, where the
 * event is then added without another tap. Renders nothing when there are no
 * suggestions or calendar isn't set up on this deployment.
 *
 * `refreshKey` changes whenever the entry's summary does, which is when the
 * suggestions are recomputed.
 */
export function EntryEvents({
  entryId,
  refreshKey,
}: {
  entryId: string;
  refreshKey: string;
}) {
  const [data, setData] = React.useState<EventsResponse | null>(null);
  const [busy, setBusy] = React.useState<ReadonlySet<string>>(new Set());
  const autoAddedRef = React.useRef(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/entries/${entryId}/events`);
      if (!res.ok) return null;
      const next = (await res.json()) as EventsResponse;
      setData(next);
      return next;
    } catch {
      return null;
    }
  }, [entryId]);

  const setBusyFor = (id: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const add = React.useCallback(
    async (eventId: string) => {
      setBusyFor(eventId, true);
      try {
        const res = await fetch(`/api/entries/${entryId}/events/${eventId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add" }),
        });
        const out = (await res.json().catch(() => null)) as {
          result?: "added" | "needs_permission" | "failed";
        } | null;

        if (out?.result === "added") {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  events: prev.events.map((e) =>
                    e.id === eventId ? { ...e, status: "added" } : e,
                  ),
                }
              : prev,
          );
          toast.success("Added to your calendar");
          return;
        }
        if (out?.result === "needs_permission") {
          // One trip through Google's consent screen, then straight back here
          // to finish adding this event.
          document.cookie = `${AFTER_CONNECT_COOKIE}=${encodeURIComponent(
            `/entries/${entryId}?addEvent=${eventId}`,
          )}; path=/; max-age=600; samesite=lax`;
          const conn = await fetch(
            "/api/integrations/google-calendar/connect",
            {
              method: "POST",
            },
          );
          const link = (await conn.json().catch(() => null)) as {
            redirectUrl?: string;
          } | null;
          if (link?.redirectUrl) {
            window.location.href = link.redirectUrl;
            return;
          }
        }
        toast.error("Couldn't add it to your calendar. Please try again.");
      } catch {
        toast.error("Couldn't add it to your calendar. Please try again.");
      } finally {
        setBusyFor(eventId, false);
      }
    },
    [entryId],
  );

  async function dismiss(eventId: string) {
    setData((prev) =>
      prev
        ? { ...prev, events: prev.events.filter((e) => e.id !== eventId) }
        : prev,
    );
    await fetch(`/api/entries/${entryId}/events/${eventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    }).catch(() => {});
  }

  React.useEffect(() => {
    void load().then((loaded) => {
      // Back from Google's consent screen: finish the add that started it.
      if (!loaded || autoAddedRef.current) return;
      const params = new URLSearchParams(window.location.search);
      const pending = params.get("addEvent");
      if (!pending) return;
      autoAddedRef.current = true;
      window.history.replaceState(null, "", window.location.pathname);
      const target = loaded.events.find((e) => e.id === pending);
      if (target && target.status === "suggested" && loaded.canAddEvents) {
        void add(pending);
      }
    });
  }, [load, add, refreshKey]);

  if (!data || !data.configured || data.events.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-widest">
        Events
      </p>
      <ul className="flex flex-col gap-2.5">
        {data.events.map((e) => {
          const added = e.status === "added";
          const working = busy.has(e.id);
          return (
            <li
              key={e.id}
              className="bg-card border-border shadow-subtle rounded-2xl border p-4"
            >
              <div className="flex items-start gap-3">
                <span className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
                  {added ? (
                    <CalendarCheck className="size-4" />
                  ) : (
                    <CalendarPlus className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-[0.9375rem] font-semibold leading-snug">
                    {e.title}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    {formatWhen(e)}
                  </p>
                </div>
                {!added && (
                  <button
                    type="button"
                    onClick={() => void dismiss(e.id)}
                    aria-label={`Dismiss ${e.title}`}
                    className="text-muted-foreground hover:text-foreground -mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              {added ? (
                <p className="text-primary mt-3 flex items-center gap-1.5 text-sm font-semibold">
                  <CalendarCheck className="size-4" />
                  Added to your calendar
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => void add(e.id)}
                  disabled={working}
                  className="bg-primary text-primary-foreground mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  {working ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CalendarPlus className="size-4" />
                  )}
                  Add to calendar
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {!data.canAddEvents && data.events.some((e) => e.status !== "added") && (
        <p className="text-muted-foreground mt-2 text-xs">
          The first time, Google will ask you to allow adding events.
        </p>
      )}
    </div>
  );
}
