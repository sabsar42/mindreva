"use client";

import { usePathname } from "next/navigation";
import { cn } from "@mindreva/ui";
import { PrefetchLink } from "./prefetch-link";
import { NAV_ITEMS, isActivePath } from "./nav-items";

/**
 * iOS tab bar: translucent material, a hairline on top, 49px plus the home
 * indicator inset, icon over label, the tint marks the current section.
 * It stays inside the phone-width column on wide screens.
 */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="bg-material border-separator pb-safe max-w-120 fixed inset-x-0 bottom-0 z-40 mx-auto w-full border-t-[0.5px]"
    >
      <ul className="flex h-[49px] items-stretch">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={href} className="flex-1">
              <PrefetchLink
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring flex h-full flex-col items-center justify-center gap-0.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset active:opacity-60",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  aria-hidden
                  className="size-6"
                  strokeWidth={active ? 2.25 : 1.75}
                />
                <span className="text-[0.625rem] font-medium leading-none tracking-wide">
                  {label}
                </span>
              </PrefetchLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
