"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Archive, FileText, LayoutGrid, Calendar } from "lucide-react";
import { trashSwipeAction } from "./swipe-actions";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
  FilterPills,
  Input,
  JournalHeatmap,
  LeafMark,
  NoteCard,
  SwipeableRow,
  toast,
  type HeatmapDay,
  type HeatmapEntrySummary,
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
}: {
  type: EntryType;
  heading: string;
  entries: EntryListItemWithThumbnail[];
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

  // --- Activity heatmap state (replaces the old CalendarPicker in this sheet) ---
  const [heatmapMonth, setHeatmapMonth] = React.useState(() => new Date());
  const [heatmapYear, setHeatmapYear] = React.useState(() =>
    new Date().getFullYear(),
  );
  const [heatmapExpanded, setHeatmapExpanded] = React.useState(false);
  const [monthDays, setMonthDays] = React.useState<Record<string, HeatmapDay>>(
    {},
  );
  const [yearDays, setYearDays] = React.useState<Record<
    string,
    HeatmapDay
  > | null>(null);
  const [yearStats, setYearStats] = React.useState<{
    totalDaysJournaled: number;
    totalEntries: number;
    currentStreak: number;
  } | null>(null);
  const [loadingYear, setLoadingYear] = React.useState(false);
  const [heatmapSelectedDate, setHeatmapSelectedDate] = React.useState<
    string | null
  >(null);
  const [selectedDayEntries, setSelectedDayEntries] = React.useState<
    HeatmapEntrySummary[] | null
  >(null);
  const [loadingSelectedDay, setLoadingSelectedDay] = React.useState(false);

  function monthParam(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  // Fetch the visible month's counts whenever the sheet is open and the
  // compact view is showing — lazy, same reasoning as the old day-thumbnails
  // fetch: most page visits never open this sheet at all.
  React.useEffect(() => {
    if (!datePickerOpen || heatmapExpanded) return;
    let cancelled = false;
    void fetch(
      `/api/entries/heatmap?type=${type}&month=${monthParam(heatmapMonth)}`,
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { days: Record<string, HeatmapDay> } | null) => {
        if (!cancelled && data) setMonthDays(data.days);
      })
      .catch(() => {
        // Non-fatal — the grid just shows as empty until the next successful fetch.
      });
    return () => {
      cancelled = true;
    };
  }, [datePickerOpen, heatmapExpanded, type, heatmapMonth]);

  // Fetch the whole year's counts once the full-year view opens.
  React.useEffect(() => {
    if (!datePickerOpen || !heatmapExpanded) return;
    let cancelled = false;
    setLoadingYear(true);
    void fetch(`/api/entries/heatmap?type=${type}&year=${heatmapYear}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            days: Record<string, HeatmapDay>;
            totalDaysJournaled: number;
            totalEntries: number;
            currentStreak: number;
          } | null,
        ) => {
          if (cancelled || !data) return;
          setYearDays(data.days);
          setYearStats({
            totalDaysJournaled: data.totalDaysJournaled,
            totalEntries: data.totalEntries,
            currentStreak: data.currentStreak,
          });
        },
      )
      .catch(() => {
        // Non-fatal — the year grid just stays empty until the next successful fetch.
      })
      .finally(() => {
        if (!cancelled) setLoadingYear(false);
      });
    return () => {
      cancelled = true;
    };
  }, [datePickerOpen, heatmapExpanded, type, heatmapYear]);

  // Fetch the selected day's entries for the inline detail panel.
  React.useEffect(() => {
    if (!heatmapSelectedDate) {
      setSelectedDayEntries(null);
      return;
    }
    let cancelled = false;
    setLoadingSelectedDay(true);
    void fetch(`/api/entries/heatmap?type=${type}&date=${heatmapSelectedDate}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { entries: EntryListItemWithThumbnail[] } | null) => {
        if (cancelled) return;
        setSelectedDayEntries(
          (data?.entries ?? []).map((e) => ({
            id: e.id,
            title: e.title,
            snippet: e.snippet,
            timeLabel: e.createdAt
              ? new Date(e.createdAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : null,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setSelectedDayEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSelectedDay(false);
      });
    return () => {
      cancelled = true;
    };
  }, [heatmapSelectedDate, type]);

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

        <BottomSheet
          open={datePickerOpen}
          onOpenChange={(open) => {
            setDatePickerOpen(open);
            if (!open) {
              // Collapse back to the compact month view and clear the
              // inline detail each time the sheet is reopened fresh.
              setHeatmapExpanded(false);
              setHeatmapSelectedDate(null);
            }
          }}
        >
          <BottomSheetContent>
            <BottomSheetTitle>Your activity</BottomSheetTitle>
            <BottomSheetDescription className="sr-only">
              A calendar of how often you&apos;ve journaled. Select a day to see
              what you wrote, or expand to see the whole year.
            </BottomSheetDescription>
            <div className="mt-3">
              <JournalHeatmap
                monthDays={monthDays}
                yearDays={yearDays}
                yearStats={yearStats}
                loadingYear={loadingYear}
                month={heatmapMonth}
                onMonthChange={(m) => {
                  setHeatmapMonth(m);
                  setHeatmapSelectedDate(null);
                }}
                year={heatmapYear}
                onYearChange={(y) => {
                  setHeatmapYear(y);
                  setHeatmapSelectedDate(null);
                }}
                expanded={heatmapExpanded}
                onExpandedChange={setHeatmapExpanded}
                selectedDate={heatmapSelectedDate}
                onSelectDay={(date) => {
                  setHeatmapSelectedDate((prev) =>
                    prev === date ? null : date,
                  );
                  const [y, m, d] = date.split("-").map(Number);
                  setSelectedDate(new Date(y!, (m ?? 1) - 1, d ?? 1));
                  setFilter("date");
                }}
                selectedDayEntries={selectedDayEntries}
                loadingSelectedDay={loadingSelectedDay}
                onOpenEntry={(id) => {
                  setDatePickerOpen(false);
                  router.push(`/entries/${id}`);
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
