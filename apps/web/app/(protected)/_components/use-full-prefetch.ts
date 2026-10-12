"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

/**
 * Returns an onMouseEnter/onTouchStart handler that prefetches a route's
 * FULL data (not just its static shell) ahead of an actual tap.
 *
 * next/link's own automatic prefetch (triggered when a link scrolls into
 * view) uses PrefetchKind.AUTO for dynamic routes — anything that reads
 * cookies/session per request, which includes /entries/[id]. AUTO
 * deliberately only warms the static shell for dynamic routes, not the
 * real data, to avoid firing a full data fetch (and a real DB query) for
 * every row merely visible on screen, which would be wasteful for a long
 * list. FULL fetches everything the route needs to render, so calling this
 * on hover/touch-start — a much stronger signal of actual intent than mere
 * visibility — is what makes the tap itself feel instant instead of
 * waiting for the fetch to start only once the tap happens.
 *
 * On mobile, touchstart fires ~100-300ms before the tap it's part of is
 * fully registered, which is enough of a head start for a request to a
 * geographically close pooler/edge to complete before the navigation
 * commits — on a Seoul-hosted Supabase project reached from elsewhere,
 * every hop this fires ahead of the tap is time genuinely saved, not just
 * shuffled around.
 */
export function usePrefetchOnIntent(href: string) {
  const router = useRouter();
  const firedRef = React.useRef(false);

  return React.useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    prefetchFull(router, href);
  }, [router, href]);
}

/**
 * router.prefetch with PrefetchKind.FULL. A full prefetch is cached under
 * staleTimes.static (Next's default: 5 minutes), not staleTimes.dynamic, so
 * a later tap renders from memory with no server round trip.
 */
export function prefetchFull(
  router: ReturnType<typeof useRouter>,
  href: string,
): void {
  // "full" is PrefetchKind.FULL's own runtime value, but that enum isn't
  // exported from the public next/navigation types (it's internal), so
  // TypeScript can't see the literal and the enum as the same type without
  // a cast — a real Next.js gap, not a workaround for anything shaky.
  router.prefetch(href, { kind: "full" } as Parameters<
    typeof router.prefetch
  >[1]);
}
