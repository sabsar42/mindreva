"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Play } from "lucide-react";
import { WaveformVisualizer, cn, type RecordButtonState } from "@mindreva/ui";
import {
  formatRecorderTimer,
  useVoiceRecorder,
} from "@/lib/use-voice-recorder";

const statusCopy: Record<RecordButtonState, string> = {
  idle: "Ready to record",
  preparing: "Getting the microphone ready…",
  recording: "Recording",
  paused: "Paused",
  processing: "Uploading and transcribing…",
};

export function RecordFlow() {
  const router = useRouter();
  const recorder = useVoiceRecorder({
    entryType: "journal",
    onDone: () => router.push("/journal"),
  });
  const { state, elapsedMs, amplitudes, micError, uploadFailed } = recorder;

  // Auto-start on mount. Intentionally empty deps — this must run exactly
  // once; `recorder.start` is recreated as state changes during recording.
  React.useEffect(() => {
    void recorder.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cancel() {
    recorder.cancel();
    router.push("/journal");
  }

  if (micError) {
    return (
      <main className="mx-auto flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-foreground">{micError}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/journal")}
            className="text-muted-foreground text-sm font-semibold hover:underline"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={() => void recorder.start()}
            className="text-primary text-sm font-semibold hover:underline"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  const live = state === "recording" || state === "paused";
  const busy = state === "preparing" || state === "processing";

  return (
    <main className="motion-safe:animate-page-in mx-auto flex min-h-screen flex-col px-6 py-5">
      <header className="flex items-center justify-between">
        <span
          className={cn(
            "flex items-center gap-2 text-xs font-bold uppercase tracking-widest",
            state === "paused" ? "text-muted-foreground" : "text-destructive",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              state === "recording" &&
                "bg-destructive motion-safe:animate-pulse",
              state === "preparing" && "bg-warning motion-safe:animate-pulse",
              state === "paused" && "bg-muted-foreground",
              state === "processing" && "bg-primary motion-safe:animate-pulse",
            )}
          />
          {state === "paused"
            ? "Paused"
            : state === "processing"
              ? "Saving"
              : state === "preparing"
                ? "Getting ready"
                : "Live recording"}
        </span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-7">
        <div className="text-center">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
            Elapsed time
          </p>
          <div
            className="text-foreground mt-2 font-mono text-7xl font-bold tabular-nums tracking-tight"
            role="timer"
            aria-live="off"
          >
            {formatRecorderTimer(elapsedMs)}
          </div>
        </div>

        <WaveformVisualizer
          amplitudes={state === "recording" ? amplitudes : undefined}
          active={state === "recording"}
          className="text-primary w-full max-w-xs"
        />

        <div className="text-center">
          <p className="text-foreground text-lg font-bold tracking-tight">
            {statusCopy[state]}
          </p>
          <p className="text-muted-foreground mt-1 max-w-xs text-sm">
            Keep this screen open. Closing it ends the recording, and your
            transcript is ready to review once you finish.
          </p>
        </div>

        {uploadFailed && (
          <button
            type="button"
            onClick={recorder.retryUpload}
            className="text-primary text-sm font-semibold hover:underline"
          >
            Retry upload
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 pb-6">
        <div className="flex items-center justify-center gap-6">
          {live && (
            <button
              type="button"
              onClick={state === "recording" ? recorder.pause : recorder.resume}
              aria-label={state === "recording" ? "Pause" : "Resume"}
              className={cn(
                "border-border bg-card shadow-subtle press hover:bg-secondary focus-visible:ring-ring focus-visible:ring-offset-background flex size-14 items-center justify-center rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                state === "paused" ? "text-primary" : "text-foreground",
              )}
            >
              {state === "recording" ? (
                <Pause className="size-5 fill-current" />
              ) : (
                <Play className="size-5 fill-current" />
              )}
            </button>
          )}

          {/* Stop: a red square in a soft red halo, the universal "end" mark.
              Disabled (spinner) while the mic warms up or the upload runs. */}
          <div className="bg-destructive/10 flex size-28 items-center justify-center rounded-full">
            <button
              type="button"
              onClick={live ? recorder.finish : undefined}
              disabled={!live}
              aria-label="Stop and save recording"
              className="bg-gradient-danger shadow-elevated press focus-visible:ring-ring focus-visible:ring-offset-background flex size-20 items-center justify-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4 disabled:cursor-default"
            >
              {busy ? (
                <Loader2 className="size-7 animate-spin" />
              ) : (
                <span className="size-6 rounded-md bg-white" />
              )}
            </button>
          </div>
        </div>

        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
          {live ? "Tap to stop & save" : "Please wait"}
        </p>
        <button
          type="button"
          onClick={cancel}
          disabled={state === "processing"}
          className="text-muted-foreground hover:text-foreground text-sm font-medium underline underline-offset-4 disabled:opacity-40"
        >
          Discard recording
        </button>
      </div>
    </main>
  );
}
