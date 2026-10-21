"use client";

import * as React from "react";
import { Undo2 } from "lucide-react";
import { NoteCard, SwipeableRow } from "@mindreva/ui";
import { useOptimisticRemove } from "../_components/use-optimistic-remove";
import type { EntryListItemWithThumbnail } from "@/lib/services/entries.service";
import { DATE_PLACEHOLDER, formatEntryDateTime } from "@/lib/format-entry";
import { useHydrated } from "@/lib/use-hydrated";
import { useEntryThumbnails } from "../_components/use-entry-thumbnails";
import { PageHeader } from "../_components/page-header";
import { EmptyState } from "../_components/empty-state";
import { getDefaultArtwork } from "@/lib/default-artwork";

// Note: trashed entries are intentionally NOT links to /entries/[id] — the
// detail route excludes soft-deleted rows (getByIdForUser returns null once
// deleted_at is set), so a link here would just 404. Restore first, then view.

export function TrashList({
  entries: initial,
}: {
  entries: EntryListItemWithThumbnail[];
}) {
  const [entries, setEntries] = React.useState(initial);
  const remove = useOptimisticRemove(entries, setEntries);
  const entryIds = React.useMemo(() => entries.map((e) => e.id), [entries]);
  const { thumbnails, resolved } = useEntryThumbnails(entryIds);
  const hydrated = useHydrated();

  function restore(id: string) {
    return remove(
      id,
      { url: `/api/entries/${id}/restore`, method: "POST" },
      {
        done: "Restored",
        failed: "Couldn't restore that entry. It's still in Trash; try again.",
      },
    );
  }

  return (
    <main className="min-h-app mx-auto px-5 pb-24 pt-6">
      <PageHeader back="/account" title="Trash" />
      <p className="text-muted-foreground mt-1 text-sm">
        Restore a note, or leave it here. Nothing is permanently deleted yet.
      </p>

      <div className="mt-6 space-y-2">
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
              dateLabel={
                hydrated
                  ? formatEntryDateTime(entry.createdAt)
                  : DATE_PLACEHOLDER
              }
              snippet={entry.snippet ?? undefined}
              thumbnailPending={!resolved(entry.id)}
              thumbnailUrl={
                thumbnails[entry.id] ??
                entry.thumbnailUrl ??
                getDefaultArtwork(entry.id)
              }
            />
          </SwipeableRow>
        ))}
      </div>
    </main>
  );
}
