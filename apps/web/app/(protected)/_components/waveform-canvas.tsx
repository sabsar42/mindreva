"use client";

import * as React from "react";

const BAR_WIDTH = 3;
const BAR_GAP = 3;
/** A new bar enters from the right this often while recording. */
const SAMPLE_MS = 70;
const MIN_LEVEL = 0.04;

/**
 * The recorder's waveform, like Voice Memos: thin rounded bars, symmetrical
 * around a centre line, scrolling right to left as you speak. Drawn on a
 * canvas from the AnalyserNode every animation frame, never through React
 * state. Muted grey at rest and while paused (frozen), the tint while
 * recording. Stops drawing while the tab is hidden. Under reduced motion the
 * history doesn't scroll: a single centred level bar changes height instead.
 */
export function WaveformCanvas({
  analyserRef,
  recording,
  className,
}: {
  analyserRef: React.RefObject<AnalyserNode | null>;
  /** True while audio is being captured (moving); false at rest or paused. */
  recording: boolean;
  className?: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  // History survives a pause, so resuming continues the same line.
  const historyRef = React.useRef<number[]>([]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let data: Uint8Array<ArrayBuffer> | null = null;
    let frame = 0;
    let lastSample = performance.now();
    let level = MIN_LEVEL;

    const size = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /** Loudness right now (RMS of the waveform), 0..1, eased. */
    const readLevel = () => {
      const analyser = analyserRef.current;
      if (!analyser) return MIN_LEVEL;
      if (!data || data.length !== analyser.fftSize) {
        data = new Uint8Array(analyser.fftSize);
      }
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i]! - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const target = Math.max(MIN_LEVEL, Math.min(1, rms * 3.2));
      level += (target - level) * (target > level ? 0.6 : 0.25);
      return level;
    };

    const live = () => recording && document.visibilityState === "visible";

    const draw = (now: number) => {
      frame = 0;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const step = BAR_WIDTH + BAR_GAP;
      const maxBars = Math.ceil(w / step) + 2;
      const history = historyRef.current;

      if (live()) {
        const l = readLevel();
        while (now - lastSample >= SAMPLE_MS) {
          history.push(l);
          lastSample += SAMPLE_MS;
        }
        if (history.length > maxBars)
          history.splice(0, history.length - maxBars);
      } else {
        lastSample = now;
      }

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = getComputedStyle(canvas).color;
      const mid = h / 2;

      // Faint centre line, as in Voice Memos.
      ctx.globalAlpha = 0.25;
      ctx.fillRect(0, mid - 0.5, w, 1);
      ctx.globalAlpha = 1;

      const bar = (x: number, l: number) => {
        const barH = Math.max(BAR_WIDTH, l * (h - 4));
        ctx.beginPath();
        if (ctx.roundRect)
          ctx.roundRect(x, mid - barH / 2, BAR_WIDTH, barH, BAR_WIDTH / 2);
        else ctx.rect(x, mid - barH / 2, BAR_WIDTH, barH);
        ctx.fill();
      };

      if (reduceMotion.matches) {
        // No scrolling: one centred level bar.
        bar(w / 2 - BAR_WIDTH / 2, live() ? readLevel() : MIN_LEVEL);
      } else {
        // Newest bar at the right edge; the fraction of the current sample
        // slides everything left smoothly between samples.
        const offset = live() ? ((now - lastSample) / SAMPLE_MS) * step : 0;
        for (let i = 0; i < history.length; i++) {
          const x = w - (history.length - i) * step - offset + step;
          if (x < -BAR_WIDTH) continue;
          bar(x, history[i]!);
        }
      }

      if (live()) frame = requestAnimationFrame(draw);
    };

    const restart = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastSample = performance.now();
      draw(lastSample);
    };
    size();
    restart();

    const resize = new ResizeObserver(() => {
      size();
      restart();
    });
    resize.observe(canvas);
    document.addEventListener("visibilitychange", restart);
    reduceMotion.addEventListener("change", restart);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      resize.disconnect();
      document.removeEventListener("visibilitychange", restart);
      reduceMotion.removeEventListener("change", restart);
    };
  }, [recording, analyserRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={
        className ??
        `block h-24 w-full transition-colors duration-300 ${
          recording ? "text-primary" : "text-muted-foreground"
        }`
      }
    />
  );
}
