"use client";

import * as React from "react";
import { toast } from "@mindreva/ui";
import type { EntryType } from "@mindreva/database";

export type RecorderState =
  "idle" | "preparing" | "recording" | "paused" | "processing";

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

export function formatRecorderTimer(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * The real MediaRecorder lifecycle (start/pause/resume/stop, waveform
 * amplitudes, soft/hard stop timers, upload) shared between the dedicated
 * /record page and the inline recorder on the journal screen — one
 * implementation, not two parallel copies of the same MediaRecorder wiring.
 */
export function useVoiceRecorder({
  entryType,
  onDone,
}: {
  entryType: EntryType;
  /** The audio is uploaded and the entry exists. */
  onDone: (entryId: string, durationMs: number) => void;
}) {
  const [state, setState] = React.useState<RecorderState>("idle");
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
  const pausedRef = React.useRef(false);
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
      form.set("type", entryType);

      try {
        const res = await fetch("/api/recordings", {
          method: "POST",
          body: form,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = (await res.json()) as { entryId: string };
        setUploadFailed(false);
        setState("idle");
        setElapsedMs(0);
        onDone(data.entryId, durationMs);
      } catch {
        setUploadFailed(true);
        toast.error("Couldn't upload your recording. You can retry below.");
      }
    },
    [entryType, onDone],
  );

  const start = React.useCallback(async () => {
    setMicError(null);
    setUploadFailed(false);
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
        // While paused, the open segment was already folded into
        // accumulatedMsRef, so the paused gap must not be added again.
        const durationMs =
          accumulatedMsRef.current +
          (pausedRef.current ? 0 : Date.now() - segmentStartRef.current);
        pausedRef.current = false;
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
      setState("idle");
    }
  }, [runAmplitudeLoop, startTimer, teardownMedia, uploadRecording]);

  const pause = React.useCallback(() => {
    if (state !== "recording") return;
    recorderRef.current?.pause();
    pausedRef.current = true;
    accumulatedMsRef.current += Date.now() - segmentStartRef.current;
    stopTimer();
    setState("paused");
  }, [state, stopTimer]);

  const resume = React.useCallback(() => {
    if (state !== "paused") return;
    recorderRef.current?.resume();
    pausedRef.current = false;
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
    finishedBlobRef.current = null;
    setUploadFailed(false);
    setMicError(null);
    setState("idle");
    setElapsedMs(0);
  }, [teardownMedia]);

  const retryUpload = React.useCallback(() => {
    if (!finishedBlobRef.current) return;
    setUploadFailed(false);
    void uploadRecording(
      finishedBlobRef.current.blob,
      finishedBlobRef.current.durationMs,
    );
  }, [uploadRecording]);

  // Navigating away mid-recording (a nav icon, a swipe) saves rather than
  // drops the audio: stopping fires onstop, which tears down the mic and
  // uploads. Discard sets cancelledRef first, so a discarded take stays gone.
  React.useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      } else {
        teardownMedia();
      }
    };
  }, [teardownMedia]);

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

  return {
    state,
    elapsedMs,
    amplitudes,
    micError,
    uploadFailed,
    start,
    pause,
    resume,
    finish,
    cancel,
    retryUpload,
  };
}
