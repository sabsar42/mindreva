"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Flame, Loader2, Mic, RotateCcw, Square, X } from "lucide-react";
import { LeafMark, buttonVariants, cn, haptic } from "@mindreva/ui";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import type { RecorderPhase } from "@/lib/mori-mood";

/** Every state shares this exact box (76px), so nothing around it moves when
 * recording starts, stops or saves. */
const BAR =
  "bg-card shadow-subtle flex h-19 w-full items-center gap-3.5 rounded-full border pl-2.5 pr-2.5";

/** iOS-style press: a small, quick scale-down, nothing more. */
const PRESS =
  "transition-[transform,opacity] duration-150 active:scale-[0.97] active:opacity-90";

function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Fixed per-bar weights so the waveform peaks in the middle and tapers at
 * the edges, the way a voice-memo waveform reads, instead of a flat comb. */
const BAR_WEIGHTS = Array.from({ length: 24 }, (_, i) => {
  const t = i / 23;
  return 0.45 + 0.55 * Math.sin(Math.PI * t);
});

function LiveWave({
  amplitudes,
  active,
}: {
  amplitudes: number[];
  active: boolean;
}) {
  return (
    <div
      aria-hidden
      className="gap-0.75 flex h-10 min-w-0 flex-1 items-center overflow-hidden"
    >
      {BAR_WEIGHTS.map((weight, i) => {
        const amp = amplitudes[i % amplitudes.length] ?? 0;
        const h = active
          ? Math.max(0.14, Math.min(1, amp * 1.6 * weight))
          : 0.14;
        return (
          <span
            key={i}
            className={cn(
              "bg-primary w-0.75 shrink-0 rounded-full transition-[height,opacity] duration-100",
              !active && "opacity-40",
            )}
            style={{ height: `${h * 100}%` }}
          />
        );
      })}
    </div>
  );
}

function StreakLine({ streak }: { streak: number }) {
  if (streak <= 0) {
    return (
      <span className="text-muted-foreground mt-1 block truncate text-[13px] font-medium">
        Start your streak today
      </span>
    );
  }
  return (
    <span className="text-muted-foreground mt-1 flex items-center gap-1 text-[13px] font-semibold">
      <Flame className="text-heat-3 fill-heat-3 size-[15px]" aria-hidden />
      {streak}-day streak
    </span>
  );
}

/**
 * The Journal screen's record bar. Tapping it starts recording right here: no
 * navigation, no review screen. The leaf logo on the right is the call to
 * action; it blinks, and sinks a little when pressed. Stopping uploads the
 * audio (the bar shows "Saving…"), then hands the entry to the Journal, where
 * its memory card forms in the list while transcription and summarising carry
 * on. The bar is free for the next recording straight away.
 */
export function InlineRecorder({
  className,
  streak = 0,
  onPhaseChange,
  onSaved,
}: {
  className?: string;
  /** Consecutive active days ending today (shown under the title). */
  streak?: number;
  /** What the recorder is doing, so the rest of the screen can react. */
  onPhaseChange?: (phase: RecorderPhase) => void;
  /** The audio is uploaded and the entry exists. */
  onSaved?: (entryId: string, durationMs: number) => void;
}) {
  const router = useRouter();

  const onDone = React.useCallback(
    (entryId: string, durationMs: number) => {
      router.refresh();
      onSaved?.(entryId, durationMs);
    },
    [router, onSaved],
  );

  const rec = useVoiceRecorder({ entryType: "journal", onDone });

  const live = rec.state === "recording" || rec.state === "paused";
  const busy = rec.state === "preparing" || rec.state === "processing";
  const active =
    rec.state !== "idle" || rec.uploadFailed || rec.micError !== null;

  React.useEffect(() => {
    onPhaseChange?.(
      rec.state === "recording"
        ? "recording"
        : rec.state === "paused"
          ? "paused"
          : rec.state === "processing" && !rec.uploadFailed
            ? "processing"
            : "idle",
    );
  }, [rec.state, rec.uploadFailed, onPhaseChange]);

  if (!active) {
    return (
      <div className={className}>
        <button
          type="button"
          aria-label="Start recording"
          onClick={() => {
            haptic("tap");
            void rec.start();
          }}
          className={cn(
            BAR,
            PRESS,
            "border-border focus-visible:ring-ring group text-left focus-visible:outline-none focus-visible:ring-2",
          )}
        >
          <span className="bg-accent text-accent-foreground flex size-14 shrink-0 items-center justify-center rounded-full">
            <Mic className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-foreground block truncate text-lg font-semibold leading-tight tracking-tight">
              Record a voice note
            </span>
            <StreakLine streak={streak} />
          </span>
          <span className="relative flex size-14 shrink-0 items-center justify-center">
            <span
              aria-hidden
              className="bg-primary/25 motion-safe:animate-mic-pulse absolute inset-0 rounded-full"
            />
            <span className="bg-gradient-primary text-primary-foreground shadow-subtle relative flex size-14 items-center justify-center rounded-full transition-transform duration-150 group-active:scale-95">
              <LeafMark className="size-9 motion-safe:animate-pulse" />
            </span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className={className} aria-live="polite">
      <div
        role="group"
        aria-label="Voice recording"
        className={cn(
          BAR,
          "border-primary/50 ring-primary/10 motion-safe:animate-scale-in ring-4",
        )}
      >
        {rec.micError ? (
          <>
            <p className="text-foreground min-w-0 flex-1 pl-2 text-xs leading-snug">
              Microphone blocked. Allow access in your browser, then try again.
            </p>
            <button
              type="button"
              onClick={rec.cancel}
              aria-label="Dismiss"
              className={buttonVariants({ variant: "quiet", size: "icon" })}
            >
              <X />
            </button>
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                void rec.start();
              }}
              className={buttonVariants({
                variant: "primary",
                size: "lg",
                className: "px-5",
              })}
            >
              <RotateCcw />
              Retry
            </button>
          </>
        ) : (
          <>
            {/* The logo is the live indicator: it blinks and rings while
                recording, dims when paused, and is a spinner while busy. */}
            <span className="relative flex size-14 shrink-0 items-center justify-center">
              {rec.state === "recording" && (
                <span
                  aria-hidden
                  className="bg-primary/25 motion-safe:animate-mic-pulse absolute inset-0 rounded-full"
                />
              )}
              <span
                className={cn(
                  "relative flex size-14 items-center justify-center rounded-full",
                  busy
                    ? "bg-secondary text-primary"
                    : "bg-primary text-primary-foreground",
                  rec.state === "paused" && "opacity-60",
                )}
              >
                {busy ? (
                  <Loader2 className="size-6 animate-spin" />
                ) : (
                  <LeafMark
                    className={cn(
                      "size-8",
                      rec.state === "recording" && "motion-safe:animate-pulse",
                    )}
                  />
                )}
              </span>
            </span>

            {rec.state === "preparing" ? (
              <span className="text-muted-foreground min-w-0 flex-1 text-base font-medium">
                Starting microphone…
              </span>
            ) : rec.state === "processing" || rec.uploadFailed ? (
              <span className="text-muted-foreground min-w-0 flex-1 text-base font-medium">
                {rec.uploadFailed
                  ? "Couldn't save. Your audio is kept."
                  : "Saving…"}
              </span>
            ) : (
              <button
                type="button"
                onClick={rec.state === "recording" ? rec.pause : rec.resume}
                aria-label={rec.state === "recording" ? "Pause" : "Resume"}
                title={
                  rec.state === "recording" ? "Tap to pause" : "Tap to resume"
                }
                className="flex min-w-0 flex-1 items-center rounded-full focus-visible:outline-none"
              >
                <LiveWave
                  amplitudes={rec.amplitudes}
                  active={rec.state === "recording"}
                />
              </button>
            )}

            {(live || rec.uploadFailed) && (
              <button
                type="button"
                onClick={rec.cancel}
                aria-label="Discard recording"
                className={buttonVariants({ variant: "quiet", size: "icon" })}
              >
                <X />
              </button>
            )}

            <span
              role="timer"
              className={cn(
                "bg-accent text-accent-foreground shrink-0 rounded-full px-3.5 py-2.5 text-base font-semibold tabular-nums",
                rec.state === "paused" && "opacity-60",
              )}
            >
              {formatClock(rec.elapsedMs)}
            </span>

            {rec.uploadFailed ? (
              <button
                type="button"
                onClick={rec.retryUpload}
                className={buttonVariants({
                  variant: "primary",
                  size: "lg",
                  className: "px-5",
                })}
              >
                <RotateCcw />
                Retry
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  haptic("tap");
                  rec.finish();
                }}
                disabled={!live}
                aria-label="Stop and save recording"
                className={buttonVariants({
                  variant: "destructive",
                  size: "lg",
                  className: "px-5",
                })}
              >
                <Square className="fill-current" />
                Stop
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
