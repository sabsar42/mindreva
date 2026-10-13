import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "../lib/utils";

export interface ProcessingStepsProps extends React.ComponentProps<"ol"> {
  /** Ordered step labels, e.g. ["Saved", "Transcribing", "Summarizing"]. */
  steps: string[];
  /** Zero-based index of the step in progress. Earlier steps show as done. */
  current: number;
}

/**
 * A compact stepper: dots joined by a line, done steps filled, the current
 * step ringed and softly pulsing. Driven by real pipeline state, never a
 * fake timer. The labels are screen-reader text; the visual is dots only.
 */
function ProcessingSteps({
  steps,
  current,
  className,
  ...props
}: ProcessingStepsProps) {
  return (
    <ol
      aria-label="Progress"
      className={cn("flex items-center justify-center", className)}
      {...props}
    >
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className="flex items-center"
          >
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "mx-1 h-px w-8 transition-colors duration-500",
                  i <= current ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "flex items-center justify-center rounded-full transition-all duration-500",
                done && "bg-primary text-primary-foreground size-4",
                active &&
                  "bg-primary ring-primary/20 size-3.5 ring-4 motion-safe:animate-pulse",
                !done && !active && "bg-border size-2.5",
              )}
            >
              {done && <Check className="size-2.5" strokeWidth={3.5} />}
            </span>
            <span className="sr-only">
              {label}
              {done ? " (done)" : active ? " (in progress)" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export { ProcessingSteps };
