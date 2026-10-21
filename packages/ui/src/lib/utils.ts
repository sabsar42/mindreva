import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The iOS type-scale names from tokens.css are font sizes. Without this,
// tailwind-merge reads `text-body` as a text *color* and drops a
// `text-foreground` next to it (or vice versa).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "large-title",
            "title-1",
            "title-2",
            "title-3",
            "headline",
            "body",
            "callout",
            "subhead",
            "footnote",
            "caption",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Derive up-to-two initials from a display name. Plain function (no React,
 * no "use client") so it can be called from Server Components — unlike
 * avatar.tsx, which is a client boundary and can't export a callable helper.
 */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (
    parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)
  ).toUpperCase();
}
