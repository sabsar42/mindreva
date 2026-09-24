"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { NoteCard, SwipeableRow, toast } from "@mindreva/ui";
import type { EntryListItemWithThumbnail } from "@/lib/services/entries.service";
import { formatEntryDateTime } from "@/lib/format-entry";
import { useEntryThumbnails } from "../_components/use-entry-thumbnails";
import { PageHeader } from "../_components/page-header";
import { EmptyState } from "../_components/empty-state";

// Note: trashed entries are intentionally NOT links to /entries/[id] — the
// detail route excludes soft-deleted rows (getByIdForUser returns null once
// deleted_at is set), so a link here would just 404. Restore first, then view.

export function TrashList({
  entries: initial,
}: {
  entries: EntryListItemWithThumbnail[];
}) {
  const router = useRouter();
  const [entries, setEntries] = React.useState(initial);
  const entryIds = React.useMemo(() => entries.map((e) => e.id), [entries]);
  const thumbnails = useEntryThumbnails(entryIds);

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
    <main className="mx-auto min-h-screen px-5 py-6 md:max-w-2xl">
      <PageHeader back="/account" title="Trash" />
      <p className="text-muted-foreground mt-1 text-sm">
        Restore a note, or leave it here. Nothing is permanently deleted yet.
      </p>

      <div className="mt-6 space-y-4">
        {entries.length === 0 && <EmptyState message="Trash is empty." />}

        {entries.map((entry) => (
          <SwipeableRow
            key={entry.id}
            actions={[
              {
                key: "restore",
                label: "Restore",
                icon: <Undo2 className="size-5" />,
                onClick: () => void restore(entry.id),
                className: "bg-secondary text-secondary-foreground",
              },
            ]}
          >
            <NoteCard
              title={entry.title || "Untitled entry"}
              dateLabel={formatEntryDateTime(entry.createdAt)}
              snippet={entry.snippet ?? undefined}
              thumbnailUrl={thumbnails[entry.id] ?? entry.thumbnailUrl}
            />
          </SwipeableRow>
        ))}
      </div>
    </main>
  );
}
