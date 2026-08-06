// Imported via the direct subpath, not the @mindreva/ui barrel — see
// docs/CHANGELOG.md's 2026-07-27 entry on the barrel export that bundled
// Lexical into every page.
import { Skeleton } from "@mindreva/ui/skeleton";

export default function MindmapLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-12 pt-6">
      <Skeleton className="size-9 rounded-full" />
      <Skeleton className="mt-4 h-9 w-52" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-3/4" />
      <Skeleton className="mt-8 h-64 w-full rounded-lg" />
    </main>
  );
}
