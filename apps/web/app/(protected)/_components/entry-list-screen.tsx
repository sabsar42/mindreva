"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Search, Archive, FileText, LayoutGrid, Calendar } from "lucide-react";
import { trashSwipeAction } from "./swipe-actions";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTitle,
  FilterPills,
  Input,
  LeafMark,
  NoteCard,
  SwipeableRow,
  toast,
  type FilterPillOption,
} from "@mindreva/ui";
import {
  DATE_PLACEHOLDER,
  formatEntryDateTime,
  formatDuration,
} from "@/lib/format-entry";
import { useHydrated } from "@/lib/use-hydrated";
import { ConfirmTrashDialog } from "./confirm-trash-dialog";
import { EmptyState } from "./empty-state";
import { HomeHeader } from "./home-header";
import { SwipeNav } from "./swipe-nav";
import type { EntryType } from "@mindreva/database";
import type { EntryListItemWithThumbnail } from "@/lib/services/entries.service";
import { TranscriptionWatcher } from "./transcription-watcher";
import { useEntryThumbnails } from "./use-entry-thumbnails";
import { PrefetchLink } from "./prefetch-link";
import { getDefaultArtwork } from "@/lib/default-artwork";

// CalendarPicker pulls in react-day-picker (~164kB, confirmed by measuring
// the real deployed /journal bundle) for a component that sits inside a
// BottomSheet closed by default — most page visits never open it. Deferred
// to its own chunk, fetched only once the sheet is actually opened, the same
// isolation pattern used for @mindreva/ui/rich-text-editor.
const CalendarPicker = dynamic(
  () => import("@mindreva/ui/calendar-picker").then((m) => m.CalendarPicker),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted h-72 w-full animate-pulse rounded-xl" />
    ),
  },
);

type FilterValue = "all" | "today" | "date";

const FILTER_OPTIONS: FilterPillOption[] = [
  { value: "all", label: "All", icon: <LayoutGrid className="size-3.5" /> },
  { value: "today", label: "Today", icon: <Calendar className="size-3.5" /> },
  { value: "date", label: "Date", icon: <Calendar className="size-3.5" /> },
];

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function EntryListScreen({
  type,
  heading,
  entries,
  entryDates,
}: {
  type: EntryType;
  heading: string;
  entries: EntryListItemWithThumbnail[];
  entryDates: string[];
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [localEntries, setLocalEntries] = React.useState(entries);
  const [filter, setFilter] = React.useState<FilterValue>("all");
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<
    EntryListItemWithThumbnail[] | null
  >(null);
  const [searching, setSearching] = React.useState(false);
  const [confirmTrashId, setConfirmTrashId] = React.useState<string | null>(
    null,
  );
  // Fetched lazily, only once the date-picker sheet is actually opened for
  // the first time — the calendar's day-cell cover photos are a real
  // Supabase Storage round trip, and the sheet is closed by default, so
  // there's no reason to pay that cost on every list-screen navigation.
  const [dayThumbnails, setDayThumbnails] = React.useState<
    Record<string, string>
  >({});
  const dayThumbnailsLoadedRef = React.useRef(false);

  React.useEffect(() => {
    if (!datePickerOpen || dayThumbnailsLoadedRef.current) return;
    dayThumbnailsLoadedRef.current = true;
    void fetch(`/api/entries/day-thumbnails?type=${type}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { dayThumbnails: Record<string, string> } | null) => {
        if (data) setDayThumbnails(data.dayThumbnails);
      })
      .catch(() => {
        // Non-fatal — the calendar just falls back to plain dot indicators.
      });
  }, [datePickerOpen, type]);

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

  const calendarDates = React.useMemo(
    () => entryDates.map((d) => new Date(`${d}T00:00:00`)),
    [entryDates],
  );

  // Build a date→entryId map from the first entry per date so the calendar
  // cell and the NoteCard for that date use the same deterministic artwork.
  const firstEntryIdByDate = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of localEntries) {
      if (e.entryDate && !map[e.entryDate]) map[e.entryDate] = e.id;
    }
    return map;
  }, [localEntries]);

  // Merge real cover photos with default artworks so every date that has an
  // entry shows something. Real photos win (spread last).
  const mergedDayThumbnails = React.useMemo(() => {
    const defaults: Record<string, string> = {};
    for (const dateStr of entryDates) {
      const seed = firstEntryIdByDate[dateStr] ?? dateStr;
      defaults[dateStr] = getDefaultArtwork(seed);
    }
    return { ...defaults, ...dayThumbnails };
  }, [entryDates, firstEntryIdByDate, dayThumbnails]);

  const filtered = React.useMemo(() => {
    if (filter === "all") return localEntries;
    if (filter === "today") {
      const key = toDateKey(new Date());
      return localEntries.filter((e) => e.entryDate === key);
    }
    if (filter === "date" && selectedDate) {
      const key = toDateKey(selectedDate);
      return localEntries.filter((e) => e.entryDate === key);
    }
    return localEntries;
  }, [localEntries, filter, selectedDate]);

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

  function onFilterChange(value: string) {
    const v = value as FilterValue;
    if (v === "date") {
      setDatePickerOpen(true);
      return;
    }
    setFilter(v);
  }

  const visible = searchResults ?? filtered;
  const visibleIds = React.useMemo(() => visible.map((e) => e.id), [visible]);
  const entryThumbnails = useEntryThumbnails(visibleIds);

  return (
    <SwipeNav>
      <main className="mx-auto min-h-screen px-5 pb-24 pt-6">
        <TranscriptionWatcher />
        <HomeHeader />

        {type === "journal" && (
          <PrefetchLink
            href="/record"
            aria-label="Start recording"
            className="group mt-6 block focus-visible:outline-none"
          >
            <div className="bg-card border-border shadow-elevated group-focus-visible:ring-ring press rounded-[2rem] border p-7 text-center group-focus-visible:ring-2">
              {/* Breathing halo behind the leaf; the button itself stays still
                  so it reads as solid, with a press-down on tap. */}
              <div className="relative mx-auto mb-5 flex size-36 items-center justify-center">
                <div className="bg-halo animate-halo absolute inset-0 rounded-full" />
                <div className="bg-halo absolute inset-5 rounded-full opacity-70" />
                <div className="bg-gradient-primary shadow-elevated relative flex size-20 items-center justify-center rounded-full transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105">
                  <LeafMark className="text-primary-foreground size-10" />
                </div>
              </div>
              <h2 className="text-foreground text-xl font-bold tracking-tight">
                Start recording
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Record audio and get a clear, structured note.
              </p>
            </div>
          </PrefetchLink>
        )}

        <div className="mt-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${heading.toLowerCase()}…`}
              className="pl-10"
            />
          </div>
        </div>

        <div className="mt-4">
          <FilterPills
            options={FILTER_OPTIONS}
            value={searchResults ? "" : filter}
            onValueChange={onFilterChange}
          />
        </div>

        <div className="mt-6 space-y-2">
          {searching && (
            <p className="text-muted-foreground text-sm">Searching…</p>
          )}

          {!searching && visible.length === 0 && (
            <EmptyState
              icon={searchResults ? <Search /> : <FileText />}
              title={
                searchResults
                  ? "No matches"
                  : filter === "all"
                    ? `No ${heading.toLowerCase()} entries yet`
                    : "Nothing for this filter"
              }
              message={
                searchResults
                  ? "Try a different word or phrase."
                  : filter === "all"
                    ? "Tap record to capture your first entry."
                    : "Try another date range, or clear the filter."
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

        <BottomSheet open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <BottomSheetContent>
            <BottomSheetTitle>Pick a date</BottomSheetTitle>
            <div className="mt-3">
              <CalendarPicker
                selected={selectedDate}
                onSelect={(d) => {
                  if (!d) return;
                  setSelectedDate(d);
                  setFilter("date");
                  setDatePickerOpen(false);
                }}
                entryDates={calendarDates}
                dayThumbnails={mergedDayThumbnails}
                onClear={() => {
                  setSelectedDate(undefined);
                  setFilter("all");
                  setDatePickerOpen(false);
                }}
                onToday={() => {
                  setSelectedDate(new Date());
                  setFilter("date");
                  setDatePickerOpen(false);
                }}
              />
            </div>
          </BottomSheetContent>
        </BottomSheet>

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
