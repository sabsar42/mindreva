"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore } from "lucide-react";
import { trashSwipeAction } from "../_components/swipe-actions";
import { NoteCard, SwipeableRow, toast } from "@mindreva/ui";
import type { EntryListItemWithThumbnail } from "@/lib/services/entries.service";
import { DATE_PLACEHOLDER, formatEntryDateTime } from "@/lib/format-entry";
import { useHydrated } from "@/lib/use-hydrated";
import { useEntryThumbnails } from "../_components/use-entry-thumbnails";
import { PrefetchLink } from "../_components/prefetch-link";
import { PageHeader } from "../_components/page-header";
import { ConfirmTrashDialog } from "../_components/confirm-trash-dialog";
import { EmptyState } from "../_components/empty-state";
import { getDefaultArtwork } from "@/lib/default-artwork";

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
  const { thumbnails, resolved } = useEntryThumbnails(entryIds);
  const hydrated = useHydrated();

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
    <main className="mx-auto min-h-screen px-5 pb-24 pt-6">
      <PageHeader back="/account" title="Archived" />

      <div className="mt-6 space-y-4">
        {entries.length === 0 && <EmptyState message="Nothing archived yet." />}

        {entries.map((entry) => (
          <SwipeableRow
            key={entry.id}
            actions={[
              {
                key: "unarchive",
                label: "Unarchive",
                icon: <ArchiveRestore className="size-5" />,
                onClick: () => void unarchive(entry.id),
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
                snippet={entry.snippet ?? undefined}
                thumbnailPending={!resolved(entry.id)}
                thumbnailUrl={
                  thumbnails[entry.id] ??
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
          if (confirmTrashId) void trash(confirmTrashId);
        }}
      />
    </main>
  );
}
