"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, FileText, Search, X } from "lucide-react";
import { trashSwipeAction } from "./swipe-actions";
import {
  ActivitySheet,
  ActivityStrip,
  Input,
  NoteCard,
  SwipeableRow,
  buttonVariants,
  haptic,
  toast,
  type WeekInfo,
} from "@mindreva/ui";
import { useActivity, type InitialActivity } from "./use-activity";
import {
  beginForming,
  resetFormingFor,
  settleForming,
  useFormingMemories,
} from "@/lib/memory-forming";
import {
  localDayKey,
  moriMood,
  type MoriContext,
  type RecorderPhase,
} from "@/lib/mori-mood";
import { MoriCompanion } from "./mori-companion";
import {
  DATE_PLACEHOLDER,
  formatEntryDateTime,
  formatDuration,
} from "@/lib/format-entry";
import { useHydrated } from "@/lib/use-hydrated";
import { ConfirmTrashDialog } from "./confirm-trash-dialog";
import { EmptyState } from "./empty-state";
import { HomeHeader } from "./home-header";
import { InlineRecorder } from "./inline-recorder";
import { SwipeNav } from "./swipe-nav";
import type { EntryType } from "@mindreva/database";
import type { EntryListItemWithThumbnail } from "@/lib/services/entries.service";
import { useEntryThumbnails } from "./use-entry-thumbnails";
import { useOptimisticRemove } from "./use-optimistic-remove";
import { PrefetchLink } from "./prefetch-link";
import { getDefaultArtwork } from "@/lib/default-artwork";

export function EntryListScreen({
  type,
  heading,
  entries,
  initialActivity,
  calendarSlot,
}: {
  type: EntryType;
  heading: string;
  entries: EntryListItemWithThumbnail[];
  initialActivity: InitialActivity | null;
  /** Today's calendar events, when Google Calendar is connected. */
  calendarSlot?: React.ReactNode;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [localEntries, setLocalEntries] = React.useState(entries);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<
    EntryListItemWithThumbnail[] | null
  >(null);
  const [searching, setSearching] = React.useState(false);
  const [confirmTrashId, setConfirmTrashId] = React.useState<string | null>(
    null,
  );
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // `entries` changes identity on router.refresh(), e.g. after a recording.
  const activity = useActivity(type, initialActivity, entries);

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [week, setWeek] = React.useState<WeekInfo | null>(null);
  const [phase, setPhase] = React.useState<RecorderPhase>("idle");
  const [celebrating, setCelebrating] = React.useState(false);
  const [hour, setHour] = React.useState(12);
  const forming = useFormingMemories();

  // Another account on the same tab must not see this one's memories forming.
  const ownerId = initialActivity?.ownerId;
  React.useEffect(() => {
    if (ownerId) resetFormingFor(ownerId);
  }, [ownerId]);

  // Mori follows the clock: the hour changes how it reads a quiet day.
  React.useEffect(() => {
    const tick = () => setHour(new Date().getHours());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // A memory that has finished forming asks the server for the fresh list,
  // then settles into it once that list arrives. (The entry is already in the
  // list from the upload, with no title yet, so "it is in the list" alone
  // would settle on stale content.)
  const refreshedFor = React.useRef(new Map<string, unknown>());
  React.useEffect(() => {
    for (const m of forming) {
      if (m.phase !== "ready") continue;
      if (!refreshedFor.current.has(m.id)) {
        refreshedFor.current.set(m.id, entries);
        router.refresh();
      } else if (
        refreshedFor.current.get(m.id) !== entries &&
        entries.some((e) => e.id === m.id)
      ) {
        refreshedFor.current.delete(m.id);
        settleForming(m.id);
        setCelebrating(true);
        haptic("success");
      }
    }
  }, [forming, entries, router]);

  React.useEffect(() => {
    if (!celebrating) return;
    const id = setTimeout(() => setCelebrating(false), 3200);
    return () => clearTimeout(id);
  }, [celebrating]);

  const today = hydrated ? activity.getDay(localDayKey(new Date())) : undefined;
  const moriContext: MoriContext = {
    phase,
    forming: forming.some((m) =>
      ["transcribing", "writing", "ready"].includes(m.phase),
    ),
    celebrating,
    week: week && {
      days: week.days,
      recordings: week.recordings,
      isCurrent: week.isCurrent,
    },
    todayRecordings: today?.count ?? 0,
    hour,
  };

  // Keep local state in sync when the server re-provides entries (e.g. after
  // router.refresh()) — otherwise a swipe-removed row could reappear stale.
  React.useEffect(() => {
    setLocalEntries(entries);
  }, [entries]);

  const remove = useOptimisticRemove(localEntries, setLocalEntries);

  function archiveEntry(id: string) {
    return remove(
      id,
      { url: `/api/entries/${id}/archive`, method: "POST" },
      {
        done: "Archived",
        failed:
          "Couldn't archive that entry. It's back in your list; try again.",
      },
    );
  }

  function trashEntry(id: string) {
    return remove(
      id,
      { url: `/api/entries/${id}/trash`, method: "POST" },
      {
        done: "Moved to Trash",
        failed:
          "Couldn't move that entry to Trash. It's back in your list; try again.",
      },
    );
  }

  function openSearch() {
    setSearchOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
    setSearchResults(null);
  }

  // Debounced live search across title/transcript/summary via the API.
  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    // Each keystroke cancels the previous request, so a slow response for
    // an older query can never overwrite the results for the newer one.
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/entries?type=${type}&q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const data = (await res.json()) as {
            entries: EntryListItemWithThumbnail[];
          };
          setSearchResults(data.entries);
        } else {
          toast.error("Search isn't working right now. Try again in a moment.");
        }
      } catch {
        if (controller.signal.aborted) return;
        toast.error("Search needs a connection. Check yours and try again.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query, type]);

  // Memories still forming take the place of their (blank) entry, newest on
  // top; ones that failed keep their entry card with a short reason.
  const makingIds = new Set(
    forming
      .filter((m) => ["transcribing", "writing", "ready"].includes(m.phase))
      .map((m) => m.id),
  );
  const failedReason = new Map(
    forming.filter((m) => m.phase === "failed").map((m) => [m.id, m.failure]),
  );
  const settlingIds = new Set(
    forming.filter((m) => m.phase === "settled").map((m) => m.id),
  );
  const formingCards = searchResults
    ? []
    : forming.filter((m) => makingIds.has(m.id));
  const visible = (searchResults ?? localEntries).filter(
    (e) => searchResults || !makingIds.has(e.id),
  );
  const visibleIds = React.useMemo(() => visible.map((e) => e.id), [visible]);
  const { thumbnails: entryThumbnails, resolved: thumbnailResolved } =
    useEntryThumbnails(visibleIds);

  return (
    <SwipeNav>
      <main className="h-app mx-auto flex flex-col px-5 pt-6">
        {/* Everything above the entries is fixed; only the list scrolls. */}
        <div className="shrink-0">
          <HomeHeader
            leading={
              <MoriCompanion
                mood={moriMood(moriContext)}
                context={moriContext}
                streak={activity.streak}
              />
            }
          />

          <ActivityStrip
            className="mt-[18px]"
            getDay={activity.getDay}
            ensureYear={activity.ensureYear}
            onWeekChange={setWeek}
            onOpen={() => setSheetOpen(true)}
          />
          {type === "journal" && (
            <InlineRecorder
              className="mt-4"
              streak={activity.streak}
              onPhaseChange={setPhase}
              onSaved={beginForming}
            />
          )}

          <div className="mt-3.5 flex h-10 items-center justify-between gap-3">
            {searchOpen ? (
              <div className="border-border bg-card motion-safe:animate-fade-in flex h-10 flex-1 items-center gap-2 rounded-full border px-3.5">
                <Search className="text-muted-foreground size-4 shrink-0" />
                <Input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && closeSearch()}
                  placeholder={`Search ${heading.toLowerCase()}…`}
                  aria-label={`Search ${heading.toLowerCase()}`}
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                />
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={closeSearch}
                  className={buttonVariants({
                    variant: "quiet",
                    size: "icon-sm",
                  })}
                >
                  <X />
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-foreground text-lg font-bold tracking-tight">
                  {heading}
                </h2>
                <button
                  type="button"
                  aria-label={`Search ${heading.toLowerCase()}`}
                  onClick={openSearch}
                  className={buttonVariants({ variant: "quiet", size: "icon" })}
                >
                  <Search />
                </button>
              </>
            )}
          </div>
        </div>

        <div
          data-entry-list
          className="-mx-5 mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-5 pb-[calc(2.5rem+var(--safe-bottom))] pt-1 [mask-image:linear-gradient(to_bottom,transparent,black_10px)]"
        >
          {!searchResults && calendarSlot}

          {searching && (
            <p role="status" className="text-muted-foreground text-sm">
              Searching…
            </p>
          )}

          {!searching &&
            formingCards.map((m) => (
              <NoteCard
                key={m.id}
                title=""
                dateLabel="Just now"
                durationLabel={formatDuration(m.durationMs)}
                forming={{
                  stage:
                    m.phase === "transcribing"
                      ? "transcribing"
                      : m.phase === "writing"
                        ? "writing"
                        : "finishing",
                  text: m.text,
                }}
              />
            ))}

          {!searching && visible.length === 0 && formingCards.length === 0 && (
            <EmptyState
              icon={searchResults ? <Search /> : <FileText />}
              title={
                searchResults
                  ? "No matches"
                  : `No ${heading.toLowerCase()} entries yet`
              }
              message={
                searchResults
                  ? "Try a different word or phrase."
                  : "Tap record to capture your first entry."
              }
            />
          )}

          {!searching &&
            visible.map((entry) => (
              <SwipeableRow
                key={entry.id}
                actions={[
                  {
                    key: "archive",
                    label: "Archive",
                    icon: <Archive className="size-5" />,
                    onClick: () => void archiveEntry(entry.id),
                    className: "bg-secondary text-secondary-foreground",
                  },
                  trashSwipeAction(() => setConfirmTrashId(entry.id)),
                ]}
              >
                <PrefetchLink href={`/entries/${entry.id}`}>
                  <NoteCard
                    title={entry.title || "Untitled entry"}
                    dateLabel={
                      hydrated
                        ? formatEntryDateTime(entry.createdAt)
                        : DATE_PLACEHOLDER
                    }
                    durationLabel={formatDuration(entry.durationMs)}
                    snippet={entry.snippet ?? undefined}
                    failed={failedReason.get(entry.id)}
                    settling={settlingIds.has(entry.id)}
                    thumbnailPending={!thumbnailResolved(entry.id)}
                    thumbnailUrl={
                      entryThumbnails[entry.id] ??
                      entry.thumbnailUrl ??
                      getDefaultArtwork(entry.id)
                    }
                  />
                </PrefetchLink>
              </SwipeableRow>
            ))}
        </div>

        <ActivitySheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          getDay={activity.getDay}
          ensureYear={activity.ensureYear}
        />

        <ConfirmTrashDialog
          open={confirmTrashId !== null}
          onOpenChange={(open) => !open && setConfirmTrashId(null)}
          onConfirm={() => {
            if (confirmTrashId) void trashEntry(confirmTrashId);
          }}
        />
      </main>
    </SwipeNav>
  );
}
