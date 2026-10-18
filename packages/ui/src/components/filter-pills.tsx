"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { haptic } from "../lib/haptics";

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
 * iOS-style segmented control. All tabs sit inside a single rounded container;
 * the active tab gets a white card background, inactive ones are plain muted text.
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
      className={cn(
        "bg-secondary border-border flex w-full items-center gap-0.5 rounded-full border p-1",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              if (!selected) haptic("tap");
              onValueChange(option.value);
            }}
            className={cn(
              "spring inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow] sm:px-3",
              "focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
              selected
                ? "bg-card text-foreground shadow-pressed"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.icon && (
              <span className="max-[359px]:hidden [&_svg]:size-3.5">
                {option.icon}
              </span>
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export { FilterPills };
