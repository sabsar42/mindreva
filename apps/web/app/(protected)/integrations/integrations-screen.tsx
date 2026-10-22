"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@mindreva/ui";
import type { IntegrationView } from "@/lib/integrations/types";
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

export function IntegrationsScreen({
  initial,
}: {
  initial: IntegrationView[];
}) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [phases, setPhases] = React.useState<Record<string, IntegrationPhase>>(
    {},
  );
  const [messages, setMessages] = React.useState<
    Record<string, IntegrationMessage | null>
  >({});

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
    // Not available on this deployment: answer immediately instead of making
    // the user wait on a request whose answer we already know. (The API still
    // guards this with a 501, so it can't be bypassed.)
    if (!item.available) {
      setMessage(item.id, {
        tone: "info",
        text: `${item.name} isn't available yet. We'll turn it on soon.`,
      });
      return;
    }
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
        throw new Error("Bad redirect");
      }
      if (res.status === 501) {
        setMessage(item.id, {
          tone: "info",
          text: `${item.name} isn't available yet. We'll turn it on soon.`,
        });
        return;
      }
      throw new Error("Connect failed");
    } catch {
      setMessage(item.id, {
        tone: "error",
        text: `Couldn't connect ${item.name}. Please try again.`,
      });
      toast.error(`Couldn't connect ${item.name}.`);
    } finally {
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
        text: `${item.name} was disconnected.`,
      });
    } catch {
      setMessage(item.id, {
        tone: "error",
        text: `Couldn't disconnect ${item.name}. Please try again.`,
      });
    } finally {
      setPhase(item.id, "idle");
    }
  }

  return (
    <main className="min-h-app mx-auto px-5 pb-12 pt-6">
      <PageHeader
        title="Integrations"
        back={() => {
          // Same pattern as the entry screen: go back if there's in-app
          // history, otherwise land on Home (e.g. a deep link).
          if (window.history.length > 1) router.back();
          else router.push("/journal");
        }}
      >
        <TabHeaderActions />
      </PageHeader>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        Connect an app and your entries can work with it.
      </p>

      <h2 className="text-muted-foreground mt-7 text-xs font-semibold uppercase tracking-widest">
        Available
      </h2>
      <div className="mt-3 space-y-4">
        {items.map((item) => (
          <IntegrationCard
            key={item.id}
            integration={item}
            phase={phases[item.id] ?? "idle"}
            message={messages[item.id] ?? null}
            onConnect={() => void connect(item)}
            onDisconnect={() => void disconnect(item)}
          />
        ))}
      </div>
    </main>
  );
}
