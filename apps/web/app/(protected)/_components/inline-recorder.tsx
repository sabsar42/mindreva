"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, RotateCcw, X } from "lucide-react";
import { cn } from "@mindreva/ui";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";

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
      className="gap-0.75 flex h-8 min-w-0 flex-1 items-center overflow-hidden"
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

/**
 * The Journal screen's record bar. Tapping it starts recording right here —
 * no navigation, no review screen. The pill keeps its exact size between
 * idle and recording so nothing below it jumps; stopping uploads, and
 * transcription carries on in the background.
 */
export function InlineRecorder({ className }: { className?: string }) {
  const router = useRouter();
  const rec = useVoiceRecorder({
    entryType: "journal",
    onDone: () => router.refresh(),
  });

  const live = rec.state === "recording" || rec.state === "paused";
  const busy = rec.state === "preparing" || rec.state === "processing";
  const active =
    rec.state !== "idle" || rec.uploadFailed || rec.micError !== null;

  if (!active) {
    return (
      <button
        type="button"
        aria-label="Start recording"
        onClick={() => void rec.start()}
        className={cn(
          "border-border bg-card shadow-subtle focus-visible:ring-ring h-18 hover:shadow-elevated group flex w-full items-center gap-3 rounded-full border pl-3 pr-3 text-left transition-[box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 active:scale-[0.985]",
          className,
        )}
      >
        <span className="bg-gradient-primary shadow-subtle flex size-12 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105">
          <Mic className="text-primary-foreground size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-[15px] font-semibold tracking-tight">
            Record a voice note
          </span>
          <span className="text-muted-foreground block truncate text-xs">
            Starts instantly, no extra tap
          </span>
        </span>
        <span className="bg-accent text-accent-foreground flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold transition-colors group-hover:brightness-95">
          <span className="size-2.5 rounded-full border-2 border-current" />
          Record
        </span>
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Voice recording"
      className={cn(
        "border-primary bg-card ring-primary/15 motion-safe:animate-scale-in h-18 flex w-full items-center gap-3 rounded-full border-[1.5px] pl-2.5 pr-2.5 ring-4",
        className,
      )}
    >
      {rec.micError ? (
        <>
          <p className="text-foreground min-w-0 flex-1 pl-3 text-sm leading-snug">
            Microphone blocked. Allow access in your browser, then try again.
          </p>
          <button
            type="button"
            onClick={rec.cancel}
            aria-label="Dismiss"
            className="text-muted-foreground hover:bg-secondary press flex size-9 shrink-0 items-center justify-center rounded-full"
          >
            <X className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => void rec.start()}
            className="bg-primary text-primary-foreground press flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold"
          >
            <RotateCcw className="size-3.5" />
            Retry
          </button>
        </>
      ) : (
        <>
          <span
            className={cn(
              "ml-1 flex size-9 shrink-0 items-center justify-center rounded-full",
              busy ? "bg-secondary" : "bg-destructive/10",
            )}
          >
            {busy ? (
              <Loader2 className="text-primary size-4 animate-spin" />
            ) : (
              <span
                className={cn(
                  "bg-destructive size-3 rounded-full",
                  rec.state === "recording" && "motion-safe:animate-pulse",
                  rec.state === "paused" && "opacity-40",
                )}
              />
            )}
          </span>

          {rec.state === "preparing" ? (
            <span className="text-muted-foreground min-w-0 flex-1 text-sm">
              Starting microphone…
            </span>
          ) : rec.state === "processing" || rec.uploadFailed ? (
            <span className="text-muted-foreground min-w-0 flex-1 text-sm">
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
              className="text-muted-foreground hover:bg-secondary hover:text-foreground press flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
            >
              <X className="size-4" />
            </button>
          )}

          <span
            role="timer"
            className={cn(
              "bg-accent text-accent-foreground shrink-0 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums",
              rec.state === "paused" && "opacity-60",
            )}
          >
            {formatClock(rec.elapsedMs)}
          </span>

          {rec.uploadFailed ? (
            <button
              type="button"
              onClick={rec.retryUpload}
              className="bg-primary text-primary-foreground press flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold"
            >
              <RotateCcw className="size-3.5" />
              Retry
            </button>
          ) : (
            <button
              type="button"
              onClick={rec.finish}
              disabled={!live}
              aria-label="Stop and save recording"
              className="bg-gradient-danger press shadow-subtle flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold text-white transition-opacity disabled:opacity-50"
            >
              <span className="rounded-xs size-2.5 bg-white" />
              Stop
            </button>
          )}
        </>
      )}
    </div>
  );
}
