// Imported via the direct subpath, not the @mindreva/ui barrel — see
// docs/CHANGELOG.md's 2026-07-27 entry on the barrel export that bundled
// Lexical into every page.
import { Skeleton } from "@mindreva/ui/skeleton";

export default function AccountLoading() {
  return (
    <main className="min-h-app mx-auto px-5 pb-24 pt-6">
      <Skeleton className="mb-6 h-7 w-28" />
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </main>
  );
}
