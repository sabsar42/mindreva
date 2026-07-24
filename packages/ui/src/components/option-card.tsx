"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export interface OptionCardProps extends Omit<
  React.ComponentProps<"button">,
  "onSelect" | "title"
> {
  title: React.ReactNode;
  description?: React.ReactNode;
  selected?: boolean;
  onSelect?: () => void;
}

/**
 * A selectable list row with a radio indicator — the pattern used on the
 * onboarding (languages, use-case) and account summary-style screens. Selected
 * rows take the light mint tint (accent) with a mint border; the dark mint is
 * reserved for the filled indicator.
 */
const OptionCard = React.forwardRef<HTMLButtonElement, OptionCardProps>(
  (
    { className, title, description, selected = false, onSelect, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg border px-4 py-3.5 text-left transition-colors",
          "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          selected
            ? "border-mint-300 bg-accent"
            : "border-border bg-card hover:bg-warm-100",
          className,
        )}
        {...props}
      >
        <div className="min-w-0 flex-1">
          <div className="text-foreground text-sm font-semibold">{title}</div>
          {description && (
            <div className="text-muted-foreground mt-0.5 text-sm">
              {description}
            </div>
          )}
        </div>
        <span
          aria-hidden
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            selected ? "border-primary bg-primary" : "border-warm-300 bg-card",
          )}
        >
          {selected && <span className="size-1.5 rounded-full bg-white" />}
        </span>
      </button>
    );
  },
);
OptionCard.displayName = "OptionCard";

export { OptionCard };
