"use client";

import { usePathname } from "next/navigation";
import { BookOpen, MessageSquare, Brain, User } from "lucide-react";
import { cn } from "@mindreva/ui";
import { PrefetchLink } from "./prefetch-link";

const NAV_ITEMS = [
  { href: "/journal", label: "Journal", Icon: BookOpen },
  { href: "/chat", label: "Chat", Icon: MessageSquare },
  { href: "/mindmap", label: "Mindmap", Icon: Brain },
  { href: "/account", label: "Account", Icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-card border-border fixed inset-x-0 bottom-0 z-40 border-t md:hidden">
      <div className="mx-auto flex max-w-md items-center">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <PrefetchLink
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("size-5", active && "stroke-[2.5]")} />
              <span
                className={cn(
                  "text-[10px]",
                  active ? "font-semibold" : "font-medium",
                )}
              >
                {label}
              </span>
            </PrefetchLink>
          );
        })}
      </div>
    </nav>
  );
}
