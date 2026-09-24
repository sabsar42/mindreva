"use client";

import { usePathname } from "next/navigation";
import { BookOpen, FileText, MessageSquare, Brain, User } from "lucide-react";
import { cn } from "@mindreva/ui";
import { PrefetchLink } from "./prefetch-link";

const NAV_ITEMS = [
  { href: "/notes", label: "Notes", Icon: FileText, center: false },
  { href: "/chat", label: "Chat", Icon: MessageSquare, center: false },
  { href: "/journal", label: "Journal", Icon: BookOpen, center: true },
  { href: "/mindmap", label: "Mindmap", Icon: Brain, center: false },
  { href: "/account", label: "Account", Icon: User, center: false },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-card border-border fixed inset-x-0 bottom-0 z-40 border-t md:hidden">
      <div className="mx-auto flex max-w-md items-center">
        {NAV_ITEMS.map(({ href, label, Icon, center }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          if (center) {
            return (
              <PrefetchLink
                key={href}
                href={href}
                className="flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors"
              >
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full transition-colors",
                    active ? "bg-primary" : "bg-secondary",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-5 transition-colors",
                      active ? "text-primary-foreground" : "text-foreground",
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px]",
                    active
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground font-medium",
                  )}
                >
                  {label}
                </span>
              </PrefetchLink>
            );
          }
          return (
            <PrefetchLink
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-3 transition-colors",
                active
                  ? "text-foreground"
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
