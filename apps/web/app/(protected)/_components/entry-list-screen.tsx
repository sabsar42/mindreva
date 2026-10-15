"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, FileText, Search, X } from "lucide-react";
import { trashSwipeAction } from "./swipe-actions";
import {
  Input,
  JournalHeatmap,
  NoteCard,
  SwipeableRow,
  toast,
} from "@mindreva/ui";
import { useHeatmapYears, type InitialHeatmap } from "./use-heatmap-years";
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
import { TranscriptionWatcher } from "./transcription-watcher";
import { useEntryThumbnails } from "./use-entry-thumbnails";
import { PrefetchLink } from "./prefetch-link";
import { getDefaultArtwork } from "@/lib/default-artwork";

export function EntryListScreen({
  type,
  heading,
  entries,
  initialHeatmap,
}: {
  type: EntryType;
  heading: string;
  entries: EntryListItemWithThumbnail[];
  initialHeatmap: InitialHeatmap | null;
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
  const heatmap = useHeatmapYears(type, initialHeatmap, entries);

  // Keep local state in sync when the server re-provides entries (e.g. after
  // router.refresh()) — otherwise a swipe-removed row could reappear stale.
  React.useEffect(() => {
    setLocalEntries(entries);
  }, [entries]);

  async function archiveEntry(id: string) {
    const res = await fetch(`/api/entries/${id}/archive`, { method: "POST" });
    if (!res.ok) {
      toast.error("Something went wrong.");
      return;
    }
    setLocalEntries((prev) => prev.filter((e) => e.id !== id));
    toast.success("Archived");
    router.refresh();
  }

  async function trashEntry(id: string) {
    const res = await fetch(`/api/entries/${id}/trash`, { method: "POST" });
    if (!res.ok) {
      toast.error("Something went wrong.");
      return;
    }
    setLocalEntries((prev) => prev.filter((e) => e.id !== id));
    toast.success("Moved to Trash");
    router.refresh();
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
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/entries?type=${type}&q=${encodeURIComponent(trimmed)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as {
            entries: EntryListItemWithThumbnail[];
          };
          setSearchResults(data.entries);
        }
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query, type]);

  const visible = searchResults ?? localEntries;
  const visibleIds = React.useMemo(() => visible.map((e) => e.id), [visible]);
  const { thumbnails: entryThumbnails, resolved: thumbnailResolved } =
    useEntryThumbnails(visibleIds);

  return (
    <SwipeNav>
      <main className="mx-auto min-h-screen px-5 pb-24 pt-6">
        <TranscriptionWatcher />
        <HomeHeader />

        <JournalHeatmap
          className="mt-6"
          days={heatmap.days}
          pending={heatmap.pending}
          year={heatmap.year}
          maxYear={heatmap.maxYear}
          onYearChange={heatmap.changeYear}
          currentStreak={heatmap.currentStreak}
        />

        {type === "journal" && <InlineRecorder className="mt-4" />}

        <div className="mt-7 flex h-10 items-center justify-between gap-3">
          {searchOpen ? (
            <div className="border-border bg-card motion-safe:animate-fade-in flex h-10 flex-1 items-center gap-2 rounded-full border px-3.5">
              <Search className="text-muted-foreground size-4 shrink-0" />
              <Input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && closeSearch()}
                placeholder={`Search ${heading.toLowerCase()}…`}
                className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              />
              <button
                type="button"
                aria-label="Close search"
                onClick={closeSearch}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="size-4" />
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
                className="text-muted-foreground hover:bg-secondary hover:text-foreground press flex size-10 items-center justify-center rounded-full transition-colors"
              >
                <Search className="size-4.5" />
              </button>
            </>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {searching && (
            <p className="text-muted-foreground text-sm">Searching…</p>
          )}

          {!searching && visible.length === 0 && (
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
