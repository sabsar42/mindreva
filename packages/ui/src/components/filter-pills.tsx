"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export interface FilterPillOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface FilterPillsProps {
  options: FilterPillOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

/**
 * The All / Today / This week / Date segmented control from the journal list.
 * Selected pill uses the light mint tint (accent), never the dark primary.
 */
function FilterPills({
  options,
  value,
  onValueChange,
  className,
}: FilterPillsProps) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              selected
                ? "border-mint-300 bg-accent text-accent-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-warm-100 hover:text-foreground",
            )}
          >
            {option.icon && (
              <span className="[&_svg]:size-4">{option.icon}</span>
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export { FilterPills };
