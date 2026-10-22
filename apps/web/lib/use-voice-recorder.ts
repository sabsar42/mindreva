"use client";

import * as React from "react";
import { toast } from "@mindreva/ui";
import type { EntryType } from "@mindreva/database";

export type RecorderState =
  "idle" | "preparing" | "recording" | "paused" | "processing";

/** Why the microphone couldn't start, so the message can say what to do. */
export type MicErrorKind =
  "denied" | "no-device" | "busy" | "unsupported" | "other";

const SOFT_WARNING_MS = 5 * 60 * 1000;
export const MAX_RECORDING_MS = 10 * 60 * 1000;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    // Safari records AAC in MP4.
    "audio/mp4",
    "audio/ogg",
  ];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return "";
}

function classifyMicError(err: unknown): MicErrorKind {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "no-device";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "other";
}

/** The screen-wake-lock API, where it exists (not in every browser). */
type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

/**
 * The MediaRecorder lifecycle behind the Journal's record bar: start, pause,
 * resume, stop, discard, the 5-minute heads-up and 10-minute cap, upload with
 * a kept copy for retry. The live level meter reads `analyserRef` directly
 * (see LiveWaveCanvas), so the audio level never goes through React state.
 *
 * Reliability:
 * - the screen is kept awake while recording, where the browser allows it;
 * - if the microphone goes away mid-take (a call, a device unplugged,
 *   permission revoked), what was recorded is saved instead of lost;
 * - leaving the screen mid-recording saves the take (unmount stops it);
 * - every microphone track is stopped when recording ends.
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
  const [micError, setMicError] = React.useState<MicErrorKind | null>(null);
  const [uploadFailed, setUploadFailed] = React.useState(false);
  /** The browser is showing (or about to show) its microphone prompt. */
  const [awaitingPermission, setAwaitingPermission] = React.useState(false);

  const streamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const mimeTypeRef = React.useRef<string>("");
  const audioContextRef = React.useRef<AudioContext | null>(null);
  /** Read every animation frame by the level meter; never React state. */
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const wakeLockRef = React.useRef<WakeLockSentinelLike | null>(null);

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

  const releaseWakeLock = React.useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  const requestWakeLock = React.useCallback(async () => {
    try {
      const nav = navigator as WakeLockNavigator;
      if (!nav.wakeLock || document.visibilityState !== "visible") return;
      wakeLockRef.current = await nav.wakeLock.request("screen");
    } catch {
      // Not allowed or not supported: recording still works, the screen
      // may just dim on its own schedule.
    }
  }, []);

  const teardownMedia = React.useCallback(() => {
    stopTimer();
    releaseWakeLock();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;
  }, [releaseWakeLock, stopTimer]);

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
        if (res.status === 413 || res.status === 429) {
          // Today's recording limit (429) or a take too large to upload
          // (413): calm, not an error. The take stays on screen.
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          setUploadFailed(true);
          toast(body?.error ?? "You can record again tomorrow.");
          return;
        }
        if (!res.ok) throw new Error("Upload failed");
        const data = (await res.json()) as { entryId: string };
        setUploadFailed(false);
        finishedBlobRef.current = null;
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

  const finish = React.useCallback(() => {
    setState("processing");
    cancelledRef.current = false;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  const startTimer = React.useCallback(() => {
    segmentStartRef.current = Date.now();
    stopTimer();
    timerRef.current = setInterval(() => {
      const elapsed =
        accumulatedMsRef.current + (Date.now() - segmentStartRef.current);
      setElapsedMs(elapsed);

      if (elapsed >= MAX_RECORDING_MS) {
        finish();
      } else if (elapsed >= SOFT_WARNING_MS && !warnedRef.current) {
        warnedRef.current = true;
        toast("5 minutes in. Shorter recordings transcribe fastest.");
      }
    }, 250);
  }, [finish, stopTimer]);

  const start = React.useCallback(async () => {
    setMicError(null);
    setUploadFailed(false);
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setMicError("unsupported");
      return;
    }
    setState("preparing");
    try {
      // Where the Permissions API knows about the microphone, say so before
      // the browser's own prompt appears ("Allow microphone access").
      try {
        const status = await navigator.permissions?.query({
          name: "microphone" as PermissionName,
        });
        setAwaitingPermission(status?.state === "prompt");
      } catch {
        // Not queryable here (older Safari, Firefox): no extra hint.
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAwaitingPermission(false);
      streamRef.current = stream;

      // The microphone can disappear mid-take: a phone call, the headset
      // unplugged, permission revoked. Save what was recorded.
      stream.getAudioTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          const r = recorderRef.current;
          if (r && r.state !== "inactive" && !cancelledRef.current) {
            toast("The microphone stopped, so your recording was saved.");
            finish();
          }
        });
      });

      const mimeType = pickMimeType();
      mimeTypeRef.current = mimeType;
      // 32 kbps is plenty for speech (transcription resamples to 16 kHz) and
      // keeps a 10-minute take ~2.4 MB, under the 4.5 MB upload ceiling.
      // Browser defaults (~128 kbps) would make takes over ~4 minutes fail.
      const options: MediaRecorderOptions = { audioBitsPerSecond: 32_000 };
      if (mimeType) options.mimeType = mimeType;
      const recorder = new MediaRecorder(stream, options);
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
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      recorder.start(250);
      accumulatedMsRef.current = 0;
      setElapsedMs(0);
      warnedRef.current = false;
      cancelledRef.current = false;
      setState("recording");
      startTimer();
      void requestWakeLock();
    } catch (err) {
      setAwaitingPermission(false);
      teardownMedia();
      setMicError(classifyMicError(err));
      setState("idle");
    }
  }, [finish, requestWakeLock, startTimer, teardownMedia, uploadRecording]);

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

  // A wake lock is released whenever the page is hidden; take it again when
  // the user comes back to a recording that is still running.
  React.useEffect(() => {
    if (state !== "recording" && state !== "paused") return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [state, requestWakeLock]);

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
    analyserRef,
    micError,
    uploadFailed,
    awaitingPermission,
    start,
    pause,
    resume,
    finish,
    cancel,
    retryUpload,
  };
}
