"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Flame, Loader2, Mic, RotateCcw, Square, X } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  LeafMark,
  buttonVariants,
  cn,
  haptic,
} from "@mindreva/ui";
import { useVoiceRecorder, type MicErrorKind } from "@/lib/use-voice-recorder";
import type { RecorderPhase } from "@/lib/mori-mood";
import { LiveWaveCanvas } from "./live-wave-canvas";

/** Every state shares this exact box (76px), so nothing around it moves when
 * recording starts, stops or saves. */
const BAR =
  "bg-card/92 shadow-card flex h-19 w-full items-center gap-2.5 rounded-full border-[0.5px] pl-2.5 pr-2.5";

/** iOS-style press: a small, quick scale-down, nothing more. */
const PRESS =
  "transition-[transform,opacity] duration-150 active:scale-[0.97] active:opacity-90";

function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A take shorter than this is discarded without asking. */
const CONFIRM_DISCARD_AFTER_MS = 1000;

/** Short text that fits the bar, and the steps behind "How to fix". */
const MIC_HELP: Record<
  MicErrorKind,
  { short: string; title: string; steps: string[] }
> = {
  denied: {
    short: "Microphone is off for Mindreva.",
    title: "Turn on the microphone",
    steps: [
      "iPhone or iPad (Safari): open Settings, then Safari, then Microphone, and choose Allow. Or tap aA in the address bar, then Website Settings, then Microphone.",
      "Chrome, Edge or Firefox: tap the lock or settings icon next to the address, set Microphone to Allow, then reload the page.",
      "Then come back and tap Retry.",
    ],
  },
  "no-device": {
    short: "No microphone found.",
    title: "No microphone found",
    steps: [
      "Connect a microphone or headset, or check that your device's built-in microphone isn't turned off.",
      "Then tap Retry.",
    ],
  },
  busy: {
    short: "Another app is using the microphone.",
    title: "The microphone is busy",
    steps: [
      "Another app or browser tab is using it (a call, a video meeting, another recorder). Close it, then tap Retry.",
    ],
  },
  unsupported: {
    short: "This browser can't record audio.",
    title: "Recording isn't supported here",
    steps: [
      "This browser doesn't support recording audio. Try a recent Safari, Chrome, Edge or Firefox.",
    ],
  },
  other: {
    short: "Couldn't start the microphone.",
    title: "Couldn't start the microphone",
    steps: ["Tap Retry. If it keeps happening, reload the page."],
  },
};

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
 * action; it sinks a little when pressed. Stopping uploads the
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
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [micHelpOpen, setMicHelpOpen] = React.useState(false);

  /** Discard right away for a tap-and-cancel; otherwise ask first. */
  const requestDiscard = () => {
    if (rec.elapsedMs < CONFIRM_DISCARD_AFTER_MS && !rec.uploadFailed) {
      rec.cancel();
    } else {
      setConfirmDiscard(true);
    }
  };

  const status = rec.micError
    ? MIC_HELP[rec.micError].short
    : rec.uploadFailed
      ? "Couldn't save the recording. Your audio is kept; you can retry."
      : rec.state === "preparing"
        ? "Starting the microphone"
        : rec.state === "recording"
          ? "Recording"
          : rec.state === "paused"
            ? "Recording paused"
            : rec.state === "processing"
              ? "Saving the recording"
              : "";

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
            "border-card-edge focus-visible:ring-ring group text-left focus-visible:outline-none focus-visible:ring-2",
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
            <span className="bg-gradient-primary text-primary-foreground shadow-subtle relative flex size-14 items-center justify-center rounded-full transition-transform duration-150 group-active:scale-95">
              <LeafMark className="size-9" />
            </span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Announced once per change, for screen readers. */}
      <span className="sr-only" role="status" aria-live="polite">
        {status}
      </span>
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
            <div className="min-w-0 flex-1 pl-2">
              <p className="text-foreground text-footnote truncate font-semibold">
                {MIC_HELP[rec.micError].short}
              </p>
              <button
                type="button"
                onClick={() => setMicHelpOpen(true)}
                className="text-primary text-footnote hit-44 font-semibold"
              >
                How to fix
              </button>
            </div>
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
            {/* The logo is the live indicator: it shows a steady ring while
                recording, dims when paused, and is a spinner while busy. */}
            <span className="relative flex size-14 shrink-0 items-center justify-center">
              {rec.state === "recording" && (
                <span
                  aria-hidden
                  className="bg-primary/20 absolute -inset-1 rounded-full"
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
                  <LeafMark className="size-8" />
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
                <LiveWaveCanvas
                  analyserRef={rec.analyserRef}
                  active={rec.state === "recording"}
                />
              </button>
            )}

            {(live || rec.uploadFailed) && (
              <button
                type="button"
                onClick={requestDiscard}
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
                title="Stop and save"
                // A round red stop with a square glyph (as in Voice Memos):
                // a labelled pill was so wide it left the waveform 0 px.
                className={buttonVariants({
                  variant: "destructive",
                  size: "icon",
                  className: "size-14 shrink-0 rounded-full [&_svg]:size-5",
                })}
              >
                <Square className="fill-current" />
              </button>
            )}
          </>
        )}
      </div>

      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this recording?</DialogTitle>
            <DialogDescription>
              {formatClock(rec.elapsedMs)} of audio will be deleted. This
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setConfirmDiscard(false)}
            >
              {rec.uploadFailed ? "Keep it" : "Keep recording"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDiscard(false);
                rec.cancel();
              }}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {rec.micError && (
        <Dialog open={micHelpOpen} onOpenChange={setMicHelpOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{MIC_HELP[rec.micError].title}</DialogTitle>
              <DialogDescription asChild>
                <ol className="list-decimal space-y-2 pl-5 text-left">
                  {MIC_HELP[rec.micError].steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setMicHelpOpen(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setMicHelpOpen(false);
                  void rec.start();
                }}
              >
                Retry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
