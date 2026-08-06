"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";
import {
  RecordButton,
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
        toast("5 minutes in — shorter recordings transcribe fastest.");
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
        toast.success("Recording saved — transcribing in the background…");
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

  const canControl = state === "recording" || state === "paused";
  // The big button always means "finish" while control is possible — even
  // when paused — so it keeps showing the stop-square visual rather than
  // RecordButton's built-in "paused = tap to resume" affordance, which would
  // contradict the separate pause/resume toggle rendered beside it.
  const bigButtonState: RecordButtonState =
    state === "paused" ? "recording" : state;
  const bigButtonLabel = state === "paused" ? "Tap to finish" : undefined;

  if (micError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
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

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-5">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={cancel}
          disabled={state === "processing"}
          className="text-foreground text-sm font-medium disabled:opacity-40"
        >
          Cancel
        </button>
        <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
          {state === "paused" ? "Paused" : "Recording"}
        </span>
        <span className="w-12" aria-hidden />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              state === "recording" && "bg-destructive animate-pulse",
              state === "preparing" && "bg-warning",
              state === "paused" && "bg-warm-400",
              state === "processing" && "bg-primary",
            )}
          />
          <span className="text-muted-foreground text-sm">
            {statusCopy[state]}
          </span>
        </div>

        <div className="text-foreground font-mono text-5xl tabular-nums">
          {formatTimer(elapsedMs)}
        </div>

        <WaveformVisualizer
          amplitudes={state === "recording" ? amplitudes : undefined}
          active={state === "recording"}
          className="w-full max-w-xs"
        />

        <p className="text-muted-foreground max-w-xs text-center text-sm">
          Keep this tab open — closing it ends the recording. Your transcript is
          ready to review once you finish.
        </p>

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

      <div className="flex items-center justify-center gap-6 pb-8">
        {canControl && (
          <button
            type="button"
            onClick={state === "recording" ? pause : resume}
            aria-label={state === "recording" ? "Pause" : "Resume"}
            className={cn(
              "border-border bg-card shadow-subtle hover:bg-warm-100 focus-visible:ring-ring focus-visible:ring-offset-background flex size-14 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
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
        <RecordButton
          state={bigButtonState}
          label={bigButtonLabel}
          onClick={canControl ? finish : undefined}
          size="lg"
        />
      </div>
    </main>
  );
}
