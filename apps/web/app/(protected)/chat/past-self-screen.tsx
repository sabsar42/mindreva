"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  History,
  MessageCircle,
  Sunrise,
  Sunset,
} from "lucide-react";
import { Button, IconTile, SwipeableRow, cn, toast } from "@mindreva/ui";
import { useHydrated } from "@/lib/use-hydrated";
import type { PastSelfSession, PastSelfYear } from "@/lib/past-self/sessions";
import { PrefetchLink } from "../_components/prefetch-link";
import { PageHeader } from "../_components/page-header";
import { TabHeaderActions } from "../_components/tab-header-actions";
import { SwipeNav } from "../_components/swipe-nav";
import { trashSwipeAction } from "../_components/swipe-actions";
import { ConfirmTrashDialog } from "../_components/confirm-trash-dialog";
import { RiverPanel } from "../river/river-panel";
import type { RiverData } from "@/lib/services/mindmap.service";

// Set when a conversation is created, consumed on this screen's next mount. A
// flag rather than refresh-then-push: a navigation discards a pending refresh,
// so the refresh would never actually invalidate the cached list.
const SESSIONS_STALE_KEY = "mindreva:chat-sessions-stale";

// Free-tier cap on conversations per half-year session. Must match
// MAX_FREE_CONVERSATIONS_PER_HALF in lib/services/persona-chat.service.ts,
// which actually enforces it server-side — this is only for the UI copy.
const MAX_FREE_CONVERSATIONS_PER_HALF = 2;

function markSessionsStale(): void {
  try {
    window.sessionStorage.setItem(SESSIONS_STALE_KEY, "1");
  } catch {
    // Storage unavailable: the list just catches up on its next fetch.
  }
}

function consumeSessionsStale(): boolean {
  try {
    if (window.sessionStorage.getItem(SESSIONS_STALE_KEY) === null) {
      return false;
    }
    window.sessionStorage.removeItem(SESSIONS_STALE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** "Sep 26". Built from the date's own parts, so it reads the same everywhere. */
function shortDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function SessionCard({
  session,
  open,
  onToggle,
  onAsk,
  asking,
  onDeleteConversation,
}: {
  session: PastSelfSession;
  open: boolean;
  onToggle: () => void;
  onAsk: () => void;
  asking: boolean;
  onDeleteConversation: (conversationId: string) => void;
}) {
  const hydrated = useHydrated();
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null,
  );
  const panelId = React.useId();
  // Entries aren't listed here anymore (they live on /journal), but a session
  // with entries and no conversations yet still needs to expand so "Ask your
  // past self" is reachable. Only a session with neither collapses.
  const empty =
    session.entries.length === 0 && session.conversations.length === 0;
  const Icon = session.half === 1 ? Sunrise : Sunset;

  const counts =
    session.conversations.length > 0
      ? plural(session.conversations.length, "conversation", "conversations")
      : null;

  // An empty half still appears (every year has exactly two sessions) but as a
  // quiet, non-expandable row, so there is no empty content to open.
  if (empty) {
    return (
      <div className="border-border/70 flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3">
        <IconTile size="sm" tone="neutral" className="opacity-60">
          <Icon />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground truncate text-sm font-semibold">
            {session.name}
          </p>
          <p className="text-muted-foreground/80 text-xs">
            {session.rangeLabel} · nothing written yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label={`${session.name}, ${session.rangeLabel}`}
      className="border-border bg-card shadow-subtle overflow-hidden rounded-3xl border"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="press hover:bg-secondary/60 focus-visible:ring-ring flex w-full items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        <IconTile>
          <Icon />
        </IconTile>
        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-base font-bold tracking-tight">
            {session.name}
          </span>
          <span className="text-muted-foreground block text-xs">
            {session.rangeLabel}
          </span>
          <span className="text-muted-foreground/80 mt-0.5 block text-xs">
            {counts}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "text-muted-foreground size-5 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="border-border space-y-5 border-t px-4 pb-4 pt-4">
            {session.entries.length > 0 && (
              <Button
                size="sm"
                className="w-full"
                onClick={onAsk}
                disabled={asking}
              >
                <MessageCircle />
                {asking ? "Starting…" : "Ask your past self about this period"}
              </Button>
            )}

            {session.conversations.length > 0 && (
              <div>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
                    Conversations
                  </h3>
                  <span className="text-muted-foreground/80 text-xs">
                    {session.conversations.length}/
                    {MAX_FREE_CONVERSATIONS_PER_HALF} on the free plan
                  </span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {session.conversations.map((c) => (
                    <li key={c.id}>
                      <SwipeableRow
                        actions={[
                          trashSwipeAction(() => setConfirmDeleteId(c.id)),
                        ]}
                      >
                        <PrefetchLink
                          href={`/chat/${c.id}`}
                          className="border-border hover:bg-secondary press flex items-center gap-3 rounded-2xl border px-3 py-2.5"
                        >
                          <History
                            aria-hidden
                            className="text-primary size-4 shrink-0"
                          />
                          <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                            {c.personaHalf
                              ? "Conversation"
                              : "Earlier conversation"}
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {hydrated
                              ? shortDate(c.createdAt.slice(0, 10))
                              : " "}
                          </span>
                        </PrefetchLink>
                      </SwipeableRow>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmTrashDialog
        open={confirmDeleteId !== null}
        onOpenChange={(v) => {
          if (!v) setConfirmDeleteId(null);
        }}
        onConfirm={() => {
          if (confirmDeleteId) onDeleteConversation(confirmDeleteId);
        }}
      />
    </section>
  );
}

export function PastSelfScreen({
  years,
  river,
}: {
  years: PastSelfYear[];
  river: RiverData;
}) {
  const router = useRouter();

  // This page can render from the Router Cache (prefetched by AppShell), so a
  // conversation started elsewhere wouldn't be listed on return. Refresh only
  // then: router.refresh() also empties the whole client Router Cache, and
  // doing it on every mount made each visit cost two server round trips.
  React.useEffect(() => {
    if (consumeSessionsStale()) router.refresh();
  }, [router]);

  // Open the most recent session that has anything in it, so the screen
  // starts on the part of your past you most likely want, with the rest
  // folded away.
  const defaultOpenKey = React.useMemo(() => {
    for (const year of years) {
      for (const session of [...year.sessions].reverse()) {
        if (session.entries.length + session.conversations.length > 0) {
          return session.key;
        }
      }
    }
    return null;
  }, [years]);

  const [openKeys, setOpenKeys] = React.useState<Set<string>>(
    () => new Set(defaultOpenKey ? [defaultOpenKey] : []),
  );
  const [askingKey, setAskingKey] = React.useState<string | null>(null);

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function ask(session: PastSelfSession) {
    setAskingKey(session.key);
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearStart: session.year,
          yearEnd: session.year,
          half: session.half,
        }),
      });
      if (!res.ok) throw new Error("Failed to start");
      const data = (await res.json()) as { session: { id: string } };
      markSessionsStale();
      router.push(`/chat/${data.session.id}`);
    } catch {
      toast.error("Couldn't start a conversation. Please try again.");
      setAskingKey(null);
    }
  }

  async function deleteConversation(conversationId: string) {
    const res = await fetch(`/api/chat/${conversationId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Couldn't delete that conversation. Please try again.");
      return;
    }
    toast.success("Conversation deleted");
    router.refresh();
  }

  return (
    <SwipeNav>
      <main className="mx-auto min-h-screen px-5 pb-12 pt-6">
        <PageHeader back="/journal">
          <TabHeaderActions />
        </PageHeader>

        <h1 className="text-foreground mt-2 text-4xl font-bold tracking-tight">
          Re-live Me
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Revisit what you wrote, then ask what you were thinking. Every answer
          is grounded only in what you actually wrote.
        </p>

        {/* The river comes first: the shape of your thinking, then the details. */}
        <RiverPanel data={river} className="mt-6" />

        {years.length === 0 ? (
          <div className="border-border bg-card shadow-subtle mt-6 flex flex-col items-center rounded-3xl border p-8 text-center">
            <IconTile size="lg">
              <History />
            </IconTile>
            <p className="text-foreground mt-4 text-base font-semibold">
              Nothing to look back on yet
            </p>
            <p className="text-muted-foreground mt-1.5 max-w-xs text-sm leading-relaxed">
              Record a few entries, and they&apos;ll gather here by season so
              you can revisit and talk to them.
            </p>
            <Button asChild className="mt-5">
              <Link href="/record">Record your first entry</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {years.map((year) => {
              const totalConversations = year.sessions.reduce(
                (n, s) => n + s.conversations.length,
                0,
              );
              return (
                <section key={year.year} aria-label={String(year.year)}>
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-foreground text-2xl font-bold tracking-tight">
                      {year.year}
                    </h2>
                    <span className="text-muted-foreground text-xs">
                      {plural(
                        totalConversations,
                        "conversation",
                        "conversations",
                      )}
                    </span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {year.sessions.map((session) => (
                      <SessionCard
                        key={session.key}
                        session={session}
                        open={openKeys.has(session.key)}
                        onToggle={() => toggle(session.key)}
                        onAsk={() => void ask(session)}
                        asking={askingKey === session.key}
                        onDeleteConversation={(id) =>
                          void deleteConversation(id)
                        }
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </SwipeNav>
  );
}
