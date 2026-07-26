"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, Settings, History, Trash2, Archive } from "lucide-react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTitle,
  CalendarPicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  FilterPills,
  Input,
  NoteCard,
  SwipeableRow,
  toast,
  type FilterPillOption,
} from "@mindreva/ui";
import type { EntryType } from "@mindreva/database";
import type { EntryListItemWithThumbnail } from "@/lib/services/entries.service";

type FilterValue = "all" | "today" | "week" | "date";

const FILTER_OPTIONS: FilterPillOption[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "date", label: "Date" },
];

function startOfWeekMonday(d: Date): Date {
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatWeekday(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
}

function formatDayOfMonth(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return String(d.getDate());
}

function formatDuration(ms: number | null): string | undefined {
  if (!ms || ms <= 0) return undefined;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.round(totalSeconds / 60);
  return `${minutes} min`;
}

export function EntryListScreen({
  type,
  heading,
  entries,
  entryDates,
  dayThumbnails,
  newEntryHref,
  showChatLink,
  floatingAction,
}: {
  type: EntryType;
  heading: string;
  entries: EntryListItemWithThumbnail[];
  entryDates: string[];
  /** Signed cover-photo URL per "YYYY-MM-DD", for the calendar day cells. */
  dayThumbnails: Record<string, string>;
  /** Notes gets a "+" compose button; journal doesn't (recording is separate). */
  newEntryHref?: string;
  /** Journal's entry point into "chat with past self". */
  showChatLink?: boolean;
  /** Journal's floating record button. Fixed to the bottom, above the sheet. */
  floatingAction?: React.ReactNode;
}) {
  const router = useRouter();
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

  const filtered = React.useMemo(() => {
    if (filter === "all") return localEntries;
    if (filter === "today") {
      const key = toDateKey(new Date());
      return localEntries.filter((e) => e.entryDate === key);
    }
    if (filter === "week") {
      const monday = startOfWeekMonday(new Date());
      const mondayKey = toDateKey(monday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const sundayKey = toDateKey(sunday);
      return localEntries.filter(
        (e) =>
          e.entryDate && e.entryDate >= mondayKey && e.entryDate <= sundayKey,
      );
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
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            {heading}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{todayLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          {newEntryHref && (
            <Link
              href={newEntryHref}
              aria-label="New note"
              className="bg-primary text-primary-foreground shadow-subtle hover:bg-mint-700 flex size-10 items-center justify-center rounded-full transition-colors"
            >
              <Plus className="size-5" />
            </Link>
          )}
          {showChatLink && (
            <Link
              href="/chat"
              aria-label="Chat with your past self"
              className="text-muted-foreground hover:bg-warm-100 hover:text-foreground flex size-10 items-center justify-center rounded-full transition-colors"
            >
              <History className="size-5" />
            </Link>
          )}
          <Link
            href="/account"
            aria-label="Account"
            className="text-muted-foreground hover:bg-warm-100 hover:text-foreground flex size-10 items-center justify-center rounded-full transition-colors"
          >
            <Settings className="size-5" />
          </Link>
        </div>
      </div>

      <div className="relative mt-4">
        <Search className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${heading.toLowerCase()}…`}
          className="pl-10"
        />
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
          <div className="border-border rounded-lg border border-dashed py-12 text-center">
            <p className="text-muted-foreground text-sm">
              {searchResults
                ? "No matches."
                : filter === "all"
                  ? `Nothing here yet.`
                  : "Nothing for this filter."}
            </p>
          </div>
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
                  className: "bg-orange-100 text-orange-700",
                },
                {
                  key: "trash",
                  label: "Trash",
                  icon: <Trash2 className="size-5" />,
                  onClick: () => setConfirmTrashId(entry.id),
                  className: "bg-red-100 text-red-700",
                },
              ]}
            >
              <Link href={`/entries/${entry.id}`}>
                <NoteCard
                  title={entry.title || "Untitled entry"}
                  weekdayLabel={
                    entry.entryDate ? formatWeekday(entry.entryDate) : ""
                  }
                  dayOfMonth={
                    entry.entryDate ? formatDayOfMonth(entry.entryDate) : ""
                  }
                  durationLabel={formatDuration(entry.durationMs)}
                  snippet={entry.snippet ?? undefined}
                  thumbnailUrl={entry.thumbnailUrl}
                />
              </Link>
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
                setSelectedDate(d);
                if (d) {
                  setFilter("date");
                  setDatePickerOpen(false);
                }
              }}
              entryDates={calendarDates}
              dayThumbnails={dayThumbnails}
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

      {floatingAction && (
        <div className="fixed inset-x-0 bottom-6 flex justify-center">
          {floatingAction}
        </div>
      )}

      <Dialog
        open={confirmTrashId !== null}
        onOpenChange={(open) => !open && setConfirmTrashId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Trash?</DialogTitle>
            <DialogDescription>
              You can restore it from Trash later — nothing is permanently
              deleted yet.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmTrashId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmTrashId) void trashEntry(confirmTrashId);
                setConfirmTrashId(null);
              }}
            >
              Move to Trash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
