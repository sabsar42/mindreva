"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Plus, Settings } from "lucide-react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTitle,
  CalendarPicker,
  FilterPills,
  Input,
  NoteCard,
  type FilterPillOption,
} from "@mindreva/ui";
import type { EntryListItem, EntryType } from "@mindreva/database";

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

function formatDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
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
  newEntryHref,
  floatingAction,
}: {
  type: EntryType;
  heading: string;
  entries: EntryListItem[];
  entryDates: string[];
  /** Notes gets a "+" compose button; journal doesn't (recording is separate). */
  newEntryHref?: string;
  /** Journal's floating record button. Fixed to the bottom, above the sheet. */
  floatingAction?: React.ReactNode;
}) {
  const [filter, setFilter] = React.useState<FilterValue>("all");
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
  const [datePickerOpen, setDatePickerOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<
    EntryListItem[] | null
  >(null);
  const [searching, setSearching] = React.useState(false);

  const calendarDates = React.useMemo(
    () => entryDates.map((d) => new Date(`${d}T00:00:00`)),
    [entryDates],
  );

  const filtered = React.useMemo(() => {
    if (filter === "all") return entries;
    if (filter === "today") {
      const key = toDateKey(new Date());
      return entries.filter((e) => e.entryDate === key);
    }
    if (filter === "week") {
      const monday = startOfWeekMonday(new Date());
      const mondayKey = toDateKey(monday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const sundayKey = toDateKey(sunday);
      return entries.filter(
        (e) =>
          e.entryDate && e.entryDate >= mondayKey && e.entryDate <= sundayKey,
      );
    }
    if (filter === "date" && selectedDate) {
      const key = toDateKey(selectedDate);
      return entries.filter((e) => e.entryDate === key);
    }
    return entries;
  }, [entries, filter, selectedDate]);

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
          const data = (await res.json()) as { entries: EntryListItem[] };
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

      <div className="mt-6 space-y-3">
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
            <Link key={entry.id} href={`/entries/${entry.id}`}>
              <NoteCard
                title={entry.title || "Untitled entry"}
                dateLabel={
                  entry.entryDate ? formatDayLabel(entry.entryDate) : ""
                }
                durationLabel={formatDuration(entry.durationMs)}
                snippet={entry.snippet ?? undefined}
              />
            </Link>
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
    </main>
  );
}
