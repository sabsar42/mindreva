"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  History,
  MessageCircle,
  Sunrise,
  Sunset,
} from "lucide-react";
import { Button, IconTile, SwipeableRow, cn, toast } from "@mindreva/ui";
import { useHydrated } from "@/lib/use-hydrated";
import {
  entryDateKey,
  type PastSelfSession,
  type PastSelfYear,
  type SessionEntry,
} from "@/lib/past-self/sessions";
import { pickMemories, yearsAgoLabel } from "@/lib/on-this-day";
import { getDefaultArtwork } from "@/lib/default-artwork";
import { PrefetchLink } from "../_components/prefetch-link";
import { PageHeader } from "../_components/page-header";
import { SwipeNav } from "../_components/swipe-nav";
import { trashSwipeAction } from "../_components/swipe-actions";
import { ConfirmTrashDialog } from "../_components/confirm-trash-dialog";
import { useEntryThumbnails } from "../_components/use-entry-thumbnails";
import { RiverPanel } from "../river/river-panel";
import { DayEventsInline } from "../_components/calendar-events";
import type { RiverData } from "@/lib/services/mindmap.service";

// Set when a conversation is created, consumed on this screen's next mount. A
// flag rather than refresh-then-push: a navigation discards a pending refresh,
// so the refresh would never actually invalidate the cached list.
const SESSIONS_STALE_KEY = "mindreva:chat-sessions-stale";

// Cap on conversations per half-year session. Must match
// MAX_CONVERSATIONS_PER_HALF in lib/services/persona-chat.service.ts, which
// actually enforces it server-side — this is only for the UI copy.
const MAX_CONVERSATIONS_PER_HALF = 2;

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

/** "Sep 26" / "Sep 26, 2024". Built from the key's own parts (no TZ drift). */
function formatDay(key: string, withYear = false): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/* ------------------------------------------------------------------ */
/* Memories carousel                                                    */
/* ------------------------------------------------------------------ */

/**
 * Horizontally paged memory cards (scroll-snap, one card and a peek of the
 * next): "On this day" when earlier years have an entry on today's date,
 * otherwise moments spread across the past. Each card opens its entry.
 */
function MemoriesCarousel({
  entries,
  todayKey,
  calendarFor,
}: {
  entries: SessionEntry[];
  todayKey: string;
  calendarFor?: (dateKey: string) => React.ReactNode;
}) {
  const memories = React.useMemo(
    () => pickMemories(entries, todayKey),
    [entries, todayKey],
  );
  const ids = React.useMemo(
    () => memories.entries.map((e) => e.id),
    [memories],
  );
  const { thumbnails } = useEntryThumbnails(ids);
  if (memories.entries.length === 0) return null;

  const heading = memories.kind === "on-this-day" ? "On this day" : "Moments";

  return (
    <section aria-label={heading} className="mt-6">
      <h2 className="text-title-3 text-foreground px-1 font-bold">{heading}</h2>
      <ul
        data-swipe-nav-ignore
        className="-mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {memories.entries.map((entry) => {
          const day = entryDateKey(entry);
          const eyebrow =
            memories.kind === "on-this-day"
              ? `${yearsAgoLabel(day, todayKey)} · ${formatDay(day, true)}`
              : formatDay(day, true);
          const cover = thumbnails[entry.id] ?? getDefaultArtwork(entry.id);
          return (
            <li key={entry.id} className="w-[82%] max-w-80 shrink-0 snap-start">
              <PrefetchLink
                href={`/entries/${entry.id}`}
                className="bg-card border-border shadow-subtle press focus-visible:ring-ring flex h-full flex-col overflow-hidden rounded-3xl border focus-visible:outline-none focus-visible:ring-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URLs / bundled artwork */}
                <img
                  src={cover}
                  alt=""
                  width={320}
                  height={140}
                  loading="lazy"
                  className="bg-secondary aspect-[16/7] w-full object-cover"
                />
                <span className="flex flex-1 flex-col p-4">
                  <span className="text-caption text-primary font-semibold uppercase tracking-wide">
                    {eyebrow}
                  </span>
                  <span className="text-foreground mt-1 line-clamp-2 font-serif text-lg font-semibold leading-snug">
                    {entry.title || "Untitled entry"}
                  </span>
                  {entry.snippet && (
                    <span className="text-footnote text-muted-foreground mt-1 line-clamp-3">
                      {entry.snippet}
                    </span>
                  )}
                  {calendarFor?.(day)}
                </span>
              </PrefetchLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Seasons                                                              */
/* ------------------------------------------------------------------ */

function SessionCard({
  session,
  open,
  onToggle,
  onAsk,
  asking,
  hiddenConversations,
  onDeleteConversation,
}: {
  session: PastSelfSession;
  open: boolean;
  onToggle: () => void;
  onAsk: () => void;
  asking: boolean;
  hiddenConversations: ReadonlySet<string>;
  onDeleteConversation: (conversationId: string) => void;
}) {
  const hydrated = useHydrated();
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null,
  );
  const panelId = React.useId();
  const conversations = session.conversations.filter(
    (c) => !hiddenConversations.has(c.id),
  );
  const empty = session.entries.length === 0 && conversations.length === 0;
  const Icon = session.half === 1 ? Sunrise : Sunset;
  const meta = [
    session.entries.length > 0
      ? plural(session.entries.length, "entry", "entries")
      : null,
    conversations.length > 0
      ? plural(conversations.length, "conversation", "conversations")
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // An empty half still appears (every year has two) as a quiet row.
  if (empty) {
    return (
      <div className="border-border flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3">
        <IconTile size="sm" tone="neutral" className="opacity-60">
          <Icon />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="text-subhead text-muted-foreground truncate font-semibold">
            {session.name}
          </p>
          <p className="text-footnote text-muted-foreground">
            {session.rangeLabel} · nothing written yet
          </p>
        </div>
      </div>
    );
  }

  const latest = [...session.entries].reverse().slice(0, 8);

  return (
    <section
      aria-label={`${session.name}, ${session.rangeLabel}`}
      className="border-border bg-card shadow-subtle overflow-hidden rounded-2xl border"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="focus-visible:ring-ring active:bg-row-pressed flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset active:scale-100 active:shadow-none"
      >
        <IconTile>
          <Icon />
        </IconTile>
        <span className="min-w-0 flex-1">
          <span className="text-headline text-foreground block truncate">
            {session.name}
          </span>
          <span className="text-footnote text-muted-foreground block tabular-nums">
            {session.rangeLabel}
            {meta && ` · ${meta}`}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "text-muted-foreground ease-sheet size-5 shrink-0 transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        id={panelId}
        className={cn(
          "ease-sheet grid transition-[grid-template-rows,opacity] duration-300",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="border-separator space-y-4 border-t-[0.5px] pb-4 pt-3">
            {latest.length > 0 && (
              <ul
                data-swipe-nav-ignore
                aria-label="Entries from this season"
                className="flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {latest.map((e) => (
                  <li key={e.id} className="w-40 shrink-0 snap-start">
                    <PrefetchLink
                      href={`/entries/${e.id}`}
                      className="bg-secondary press focus-visible:ring-ring block h-full rounded-xl px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2"
                    >
                      <span className="text-caption text-muted-foreground block tabular-nums">
                        {formatDay(entryDateKey(e))}
                      </span>
                      <span className="text-footnote text-foreground mt-0.5 line-clamp-2 block font-semibold">
                        {e.title || "Untitled entry"}
                      </span>
                    </PrefetchLink>
                  </li>
                ))}
              </ul>
            )}

            {session.entries.length > 0 && (
              <div className="px-4">
                <Button className="w-full" onClick={onAsk} loading={asking}>
                  <MessageCircle />
                  Ask your past self
                </Button>
              </div>
            )}

            {conversations.length > 0 && (
              <div className="px-4">
                <div className="flex items-baseline justify-between px-1">
                  <h3 className="text-footnote text-muted-foreground font-semibold uppercase tracking-wide">
                    Conversations
                  </h3>
                  <span className="text-footnote text-muted-foreground tabular-nums">
                    {conversations.length} of {MAX_CONVERSATIONS_PER_HALF}
                  </span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {conversations.map((c) => (
                    <li key={c.id}>
                      <SwipeableRow
                        actions={[
                          trashSwipeAction(() => setConfirmDeleteId(c.id)),
                        ]}
                      >
                        <PrefetchLink
                          href={`/chat/${c.id}`}
                          className="bg-secondary active:bg-row-pressed flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5"
                        >
                          <History
                            aria-hidden
                            className="text-primary size-4 shrink-0"
                          />
                          <span className="text-subhead text-foreground min-w-0 flex-1 truncate font-medium">
                            {c.personaHalf
                              ? "Conversation"
                              : "Earlier conversation"}
                          </span>
                          <span className="text-footnote text-muted-foreground shrink-0 tabular-nums">
                            {hydrated
                              ? formatDay(c.createdAt.slice(0, 10))
                              : " "}
                          </span>
                          <ChevronRight
                            aria-hidden
                            className="text-label-tertiary size-4 shrink-0"
                          />
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

/* ------------------------------------------------------------------ */
/* Screen                                                               */
/* ------------------------------------------------------------------ */

/**
 * Re-live Me: a memories surface. Memory cards (on this day, or moments from
 * the past) first, then the river of themes, then the past by season, where
 * each half-year shows its entries and lets you ask your past self about
 * that period (at most two conversations each, enforced server-side).
 */
export function PastSelfScreen({
  years,
  river,
  todayKey,
  calendarConnected = false,
}: {
  years: PastSelfYear[];
  river: RiverData;
  todayKey: string | null;
  /** Show each memory's calendar events (Google Calendar connected). */
  calendarConnected?: boolean;
}) {
  const router = useRouter();

  // This page can render from the Router Cache (prefetched by AppShell), so a
  // conversation started elsewhere wouldn't be listed on return. Refresh only
  // then: router.refresh() also empties the whole client Router Cache.
  React.useEffect(() => {
    if (consumeSessionsStale()) router.refresh();
  }, [router]);

  const allEntries = React.useMemo(
    () => years.flatMap((y) => y.sessions.flatMap((s) => s.entries)),
    [years],
  );

  // Open the most recent session that has anything in it.
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
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(new Set());

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

  // Optimistic: the row leaves at once and comes back if the server says no.
  async function deleteConversation(conversationId: string) {
    setHidden((prev) => new Set(prev).add(conversationId));
    let ok = false;
    try {
      ok = (await fetch(`/api/chat/${conversationId}`, { method: "DELETE" }))
        .ok;
    } catch {
      ok = false;
    }
    if (!ok) {
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(conversationId);
        return next;
      });
      toast.error("Couldn't delete that conversation. It's still here.");
      return;
    }
    toast.success("Conversation deleted");
    router.refresh();
  }

  return (
    <SwipeNav>
      <main className="min-h-app mx-auto px-4 pb-10 pt-6">
        <PageHeader back={false} title="Re-live Me" large />
        <p className="text-subhead text-muted-foreground mt-1 px-0.5">
          Revisit what you wrote, then ask what you were thinking. Answers come
          only from your own entries.
        </p>

        {years.length === 0 ? (
          <div className="border-border bg-card shadow-subtle mt-6 flex flex-col items-center rounded-2xl border px-6 py-10 text-center">
            <IconTile size="lg">
              <History />
            </IconTile>
            <p className="text-headline text-foreground mt-4">
              Your memories will gather here
            </p>
            <p className="text-subhead text-muted-foreground mt-1.5 max-w-xs">
              Record a few entries. Over time they&apos;ll come back to you
              here, by day and by season, and you can talk to them.
            </p>
            <Button asChild className="mt-5">
              <Link href="/journal">Record your first entry</Link>
            </Button>
          </div>
        ) : (
          <>
            {todayKey && (
              <MemoriesCarousel
                entries={allEntries}
                todayKey={todayKey}
                calendarFor={
                  calendarConnected
                    ? (day) => (
                        <DayEventsInline dateKey={day} className="mt-2" />
                      )
                    : undefined
                }
              />
            )}

            {/* The river is a bonus: it shows its own empty state. */}
            <RiverPanel data={river} className="mt-6" />

            <div className="mt-8 space-y-8">
              {years.map((year) => (
                <section key={year.year} aria-label={String(year.year)}>
                  <h2 className="text-title-2 text-foreground px-1 font-bold tabular-nums">
                    {year.year}
                  </h2>
                  <div className="mt-3 space-y-3">
                    {year.sessions.map((session) => (
                      <SessionCard
                        key={session.key}
                        session={session}
                        open={openKeys.has(session.key)}
                        onToggle={() => toggle(session.key)}
                        onAsk={() => void ask(session)}
                        asking={askingKey === session.key}
                        hiddenConversations={hidden}
                        onDeleteConversation={(id) =>
                          void deleteConversation(id)
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </main>
    </SwipeNav>
  );
}
