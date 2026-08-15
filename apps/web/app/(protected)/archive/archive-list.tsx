"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArchiveRestore, Trash2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  NoteCard,
  SwipeableRow,
  toast,
} from "@mindreva/ui";
import type { EntryListItemWithThumbnail } from "@/lib/services/entries.service";
import { useEntryThumbnails } from "../_components/use-entry-thumbnails";

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
  const [confirmTrashId, setConfirmTrashId] = React.useState<string | null>(
    null,
  );
  const entryIds = React.useMemo(() => entries.map((e) => e.id), [entries]);
  const thumbnails = useEntryThumbnails(entryIds);

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

  async function trash(id: string) {
    const res = await fetch(`/api/entries/${id}/trash`, { method: "POST" });
    if (!res.ok) {
      toast.error("Something went wrong.");
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast.success("Moved to Trash");
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
          <SwipeableRow
            key={entry.id}
            actions={[
              {
                key: "unarchive",
                label: "Unarchive",
                icon: <ArchiveRestore className="size-5" />,
                onClick: () => void unarchive(entry.id),
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
                weekdayLabel={formatWeekday(entry.entryDate)}
                dayOfMonth={formatDayOfMonth(entry.entryDate)}
                snippet={entry.snippet ?? undefined}
                thumbnailUrl={thumbnails[entry.id] ?? entry.thumbnailUrl}
              />
            </Link>
          </SwipeableRow>
        ))}
      </div>

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
                if (confirmTrashId) void trash(confirmTrashId);
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
