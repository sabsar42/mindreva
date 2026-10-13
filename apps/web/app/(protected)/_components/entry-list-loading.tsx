import { Skeleton } from "@mindreva/ui/skeleton";

/**
 * Shared instant-navigation skeleton for the journal/notes/archive/trash
 * list screens — each route's loading.tsx renders this while its server
 * component awaits auth + DB + Storage round trips.
 */
export function EntryListLoading() {
  return (
    <main className="mx-auto min-h-screen px-5 pb-24 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-40" />
        </div>
        <Skeleton className="size-10 rounded-full" />
      </div>

      <Skeleton className="mt-4 h-11 w-full" />

      <div className="mt-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </main>
  );
}
