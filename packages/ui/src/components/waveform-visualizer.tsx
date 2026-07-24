"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export interface WaveformVisualizerProps extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  /** Number of bars to render when no live data is supplied. */
  bars?: number;
  /**
   * Live amplitudes in 0..1. When provided, bar heights follow the data.
   * When omitted and `active` is true, bars animate on a calm idle loop.
   */
  amplitudes?: number[];
  /** Whether the visualizer is actively animating (i.e. recording). */
  active?: boolean;
}

/**
 * Simple SVG-free bar visualizer for the recording screen. Reacts to live
 * `amplitudes` when given; otherwise runs a calm idle animation while `active`.
 */
function WaveformVisualizer({
  className,
  bars = 28,
  amplitudes,
  active = true,
  ...props
}: WaveformVisualizerProps) {
  const count = amplitudes?.length ?? bars;

  return (
    <div
      role="img"
      aria-label="Audio waveform"
      className={cn("flex h-12 items-center justify-center gap-1", className)}
      {...props}
    >
      {Array.from({ length: count }).map((_, i) => {
        const amp = amplitudes?.[i];
        const dataDriven = typeof amp === "number";
        const heightPct = dataDriven
          ? Math.max(12, Math.min(100, amp * 100))
          : undefined;

        return (
          <span
            key={i}
            className={cn(
              "bg-primary w-1 origin-center rounded-full",
              !dataDriven && active && "animate-waveform",
              !active && "opacity-40",
            )}
            style={
              dataDriven
                ? { height: `${heightPct}%` }
                : {
                    height: "100%",
                    animationDelay: `${(i % 7) * 90}ms`,
                    animationDuration: `${760 + (i % 5) * 120}ms`,
                  }
            }
          />
        );
      })}
    </div>
  );
}

export { WaveformVisualizer };
