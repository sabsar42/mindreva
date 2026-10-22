import { Skeleton } from "@mindreva/ui/skeleton";

/**
 * Shown instantly on navigation while the entry detail page's server
 * component awaits its data (auth revalidation + several DB/Storage round
 * trips) — without this, Next.js renders nothing until that finishes,
 * which reads as "tapping a card doesn't do anything."
 */
export default function EntryDetailLoading() {
  return (
    <main className="min-h-app mx-auto px-4 pb-24 pt-6">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="size-9 rounded-full" />
        <div className="flex items-center gap-1">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="size-9 rounded-full" />
        </div>
      </div>

      <Skeleton className="mt-4 h-4 w-32" />
      <Skeleton className="mt-2 h-7 w-3/4" />

      <Skeleton className="mt-5 h-40 w-full" />

      <Skeleton className="mt-5 h-32 w-full" />
    </main>
  );
}
