"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArchiveRestore } from "lucide-react";
import { NoteCard, toast } from "@mindreva/ui";
import type { EntryListItemWithThumbnail } from "@/lib/services/entries.service";

function formatWeekday(dateKey: string | null): string {
  if (!dateKey) return "";
  return new Date(`${dateKey}T00:00:00`)
    .toLocaleDateString(undefined, { weekday: "short" })
    .toUpperCase();
}

function formatDayOfMonth(dateKey: string | null): string {
  if (!dateKey) return "";
  return String(new Date(`${dateKey}T00:00:00`).getDate());
}

export function ArchiveList({
  entries: initial,
}: {
  entries: EntryListItemWithThumbnail[];
}) {
  const router = useRouter();
  const [entries, setEntries] = React.useState(initial);

  async function unarchive(id: string) {
    const res = await fetch(`/api/entries/${id}/archive`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Something went wrong.");
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast.success("Unarchived");
    router.refresh();
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-6">
      <header className="flex items-center gap-3">
        <Link
          href="/account"
          aria-label="Back"
          className="text-foreground hover:bg-warm-100 -ml-2 rounded-full p-2 transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight">Archived</h1>
      </header>

      <div className="mt-6 space-y-4">
        {entries.length === 0 && (
          <div className="border-border rounded-lg border border-dashed py-12 text-center">
            <p className="text-muted-foreground text-sm">
              Nothing archived yet.
            </p>
          </div>
        )}

        {entries.map((entry) => (
          <div key={entry.id} className="relative">
            <Link href={`/entries/${entry.id}`}>
              <NoteCard
                title={entry.title || "Untitled entry"}
                weekdayLabel={formatWeekday(entry.entryDate)}
                dayOfMonth={formatDayOfMonth(entry.entryDate)}
                snippet={entry.snippet ?? undefined}
                thumbnailUrl={entry.thumbnailUrl}
                className="pr-12"
              />
            </Link>
            <button
              type="button"
              onClick={() => unarchive(entry.id)}
              aria-label="Unarchive"
              className="text-muted-foreground hover:bg-warm-100 hover:text-foreground bg-card shadow-subtle absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
            >
              <ArchiveRestore className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
