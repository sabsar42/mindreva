"use client";

import { usePathname } from "next/navigation";
import { BookOpen, MessageSquare, Brain, User } from "lucide-react";
import { cn, LeafMark } from "@mindreva/ui";
import { PrefetchLink } from "./prefetch-link";

const NAV_ITEMS = [
  { href: "/journal", label: "Journal", Icon: BookOpen },
  { href: "/chat", label: "Chat", Icon: MessageSquare },
  { href: "/mindmap", label: "Mindmap", Icon: Brain },
  { href: "/account", label: "Account", Icon: User },
];

export function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="bg-card border-border fixed inset-y-0 left-0 z-40 hidden w-14 flex-col border-r md:flex lg:w-56">
      {/* Branding */}
      <div className="border-border flex h-14 shrink-0 items-center justify-center border-b px-3 lg:justify-start lg:px-4">
        <div className="bg-primary flex size-8 shrink-0 items-center justify-center rounded-full">
          <LeafMark className="text-primary-foreground size-4" />
        </div>
        <span className="text-primary ml-2.5 hidden font-serif text-base font-bold lg:block">
          Mindreva
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 pt-3">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <PrefetchLink
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors lg:px-3",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "size-5 shrink-0",
                  active ? "stroke-[2.5]" : "stroke-2",
                )}
              />
              <span className="hidden text-sm font-medium lg:block">
                {label}
              </span>
            </PrefetchLink>
          );
        })}
      </nav>
    </aside>
  );
}
