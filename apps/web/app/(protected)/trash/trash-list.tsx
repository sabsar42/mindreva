"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Undo2 } from "lucide-react";
import { NoteCard, toast } from "@mindreva/ui";
import type { EntryListItemWithThumbnail } from "@/lib/services/entries.service";

// Note: trashed entries are intentionally NOT links to /entries/[id] — the
// detail route excludes soft-deleted rows (getByIdForUser returns null once
// deleted_at is set), so a link here would just 404. Restore first, then view.

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

export function TrashList({
  entries: initial,
}: {
  entries: EntryListItemWithThumbnail[];
}) {
  const router = useRouter();
  const [entries, setEntries] = React.useState(initial);

  async function restore(id: string) {
    const res = await fetch(`/api/entries/${id}/restore`, { method: "POST" });
    if (!res.ok) {
      toast.error("Something went wrong.");
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast.success("Restored");
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
        <h1 className="text-xl font-bold tracking-tight">Trash</h1>
      </header>
      <p className="text-muted-foreground mt-1 text-sm">
        Restore a note, or leave it here — nothing is permanently deleted yet.
      </p>

      <div className="mt-6 space-y-3">
        {entries.length === 0 && (
          <div className="border-border rounded-lg border border-dashed py-12 text-center">
            <p className="text-muted-foreground text-sm">Trash is empty.</p>
          </div>
        )}

        {entries.map((entry) => (
          <div key={entry.id} className="relative">
            <NoteCard
              title={entry.title || "Untitled entry"}
              weekdayLabel={formatWeekday(entry.entryDate)}
              dayOfMonth={formatDayOfMonth(entry.entryDate)}
              snippet={entry.snippet ?? undefined}
              thumbnailUrl={entry.thumbnailUrl}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => restore(entry.id)}
              aria-label="Restore"
              className="text-muted-foreground hover:bg-warm-100 hover:text-foreground absolute right-3 top-3 flex size-8 items-center justify-center rounded-full transition-colors"
            >
              <Undo2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
