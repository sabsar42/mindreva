import { CircleUser, History, House, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

/**
 * The three top-level sections, shown in the bottom tab bar (iOS style).
 * Everything else (an entry, a conversation, Archive, Trash, Connected apps)
 * is pushed from one of these and has a back button instead.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/journal", label: "Home", Icon: House },
  { href: "/chat", label: "Re-live", Icon: History },
  { href: "/account", label: "Account", Icon: CircleUser },
];

/** Routes that show the tab bar: exactly the tab destinations. */
export function isTabRoute(pathname: string): boolean {
  return NAV_ITEMS.some((item) => item.href === pathname);
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
