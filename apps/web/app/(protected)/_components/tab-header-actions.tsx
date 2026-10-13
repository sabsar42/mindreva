"use client";

import { usePathname } from "next/navigation";
import { cn } from "@mindreva/ui";
import { PrefetchLink } from "./prefetch-link";
import { AccountMenu } from "./account-menu";
import { NAV_ITEMS, isActivePath } from "./nav-items";

/**
 * The top-right cluster on the tab screens: the tab icons (Past Self,
 * Integrations) sitting just left of the account avatar. The same cluster
 * appears on every tab, so the destinations never move.
 */
export function TabHeaderActions() {
  const pathname = usePathname();

  return (
    <div className="flex shrink-0 items-center gap-1 pt-1">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = isActivePath(pathname, href);
        return (
          <PrefetchLink
            key={href}
            href={href}
            aria-label={label}
            title={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "press hover:bg-secondary flex size-10 items-center justify-center rounded-full transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
          </PrefetchLink>
        );
      })}
      <AccountMenu />
    </div>
  );
}
