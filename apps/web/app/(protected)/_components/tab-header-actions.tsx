"use client";

import { usePathname } from "next/navigation";
import { buttonVariants, cn } from "@mindreva/ui";
import { PrefetchLink } from "./prefetch-link";
import { AccountMenu } from "./account-menu";
import { NAV_ITEMS, isActivePath } from "./nav-items";

/**
 * The top-right cluster on the tab screens: the tab icons (Past Self,
 * Integrations) sitting just left of the account avatar. The same cluster
 * appears on every tab, so the destinations never move.
 */
export function TabHeaderActions({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <div className={cn("flex shrink-0 items-center gap-1 pt-1", className)}>
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
              buttonVariants({ variant: "quiet", size: "icon-lg" }),
              active && "text-primary hover:text-primary",
            )}
          >
            <Icon aria-hidden />
          </PrefetchLink>
        );
      })}
      <AccountMenu />
    </div>
  );
}
