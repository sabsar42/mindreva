"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "../lib/utils";

export interface ProgressBarProps extends Omit<
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
  "value"
> {
  /** 0–100. If omitted, computed from `current` / `max`. */
  value?: number;
  /** Left label, e.g. "Note taking". */
  label?: string;
  /** Right value text, e.g. "1m of 1h". */
  valueLabel?: string;
  current?: number;
  max?: number;
}

/**
 * Labeled usage bar from the account screen ("1m of 1h", "2 of 10").
 * Pass either an explicit `value` (0–100) or `current`/`max` to compute it.
 */
const ProgressBar = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressBarProps
>(({ className, value, label, valueLabel, current, max, ...props }, ref) => {
  const pct =
    value ??
    (typeof current === "number" && typeof max === "number" && max > 0
      ? Math.min(100, Math.max(0, (current / max) * 100))
      : 0);

  return (
    <div className="flex w-full flex-col gap-1.5">
      {(label || valueLabel) && (
        <div className="flex items-baseline justify-between text-sm">
          {label && <span className="text-foreground">{label}</span>}
          {valueLabel && (
            <span className="text-foreground font-medium">{valueLabel}</span>
          )}
        </div>
      )}
      <ProgressPrimitive.Root
        ref={ref}
        value={pct}
        className={cn(
          "bg-muted relative h-2 w-full overflow-hidden rounded-full",
          className,
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className="bg-primary h-full rounded-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${100 - pct}%)` }}
        />
      </ProgressPrimitive.Root>
    </div>
  );
});
ProgressBar.displayName = "ProgressBar";

export { ProgressBar };
