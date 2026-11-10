"use client";

import * as React from "react";
import { Check, CircleAlert, Info, Loader2 } from "lucide-react";
import { Badge, Button, ExpandablePanel, cn } from "@mindreva/ui";
import type { IntegrationView } from "@/lib/integrations/types";
import { INTEGRATION_ICONS } from "./integration-icons";

export type IntegrationPhase = "idle" | "connecting" | "disconnecting";

export interface IntegrationMessage {
  tone: "info" | "success" | "error";
  text: string;
}

const MESSAGE_STYLES: Record<
  IntegrationMessage["tone"],
  { icon: React.ElementType; className: string }
> = {
  info: { icon: Info, className: "bg-secondary text-secondary-foreground" },
  success: { icon: Check, className: "bg-accent/60 text-foreground" },
  error: { icon: CircleAlert, className: "bg-destructive/10 text-destructive" },
};

/**
 * One integration, in every state it can be in: not available yet, ready to
 * connect, connecting, connected (with a manage area), and disconnecting, plus
 * an inline message for feedback. Purely presentational: the screen owns the
 * network calls and passes state in, so the same card works for any provider.
 */
export function IntegrationCard({
  integration,
  phase = "idle",
  message = null,
  onConnect,
  onDisconnect,
  settings,
}: {
  integration: IntegrationView;
  phase?: IntegrationPhase;
  message?: IntegrationMessage | null;
  onConnect: () => void;
  onDisconnect: () => void;
  /** Per-integration settings, shown while connected. */
  settings?: React.ReactNode;
}) {
  const Icon = INTEGRATION_ICONS[integration.id];
  const connected = integration.connection.status === "connected";
  const needsReconnect = integration.connection.status === "needs_reconnect";
  const busy = phase !== "idle";
  const MessageIcon = message ? MESSAGE_STYLES[message.tone].icon : null;

  return (
    <article
      aria-label={integration.name}
      className="border-card-edge bg-card/92 shadow-card rounded-card border-[0.5px] p-5"
    >
      <div className="flex items-center gap-3.5">
        <span className="border-border bg-background flex size-12 shrink-0 items-center justify-center rounded-2xl border">
          <Icon className="size-7" />
        </span>
        <h2 className="text-foreground min-w-0 flex-1 truncate text-lg font-bold tracking-tight">
          {integration.name}
        </h2>
        {connected ? (
          <Badge variant="success">
            <Check className="size-3" />
            Connected
          </Badge>
        ) : needsReconnect ? (
          <Badge variant="warning">Reconnect</Badge>
        ) : !integration.available ? (
          <Badge variant="neutral">Coming soon</Badge>
        ) : null}
      </div>

      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
        {integration.description}
      </p>

      {connected && integration.connection.accountLabel && (
        <p className="text-foreground mt-3 text-sm">
          Connected as{" "}
          <span className="font-semibold">
            {integration.connection.accountLabel}
          </span>
        </p>
      )}

      {needsReconnect && (
        <p className="text-subhead text-foreground mt-3">
          Google stopped letting Mindreva read your calendar (access was removed
          or expired). Reconnect to see events again.
        </p>
      )}

      {!connected && (
        <Button
          className="mt-4 w-full"
          size="lg"
          onClick={onConnect}
          disabled={busy}
        >
          {phase === "connecting" ? (
            <>
              <Loader2 className="animate-spin" />
              Connecting…
            </>
          ) : (
            <>
              {needsReconnect ? "Reconnect" : "Connect"} {integration.name}
            </>
          )}
        </Button>
      )}

      {/* The place future per-integration settings and management controls
          will live. Only meaningful once connected. */}
      {connected && (
        <div className="mt-4">
          {settings}
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={onDisconnect}
            disabled={busy}
          >
            {phase === "disconnecting" ? (
              <>
                <Loader2 className="animate-spin" />
                Disconnecting…
              </>
            ) : (
              <>Disconnect</>
            )}
          </Button>
        </div>
      )}

      {/* Feedback lives in an aria-live region so screen readers hear it, and
          animates open/closed so the card doesn't jump when it appears. */}
      <ExpandablePanel open={Boolean(message)} aria-live="polite" role="status">
        {message && MessageIcon && (
          <p
            className={cn(
              "mt-3 flex items-start gap-2 rounded-2xl px-3.5 py-3 text-sm leading-snug",
              MESSAGE_STYLES[message.tone].className,
            )}
          >
            <MessageIcon className="mt-0.5 size-4 shrink-0" />
            <span>{message.text}</span>
          </p>
        )}
      </ExpandablePanel>
    </article>
  );
}
