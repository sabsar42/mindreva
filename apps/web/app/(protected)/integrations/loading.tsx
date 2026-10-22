// Direct subpath, not the @mindreva/ui barrel — see docs/CHANGELOG.md's
// 2026-07-27 entry on the barrel export that bundled Lexical into every page.
import { Skeleton } from "@mindreva/ui/skeleton";

export default function IntegrationsLoading() {
  return (
    <main className="min-h-app mx-auto px-4 pb-24 pt-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-7 w-40" />
      </div>
      <Skeleton className="mt-4 h-4 w-3/4" />
      <Skeleton className="mt-7 h-3 w-20" />
      <Skeleton className="mt-3 h-48 w-full rounded-2xl" />
    </main>
  );
}
