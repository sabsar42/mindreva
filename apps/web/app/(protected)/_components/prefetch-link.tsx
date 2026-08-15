"use client";

import Link from "next/link";
import * as React from "react";
import { usePrefetchOnIntent } from "./use-full-prefetch";

/**
 * A next/link that also prefetches the destination's FULL data (not just
 * its static shell) on hover/touch-start, not only on-visible. See
 * use-full-prefetch.ts for why AUTO (next/link's own default prefetch for
 * dynamic routes) isn't enough on its own — this is what makes the actual
 * tap into a list row feel instant instead of waiting for the fetch to
 * start only once the tap happens.
 */
function PrefetchLink({
  href,
  children,
  ...rest
}: React.ComponentProps<typeof Link>) {
  const hrefString = typeof href === "string" ? href : href.toString();
  const onIntent = usePrefetchOnIntent(hrefString);

  return (
    <Link href={href} onMouseEnter={onIntent} onTouchStart={onIntent} {...rest}>
      {children}
    </Link>
  );
}

export { PrefetchLink };
