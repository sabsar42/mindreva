"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { SideNav } from "./side-nav";
import { BottomNav } from "./bottom-nav";
import { prefetchFull } from "./use-full-prefetch";

// Flows with their own exit (Cancel/Back/Save). Nav is hidden here because
// leaving /record through it would unmount the recorder and discard the audio.
const FOCUSED_ROUTES = [
  /^\/record(\/|$)/,
  /^\/entries\/[^/]+\/review(\/|$)/,
  /^\/chat\/[^/]+/,
];

// Tabs fully prefetched as soon as a tab screen is showing, so tapping one
// renders from the Router Cache instead of waiting ~450ms on the server
// (measured on the live deploy, see docs/CHANGELOG.md 2026-10-12). Hover/
// touchstart prefetch alone gives a phone only ~100ms of head start.
//
// /journal is deliberately left out: record, trash-from-detail and transcript
// review all router.push("/journal") right after a mutation, and a 5-minute
// full prefetch there would show the list without that change. Those tabs'
// mutations already invalidate the cache (account's server actions call
// revalidatePath; chat-home refreshes after a new session).
const PREFETCHED_TABS = ["/chat", "/mindmap", "/account"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const focused = FOCUSED_ROUTES.some((r) => r.test(pathname));

  // Re-runs on every tab change, and after every router.refresh(): a refresh
  // replaces the whole prefetch cache once its fetch resolves (including
  // prefetches made while it was in flight), and it's also the only thing
  // that gives `children` a new identity without a pathname change. Next
  // skips tabs whose prefetch is still fresh, so a re-run with nothing stale
  // costs no requests.
  React.useEffect(() => {
    if (focused) return;
    for (const href of PREFETCHED_TABS) {
      if (pathname !== href) prefetchFull(router, href);
    }
  }, [focused, pathname, router, children]);

  if (focused) return <>{children}</>;

  return (
    <>
      <SideNav />
      <div className="md:ml-14 lg:ml-56">{children}</div>
      <BottomNav />
    </>
  );
}
