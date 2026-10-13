"use client";

import * as React from "react";
import { Loader2, Pause, Play, Square } from "lucide-react";
import { cn } from "../lib/utils";
import { LeafMark } from "./logo";

export type RecordButtonState =
  "idle" | "preparing" | "recording" | "paused" | "processing";

export interface RecordButtonProps extends Omit<
  React.ComponentProps<"button">,
  "children"
> {
  state?: RecordButtonState;
  size?: "md" | "lg";
  /** Optional caption rendered under the button (e.g. "Tap to record"). */
  label?: string;
}

const sizeMap = {
  md: "size-16",
  lg: "size-24",
} as const;

const iconSizeMap = {
  md: "size-9",
  lg: "size-14",
} as const;

/**
 * The core voice-capture control. No circular chrome — it's the logo itself
 * at a large tappable size, with a generous invisible hit area so it still
 * behaves like a button without looking like one. Its appearance changes
 * with state: primary-colored leaf to start, a pulsing leaf while recording,
 * a calm spinner while the mic warms up or the transcript processes, a
 * resume glyph when paused. `preparing` and `processing` are
 * non-interactive.
 */
const RecordButton = React.forwardRef<HTMLButtonElement, RecordButtonProps>(
  (
    { className, state = "idle", size = "lg", label, disabled, ...props },
    ref,
  ) => {
    const busy = state === "preparing" || state === "processing";
    const isRecording = state === "recording";

    const defaultLabel: Record<RecordButtonState, string> = {
      idle: "Tap to record",
      preparing: "Getting the microphone ready…",
      recording: "Tap to finish",
      paused: "Paused — tap to resume",
      processing: "Working on it…",
    };

    return (
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex items-center justify-center">
          {isRecording && (
            <span
              aria-hidden
              className="bg-primary/20 animate-mic-pulse absolute inset-0 rounded-full"
            />
          )}
          <button
            ref={ref}
            type="button"
            disabled={disabled || busy}
            aria-label={label ?? defaultLabel[state]}
            className={cn(
              "focus-visible:ring-ring focus-visible:ring-offset-background relative flex items-center justify-center rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4 disabled:cursor-default",
              sizeMap[size],
              (state === "idle" || state === "paused") &&
                "text-primary hover:scale-105 active:scale-95",
              isRecording && "text-primary active:scale-95",
              busy && "text-muted-foreground",
              className,
            )}
            {...props}
          >
            {state === "idle" && <LeafMark className={iconSizeMap[size]} />}
            {isRecording && (
              <LeafMark className={cn(iconSizeMap[size], "animate-pulse")} />
            )}
            {state === "paused" && (
              <Play className={cn(iconSizeMap[size], "fill-current")} />
            )}
            {busy && (
              <Loader2 className={cn(iconSizeMap[size], "animate-spin")} />
            )}
          </button>
        </div>
        {(label ?? defaultLabel[state]) && (
          <span
            className={cn(
              "text-sm",
              state === "preparing"
                ? "text-muted-foreground"
                : "text-foreground",
            )}
          >
            {label ?? defaultLabel[state]}
          </span>
        )}
      </div>
    );
  },
);
RecordButton.displayName = "RecordButton";

/** Secondary transport control (pause / stop) used beside the record button. */
export interface TransportButtonProps extends React.ComponentProps<"button"> {
  action: "pause" | "stop";
}

const TransportButton = React.forwardRef<
  HTMLButtonElement,
  TransportButtonProps
>(({ className, action, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label={action === "pause" ? "Pause" : "Finish recording"}
    className={cn(
      "border-border bg-card text-foreground hover:bg-secondary focus-visible:ring-ring focus-visible:ring-offset-background flex size-14 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      action === "stop" && "text-destructive",
      className,
    )}
    {...props}
  >
    {action === "pause" ? (
      <Pause className="size-5 fill-current" />
    ) : (
      <Square className="size-5 fill-current" />
    )}
  </button>
));
TransportButton.displayName = "TransportButton";

export { RecordButton, TransportButton };
