"use client";

import * as React from "react";
import { Check, Pause, Play, RotateCcw, Trash2, X } from "lucide-react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  buttonVariants,
  cn,
  haptic,
} from "@mindreva/ui";
import { useVoiceRecorder, type MicErrorKind } from "@/lib/use-voice-recorder";
import type { RecorderPhase } from "@/lib/mori-mood";
import { PrefetchLink } from "./prefetch-link";
import { WaveformCanvas } from "./waveform-canvas";

/** "0:04", "12:30". */
export function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A take shorter than this is discarded without asking. */
const CONFIRM_DISCARD_AFTER_MS = 1000;

/** What went wrong with the microphone, and the steps to fix it. */
const MIC_HELP: Record<MicErrorKind, { title: string; steps: string[] }> = {
  denied: {
    title: "Microphone access is off",
    steps: [
      "iPhone or iPad: open Settings › Safari › Microphone and choose Allow, or tap aA in the address bar › Website Settings › Microphone.",
      "Chrome, Edge or Firefox: click the icon next to the address, set Microphone to Allow, then reload.",
    ],
  },
  "no-device": {
    title: "No microphone found",
    steps: [
      "Connect a microphone or headset, or check that the built-in microphone isn't turned off.",
    ],
  },
  busy: {
    title: "The microphone is busy",
    steps: [
      "Another app or tab is using it (a call, a meeting, another recorder). Close it and try again.",
    ],
  },
  unsupported: {
    title: "Recording isn't supported here",
    steps: ["Try a recent version of Safari, Chrome, Edge or Firefox."],
  },
  other: {
    title: "Couldn't start the microphone",
    steps: ["Try again. If it keeps happening, reload the page."],
  },
};

/** 72px Voice Memos record control: a ring around a red circle that morphs
 * into a rounded square while recording. Transform + radius only. */
function RecordControl({
  recording,
  disabled,
  label,
  onPress,
}: {
  recording: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      className="border-foreground/15 focus-visible:ring-ring size-18 flex items-center justify-center rounded-full border-[3px] transition-[transform,opacity] duration-150 [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95 disabled:opacity-40"
    >
      <span
        aria-hidden
        className={cn(
          "bg-gradient-danger ease-standard duration-250 block size-14 transition-[transform,border-radius]",
          recording ? "scale-50 rounded-[22%]" : "scale-100 rounded-full",
        )}
      />
    </button>
  );
}

/**
 * The voice recorder, presented as a bottom sheet in the spirit of Voice
 * Memos: a large tabular timer, a scrolling waveform, and one row of controls
 * (discard · record/stop · pause). Opening the sheet starts recording right
 * away. Dragging it down or pressing Escape while there's audio asks before
 * discarding. The recording/upload/transcription pipeline is the shared
 * `useVoiceRecorder`, unchanged: stopping uploads the take, and the memory
 * card forms in the Journal list behind the sheet.
 */
export function RecordSheet({
  open,
  onOpenChange,
  onPhaseChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPhaseChange?: (phase: RecorderPhase) => void;
  onSaved?: (entryId: string, durationMs: number) => void;
}) {
  const [savedEntryId, setSavedEntryId] = React.useState<string | null>(null);
  const [take, setTake] = React.useState(0);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);

  const onDone = React.useCallback(
    (entryId: string, durationMs: number) => {
      haptic("success");
      setSavedEntryId(entryId);
      onSaved?.(entryId, durationMs);
    },
    [onSaved],
  );
  const rec = useVoiceRecorder({ entryType: "journal", onDone });

  const live = rec.state === "recording" || rec.state === "paused";
  const hasAudio =
    (live && rec.elapsedMs >= CONFIRM_DISCARD_AFTER_MS) || rec.uploadFailed;

  const begin = React.useCallback(() => {
    setSavedEntryId(null);
    setTake((t) => t + 1);
    haptic("tap");
    void rec.start();
  }, [rec]);

  // Opening the sheet starts a take: one tap from Home to recording.
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (open && !wasOpen.current && rec.state === "idle" && !rec.uploadFailed) {
      begin();
    }
    wasOpen.current = open;
  }, [open, rec.state, rec.uploadFailed, begin]);

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

  /** Every way of closing (drag, Escape, backdrop) comes through here. */
  const requestClose = (next: boolean) => {
    if (next) return onOpenChange(true);
    if (hasAudio) {
      setConfirmDiscard(true);
      return;
    }
    // A take under a second, or a mic error: just let it go.
    if (live || rec.micError) rec.cancel();
    // A take that is uploading keeps going in the background; its card
    // forms in the list.
    setSavedEntryId(null);
    onOpenChange(false);
  };

  const discard = () => {
    setConfirmDiscard(false);
    rec.cancel();
    setSavedEntryId(null);
    onOpenChange(false);
  };

  const view:
    | "permission"
    | "starting"
    | "live"
    | "saving"
    | "saved"
    | "failed"
    | "mic-error"
    | "idle" = rec.micError
    ? "mic-error"
    : savedEntryId
      ? "saved"
      : rec.uploadFailed
        ? "failed"
        : rec.state === "preparing"
          ? rec.awaitingPermission
            ? "permission"
            : "starting"
          : live
            ? "live"
            : rec.state === "processing"
              ? "saving"
              : "idle";

  const status =
    view === "permission"
      ? "Allow microphone access to start recording."
      : view === "starting"
        ? "Starting the microphone…"
        : view === "live"
          ? rec.state === "paused"
            ? "Paused"
            : "Recording"
          : view === "saving"
            ? "Saving your recording…"
            : view === "saved"
              ? "Saved to your journal"
              : view === "failed"
                ? "Couldn't save. Your audio is kept on this device."
                : view === "mic-error"
                  ? MIC_HELP[rec.micError!].title
                  : "Tap the red button to record";

  return (
    <>
      <BottomSheet open={open} onOpenChange={requestClose}>
        <BottomSheetContent
          aria-describedby={undefined}
          className="bg-material px-6"
        >
          <BottomSheetTitle className="sr-only">
            Voice recording
          </BottomSheetTitle>
          <span className="sr-only" role="status" aria-live="polite">
            {status}
          </span>

          <div className="flex flex-col items-center pt-2">
            <p className="text-subhead text-muted-foreground font-medium">
              New recording
            </p>
            <p
              role="timer"
              aria-label={`Elapsed ${formatClock(rec.elapsedMs)}`}
              className={cn(
                "text-foreground mt-1 text-[3.5rem] font-light tabular-nums leading-none tracking-tight",
                rec.state === "paused" && "text-muted-foreground",
              )}
            >
              {formatClock(rec.elapsedMs)}
            </p>
          </div>

          <div className="mt-5 h-24">
            <WaveformCanvas
              key={take}
              analyserRef={rec.analyserRef}
              recording={rec.state === "recording"}
            />
          </div>

          {/* One fixed-height status slot, so nothing moves between states. */}
          <div className="min-h-18 mt-4 flex flex-col items-center justify-start text-center">
            {view === "saving" ? (
              <>
                <p className="text-subhead text-muted-foreground">{status}</p>
                <div
                  className="bg-secondary mt-3 h-1 w-40 overflow-hidden rounded-full"
                  aria-hidden
                >
                  <div className="bg-primary motion-safe:animate-indeterminate h-full w-1/3 rounded-full" />
                </div>
              </>
            ) : view === "saved" ? (
              <p className="text-subhead text-foreground flex items-center gap-1.5 font-semibold">
                <Check className="text-primary size-5" aria-hidden />
                {status}
              </p>
            ) : view === "mic-error" ? (
              <>
                <p className="text-subhead text-foreground font-semibold">
                  {status}
                </p>
                <ul className="text-footnote text-muted-foreground mt-1.5 space-y-1 text-left">
                  {MIC_HELP[rec.micError!].steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p
                className={cn(
                  "text-subhead",
                  view === "failed"
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {status}
              </p>
            )}
          </div>

          {/* Controls: same 72px row in every state. */}
          <div className="h-18 mt-2 grid grid-cols-[1fr_auto_1fr] items-center">
            <div className="flex justify-start">
              {(live || view === "failed") && (
                <button
                  type="button"
                  onClick={() =>
                    hasAudio ? setConfirmDiscard(true) : discard()
                  }
                  aria-label="Discard recording"
                  className={buttonVariants({
                    variant: "quiet",
                    size: "icon-lg",
                  })}
                >
                  <Trash2 />
                </button>
              )}
              {(view === "mic-error" || view === "saved") && (
                <button
                  type="button"
                  onClick={() => requestClose(false)}
                  aria-label="Close"
                  className={buttonVariants({
                    variant: "quiet",
                    size: "icon-lg",
                  })}
                >
                  <X />
                </button>
              )}
            </div>

            {view === "saved" && savedEntryId ? (
              <div className="flex items-center gap-2">
                <Button asChild size="lg" className="px-6">
                  <PrefetchLink
                    href={`/entries/${savedEntryId}`}
                    onClick={() => requestClose(false)}
                  >
                    Open entry
                  </PrefetchLink>
                </Button>
              </div>
            ) : view === "failed" ? (
              <Button size="lg" className="px-6" onClick={rec.retryUpload}>
                <RotateCcw />
                Try again
              </Button>
            ) : view === "mic-error" ? (
              <Button size="lg" className="px-6" onClick={begin}>
                <RotateCcw />
                Try again
              </Button>
            ) : (
              <RecordControl
                recording={live}
                disabled={
                  view === "permission" ||
                  view === "starting" ||
                  view === "saving"
                }
                label={live ? "Stop and save recording" : "Start recording"}
                onPress={() => {
                  if (live) {
                    haptic("tap");
                    rec.finish();
                  } else {
                    begin();
                  }
                }}
              />
            )}

            <div className="flex justify-end">
              {live && (
                <button
                  type="button"
                  onClick={rec.state === "recording" ? rec.pause : rec.resume}
                  aria-label={rec.state === "recording" ? "Pause" : "Resume"}
                  className={buttonVariants({
                    variant: "secondary",
                    size: "icon-lg",
                  })}
                >
                  {rec.state === "recording" ? (
                    <Pause className="fill-current" />
                  ) : (
                    <Play className="fill-current" />
                  )}
                </button>
              )}
              {view === "saved" && (
                <Button
                  variant="ghost"
                  size="default"
                  onClick={() => requestClose(false)}
                >
                  Done
                </Button>
              )}
            </div>
          </div>
        </BottomSheetContent>
      </BottomSheet>

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
              {rec.uploadFailed ? "Keep" : "Keep recording"}
            </Button>
            <Button variant="destructive" onClick={discard}>
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
