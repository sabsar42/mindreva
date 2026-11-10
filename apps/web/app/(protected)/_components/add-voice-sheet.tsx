"use client";

import * as React from "react";
import { Loader2, RotateCcw, Square, X } from "lucide-react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
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
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import { LiveWaveCanvas } from "./live-wave-canvas";

const CONFIRM_DISCARD_AFTER_MS = 1000;

function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * A bottom sheet containing the recorder bar in addon mode. Uploaded audio
 * is added to an existing entry; the sheet closes as soon as the upload
 * succeeds and calls onUploaded so the entry detail can start polling for the
 * new transcript.
 */
export function AddVoiceSheet({
  entryId,
  open,
  onOpenChange,
  onUploaded,
}: {
  entryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the audio is uploaded (transcription continues in background). */
  onUploaded: () => void;
}) {
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);

  const onDone = React.useCallback(() => {
    onUploaded();
    onOpenChange(false);
  }, [onUploaded, onOpenChange]);

  const rec = useVoiceRecorder({
    entryType: "journal",
    addonEntryId: entryId,
    onDone,
  });

  const live = rec.state === "recording" || rec.state === "paused";
  const busy = rec.state === "preparing" || rec.state === "processing";

  const requestDiscard = () => {
    if (rec.elapsedMs < CONFIRM_DISCARD_AFTER_MS && !rec.uploadFailed) {
      rec.cancel();
    } else {
      setConfirmDiscard(true);
    }
  };

  // When the sheet closes while recording, cancel the active take.
  const handleOpenChange = (next: boolean) => {
    if (!next && (live || busy)) {
      requestDiscard();
      return;
    }
    if (!next) rec.cancel();
    onOpenChange(next);
  };

  return (
    <>
      <BottomSheet open={open} onOpenChange={handleOpenChange}>
        <BottomSheetContent className="flex flex-col gap-4 pb-2">
          <div>
            <BottomSheetTitle>Add a voice recording</BottomSheetTitle>
            <BottomSheetDescription className="text-muted-foreground text-sm">
              The transcript will be added as a new paragraph.
            </BottomSheetDescription>
          </div>

          {rec.state === "idle" && !rec.uploadFailed && !rec.micError ? (
            <button
              type="button"
              aria-label="Start recording"
              onClick={() => {
                haptic("tap");
                void rec.start();
              }}
              className={cn(
                "bg-card shadow-subtle border-border focus-visible:ring-ring h-19 flex w-full items-center gap-3 rounded-full border px-4 transition-[transform,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 active:scale-[0.97] active:opacity-90",
              )}
            >
              <span className="bg-primary text-primary-foreground flex size-12 shrink-0 items-center justify-center rounded-full">
                <LeafMark className="size-7" />
              </span>
              <span className="text-foreground min-w-0 flex-1 text-left text-base font-semibold">
                Tap to start recording
              </span>
            </button>
          ) : (
            <div
              role="group"
              aria-label="Voice recording"
              className={cn(
                "bg-card shadow-subtle border-primary/50 ring-primary/10 h-19 flex w-full items-center gap-2.5 rounded-full border pl-2.5 pr-2.5 ring-4",
                rec.state !== "idle" && "motion-safe:animate-scale-in",
              )}
            >
              {rec.micError ? (
                <>
                  <div className="min-w-0 flex-1 pl-2">
                    <p className="text-foreground text-footnote truncate font-semibold">
                      Couldn&apos;t start the microphone.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={rec.cancel}
                    aria-label="Dismiss"
                    className={buttonVariants({
                      variant: "quiet",
                      size: "icon",
                    })}
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
                            rec.state === "recording" &&
                              "motion-safe:animate-pulse",
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
                      onClick={
                        rec.state === "recording" ? rec.pause : rec.resume
                      }
                      aria-label={
                        rec.state === "recording" ? "Pause" : "Resume"
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
                      className={buttonVariants({
                        variant: "quiet",
                        size: "icon",
                      })}
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
                        size: "icon",
                        className:
                          "size-14 shrink-0 rounded-full [&_svg]:size-5",
                      })}
                    >
                      <Square className="fill-current" />
                    </button>
                  )}
                </>
              )}
            </div>
          )}
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
              {rec.uploadFailed ? "Keep it" : "Keep recording"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDiscard(false);
                rec.cancel();
                onOpenChange(false);
              }}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
