"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plug } from "lucide-react";
import { IconTile, Switch, toast } from "@mindreva/ui";
import type { IntegrationView } from "@/lib/integrations/types";
import type { CalendarListItem } from "@/lib/integrations/google/calendar-api";
import { PageHeader } from "../_components/page-header";
import { TabHeaderActions } from "../_components/tab-header-actions";
import {
  IntegrationCard,
  type IntegrationMessage,
  type IntegrationPhase,
} from "./integration-card";

/** Only follow redirects to https URLs: the connect endpoint should only ever hand back an OAuth consent page. */
function isSafeRedirect(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** What the OAuth callback's ?result= means, in plain words. */
const RESULT_MESSAGES: Record<string, IntegrationMessage> = {
  connected: {
    tone: "success",
    text: "Google Calendar is connected. Your events will show beside your entries.",
  },
  denied: {
    tone: "info",
    text: "Nothing was connected. You can connect any time.",
  },
  scope: {
    tone: "error",
    text: "Mindreva needs permission to see your calendar to show events. Try again and keep that box ticked.",
  },
  state: {
    tone: "error",
    text: "That sign-in took too long or came from another tab. Please try connecting again.",
  },
  no_refresh_token: {
    tone: "error",
    text: "Google didn't grant lasting access. Please try connecting again.",
  },
  exchange: {
    tone: "error",
    text: "Couldn't finish connecting with Google. Please try again.",
  },
  error: {
    tone: "error",
    text: "Something went wrong while connecting. Please try again.",
  },
};

type Calendar = CalendarListItem & { selected: boolean };

/**
 * Which calendars to show, as a grouped list of switches. Toggling saves
 * immediately (optimistic, rolled back with a message if it fails), and at
 * least one calendar always stays on.
 */
function CalendarSettings() {
  const [calendars, setCalendars] = React.useState<Calendar[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let live = true;
    fetch("/api/calendar/calendars")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((d: { calendars: Calendar[] }) => live && setCalendars(d.calendars))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  async function toggle(id: string, on: boolean) {
    if (!calendars) return;
    const before = calendars;
    const next = calendars.map((c) =>
      c.id === id ? { ...c, selected: on } : c,
    );
    if (!next.some((c) => c.selected)) {
      toast("Keep at least one calendar on.");
      return;
    }
    setCalendars(next);
    const res = await fetch("/api/calendar/calendars", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: next.filter((c) => c.selected).map((c) => c.id),
      }),
    }).catch(() => null);
    if (!res?.ok) {
      setCalendars(before);
      toast.error("Couldn't save that change. Please try again.");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-footnote text-muted-foreground px-1">
        Mindreva reads event titles and times from the calendars you choose,
        only to show them beside your entries. It never changes your calendar
        and never sends calendar data to an AI model.
      </p>
      {failed ? (
        <p className="text-footnote text-destructive px-1" role="alert">
          Couldn&apos;t load your calendars right now.
        </p>
      ) : (
        <ul
          aria-label="Calendars to show"
          aria-busy={!calendars || undefined}
          className="bg-background border-border grouped-list overflow-hidden rounded-2xl border"
        >
          {(calendars ?? [null, null]).map((c, i) => (
            <li
              key={c?.id ?? i}
              className="flex min-h-11 items-center gap-3 px-4 py-2"
            >
              {c ? (
                <>
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor: c.color ?? "var(--muted-foreground)",
                    }}
                  />
                  <span className="text-subhead text-foreground min-w-0 flex-1 truncate">
                    {c.name}
                    {c.primary && (
                      <span className="text-muted-foreground"> · Main</span>
                    )}
                  </span>
                  <Switch
                    checked={c.selected}
                    onCheckedChange={(on) => void toggle(c.id, on)}
                    aria-label={`Show events from ${c.name}`}
                  />
                </>
              ) : (
                <span className="bg-muted h-4 w-40 animate-pulse rounded" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function IntegrationsScreen({
  initial,
  result,
}: {
  initial: IntegrationView[];
  /** ?result= from the OAuth callback. */
  result?: string;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [phases, setPhases] = React.useState<Record<string, IntegrationPhase>>(
    {},
  );
  const [messages, setMessages] = React.useState<
    Record<string, IntegrationMessage | null>
  >(() => {
    const initialMessage = result ? RESULT_MESSAGES[result] : undefined;
    const start: Record<string, IntegrationMessage | null> = {};
    if (initialMessage) start["google-calendar"] = initialMessage;
    return start;
  });

  // Drop ?result= from the address so a reload doesn't repeat the message.
  React.useEffect(() => {
    if (result) router.replace("/integrations", { scroll: false });
  }, [result, router]);

  const setPhase = (id: string, phase: IntegrationPhase) =>
    setPhases((p) => ({ ...p, [id]: phase }));
  const setMessage = (id: string, message: IntegrationMessage | null) =>
    setMessages((m) => ({ ...m, [id]: message }));

  async function refresh() {
    const res = await fetch("/api/integrations");
    if (!res.ok) throw new Error("Failed to refresh");
    const data = (await res.json()) as { integrations: IntegrationView[] };
    setItems(data.integrations);
  }

  async function connect(item: IntegrationView) {
    setMessage(item.id, null);
    setPhase(item.id, "connecting");
    try {
      const res = await fetch(`/api/integrations/${item.id}/connect`, {
        method: "POST",
      });
      if (res.ok) {
        const data = (await res.json()) as { redirectUrl?: unknown };
        if (isSafeRedirect(data.redirectUrl)) {
          window.location.assign(data.redirectUrl);
          return;
        }
      }
      throw new Error("Connect failed");
    } catch {
      setMessage(item.id, {
        tone: "error",
        text: `Couldn't start connecting ${item.name}. Please try again.`,
      });
      setPhase(item.id, "idle");
    }
  }

  async function disconnect(item: IntegrationView) {
    setMessage(item.id, null);
    setPhase(item.id, "disconnecting");
    try {
      const res = await fetch(`/api/integrations/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Disconnect failed");
      await refresh();
      setMessage(item.id, {
        tone: "success",
        text: `${item.name} was disconnected, and Mindreva's access was removed.`,
      });
      router.refresh();
    } catch {
      setMessage(item.id, {
        tone: "error",
        text: `Couldn't disconnect ${item.name}. Please try again.`,
      });
    } finally {
      setPhase(item.id, "idle");
    }
  }

  // Only what this deployment can actually connect; nothing "coming soon".
  const available = items.filter((i) => i.available);

  return (
    <main className="min-h-app mx-auto px-5 pb-12 pt-6">
      <PageHeader
        title="Integrations"
        back={() => {
          // Go back if there's in-app history, otherwise land on Home.
          if (window.history.length > 1) router.back();
          else router.push("/journal");
        }}
      >
        <TabHeaderActions />
      </PageHeader>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        Optional. Connecting an app never unlocks or changes anything else.
      </p>

      {available.length === 0 ? (
        <div className="border-border bg-card shadow-subtle mt-6 flex flex-col items-center rounded-2xl border px-6 py-10 text-center">
          <IconTile size="lg" tone="neutral">
            <Plug />
          </IconTile>
          <p className="text-headline text-foreground mt-4">
            Nothing to connect yet
          </p>
          <p className="text-subhead text-muted-foreground mt-1.5 max-w-xs">
            Apps you can connect will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {available.map((item) => (
            <IntegrationCard
              key={item.id}
              integration={item}
              phase={phases[item.id] ?? "idle"}
              message={messages[item.id] ?? null}
              onConnect={() => void connect(item)}
              onDisconnect={() => void disconnect(item)}
              settings={
                item.id === "google-calendar" &&
                item.connection.status === "connected" ? (
                  <CalendarSettings />
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}
