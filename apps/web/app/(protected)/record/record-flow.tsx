"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Play } from "lucide-react";
import {
  WaveformVisualizer,
  cn,
  toast,
  type RecordButtonState,
} from "@mindreva/ui";
import { queueTranscriptionWatch } from "@/lib/transcription-watch";

const SOFT_WARNING_MS = 5 * 60 * 1000;
const HARD_STOP_MS = 10 * 60 * 1000;
const WAVEFORM_BARS = 28;
const AMPLITUDE_UPDATE_INTERVAL_MS = 80;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
  ];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "";
}

function formatTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const statusCopy: Record<RecordButtonState, string> = {
  idle: "Ready to record",
  preparing: "Getting the microphone ready…",
  recording: "Recording",
  paused: "Paused",
  processing: "Uploading and transcribing…",
};

export function RecordFlow() {
  const router = useRouter();

  const [state, setState] = React.useState<RecordButtonState>("preparing");
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [amplitudes, setAmplitudes] = React.useState<number[]>(() =>
    new Array(WAVEFORM_BARS).fill(0.1),
  );
  const [micError, setMicError] = React.useState<string | null>(null);
  const [uploadFailed, setUploadFailed] = React.useState(false);

  const streamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const mimeTypeRef = React.useRef<string>("");
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const lastAmplitudeTickRef = React.useRef(0);

  const segmentStartRef = React.useRef(0);
  const accumulatedMsRef = React.useRef(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const warnedRef = React.useRef(false);
  const cancelledRef = React.useRef(false);
  const finishedBlobRef = React.useRef<{
    blob: Blob;
    durationMs: number;
  } | null>(null);

  const stopTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopAmplitudeLoop = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const teardownMedia = React.useCallback(() => {
    stopTimer();
    stopAmplitudeLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;
  }, [stopAmplitudeLoop, stopTimer]);

  const runAmplitudeLoop = React.useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = (time: number) => {
      if (!analyserRef.current) return;
      if (time - lastAmplitudeTickRef.current >= AMPLITUDE_UPDATE_INTERVAL_MS) {
        lastAmplitudeTickRef.current = time;
        analyser.getByteFrequencyData(data);
        const bucketSize = Math.floor(data.length / WAVEFORM_BARS) || 1;
        const next: number[] = [];
        for (let i = 0; i < WAVEFORM_BARS; i++) {
          let sum = 0;
          for (let j = 0; j < bucketSize; j++)
            sum += data[i * bucketSize + j] ?? 0;
          next.push(Math.min(1, sum / bucketSize / 255));
        }
        setAmplitudes(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startTimer = React.useCallback(() => {
    segmentStartRef.current = Date.now();
    stopTimer();
    timerRef.current = setInterval(() => {
      const elapsed =
        accumulatedMsRef.current + (Date.now() - segmentStartRef.current);
      setElapsedMs(elapsed);

      if (elapsed >= HARD_STOP_MS) {
        finish();
      } else if (elapsed >= SOFT_WARNING_MS && !warnedRef.current) {
        warnedRef.current = true;
        toast("5 minutes in. Shorter recordings transcribe fastest.");
      }
    }, 250);
  }, [stopTimer]);

  const uploadRecording = React.useCallback(
    async (blob: Blob, durationMs: number) => {
      setState("processing");
      const form = new FormData();
      form.set("audio", blob, "recording");
      form.set("durationMs", String(Math.round(durationMs)));
      form.set("type", "journal");

      try {
        const res = await fetch("/api/recordings", {
          method: "POST",
          body: form,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = (await res.json()) as { entryId: string };
        setUploadFailed(false);
        // The upload response returns as soon as the audio is stored and the
        // entry exists — transcription runs in the background from here on
        // (see createVoiceEntry's after() call). Don't make the user wait on
        // a review screen for it: go straight home, and queue this entry for
        // the journal list's own background poll to toast once it's done.
        queueTranscriptionWatch(data.entryId);
        toast.success("Recording saved. Transcribing in the background…");
        router.push("/journal");
      } catch {
        setUploadFailed(true);
        toast.error("Couldn't upload your recording. You can retry below.");
      }
    },
    [router],
  );

  const start = React.useCallback(async () => {
    setMicError(null);
    setState("preparing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      mimeTypeRef.current = mimeType;
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeTypeRef.current || "audio/webm",
        });
        const durationMs =
          accumulatedMsRef.current + (Date.now() - segmentStartRef.current);
        teardownMedia();
        if (cancelledRef.current) return;
        finishedBlobRef.current = { blob, durationMs };
        void uploadRecording(blob, durationMs);
      };

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioContext = new AudioCtx();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      recorder.start(250);
      accumulatedMsRef.current = 0;
      setElapsedMs(0);
      warnedRef.current = false;
      setState("recording");
      startTimer();
      runAmplitudeLoop();
    } catch {
      setMicError(
        "Couldn't access your microphone. Check your browser's permission settings and try again.",
      );
    }
  }, [runAmplitudeLoop, startTimer, teardownMedia, uploadRecording]);

  const pause = React.useCallback(() => {
    if (state !== "recording") return;
    recorderRef.current?.pause();
    accumulatedMsRef.current += Date.now() - segmentStartRef.current;
    stopTimer();
    setState("paused");
  }, [state, stopTimer]);

  const resume = React.useCallback(() => {
    if (state !== "paused") return;
    recorderRef.current?.resume();
    setState("recording");
    startTimer();
  }, [state, startTimer]);

  function finish() {
    setState("processing");
    cancelledRef.current = false;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  const cancel = React.useCallback(() => {
    cancelledRef.current = true;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    } else {
      teardownMedia();
    }
    router.push("/journal");
  }, [router, teardownMedia]);

  const retryUpload = React.useCallback(() => {
    if (!finishedBlobRef.current) return;
    setUploadFailed(false);
    void uploadRecording(
      finishedBlobRef.current.blob,
      finishedBlobRef.current.durationMs,
    );
  }, [uploadRecording]);

  // Auto-start on mount. Intentionally empty deps — this must run exactly
  // once; including start/teardownMedia would re-trigger it on every render
  // since those callbacks are recreated as state changes during recording.
  React.useEffect(() => {
    void start();
    return () => teardownMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before an accidental tab close/refresh while actively recording.
  React.useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (state === "recording" || state === "paused") {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state]);

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
            onClick={() => void start()}
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
            {formatTimer(elapsedMs)}
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
            onClick={retryUpload}
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
              onClick={state === "recording" ? pause : resume}
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
              onClick={live ? finish : undefined}
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
