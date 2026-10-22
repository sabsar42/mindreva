"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { prefetchFull } from "./use-full-prefetch";
import { AccountProvider, type AccountSummary } from "./account-context";
import { isTabRoute } from "./nav-items";
import { TabBar } from "./tab-bar";

// Flows with their own exit (Cancel/Back/Save). They don't prefetch the tabs,
// so the work they're doing isn't competing with background requests.
const FOCUSED_ROUTES = [/^\/chat\/[^/]+/];

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
const PREFETCHED_TABS = ["/chat", "/account"];

export function AppShell({
  account,
  children,
}: {
  account: Promise<AccountSummary | null>;
  children: React.ReactNode;
}) {
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

  // The bottom tab bar shows on the three section screens only; pushed screens
  // (an entry, a conversation, Archive…) have a back button instead. Tab
  // screens reserve room for it so the last row is never hidden beneath it.
  const tabs = isTabRoute(pathname);
  return (
    <AccountProvider account={account}>
      <div className={tabs ? "pb-[calc(49px+var(--safe-bottom))]" : undefined}>
        {children}
      </div>
      {tabs && <TabBar />}
    </AccountProvider>
  );
}
