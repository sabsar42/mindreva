// Imported via the direct subpath, not the @mindreva/ui barrel — see
// docs/CHANGELOG.md's 2026-07-27 entry on the barrel export that bundled
// Lexical into every page.
import { Skeleton } from "@mindreva/ui/skeleton";

export default function ChatLoading() {
  return (
    <main className="mx-auto min-h-screen px-5 pb-24 pt-6 md:max-w-2xl md:pb-10">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-3/4" />

      <Skeleton className="mt-7 h-3 w-28" />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-4 h-12 w-full rounded-full" />
    </main>
  );
}
