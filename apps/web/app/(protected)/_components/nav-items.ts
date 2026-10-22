import { History, Plug, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

/**
 * The two tab destinations, shown as icons at the top right of the tab screens.
 * Home is where you land (and where the back arrow on these two screens
 * returns to), and the river of memories lives inside Re-live Me rather than
 * being a destination of its own.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/chat", label: "Re-live Me", Icon: History },
  { href: "/integrations", label: "Integrations", Icon: Plug },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
