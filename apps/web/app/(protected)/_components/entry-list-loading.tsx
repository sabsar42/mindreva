import { Skeleton } from "@mindreva/ui/skeleton";

/**
 * Instant-navigation skeletons. Each mirrors its real screen box for box
 * (same paddings, heights, radii and gaps), so when the data arrives the
 * content replaces the placeholders without anything moving.
 */

/** A list card: exactly NoteCard's 108px box with its 80px cover. */
function CardSkeleton() {
  return (
    <div className="border-border bg-card flex h-[108px] items-center gap-3 rounded-2xl border p-3.5">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="size-20 shrink-0 rounded-xl" />
    </div>
  );
}

/** The Journal: header, week strip, record bar, then the list. */
export function JournalLoading() {
  return (
    <main
      aria-busy
      aria-label="Loading your journal"
      className="h-app mx-auto flex flex-col overflow-hidden px-4 pt-6"
    >
      <div className="shrink-0">
        <div className="flex items-center gap-3">
          <Skeleton className="size-15 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-1.5 h-4 w-32" />
          </div>
          <div className="flex items-center gap-1 pt-0">
            <Skeleton className="size-11 rounded-full" />
            <Skeleton className="size-11 rounded-full" />
            <Skeleton className="ml-2.5 size-10 rounded-full" />
          </div>
        </div>
        <Skeleton className="mt-2 h-[2.38rem] w-44" />
        <Skeleton className="mt-[18px] h-20 rounded-[18px]" />
        <Skeleton className="h-19 mt-4 rounded-full" />
        <div className="mt-3.5 flex h-10 items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="size-10 rounded-full" />
        </div>
      </div>
      <div className="mt-2 space-y-2 pt-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}

/** Archive and Trash: a back header and the list. */
export function EntryListLoading() {
  return (
    <main
      aria-busy
      aria-label="Loading"
      className="min-h-app mx-auto px-4 pb-24 pt-6"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="-ml-3 size-10 rounded-full" />
        <Skeleton className="h-6 w-28" />
      </div>
      <div className="mt-6 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}
