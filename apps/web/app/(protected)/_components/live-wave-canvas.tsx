"use client";

import * as React from "react";

const MAX_BARS = 24;
const MIN_BARS = 8;
const BAR_WIDTH = 3;
/** Keeps bars from merging into a block when the slot is narrow. */
const MIN_GAP = 2;
const MIN_LEVEL = 0.14;

/** As many bars as fit with at least MIN_GAP between them. */
function barCount(width: number): number {
  return Math.max(
    MIN_BARS,
    Math.min(MAX_BARS, Math.floor((width + MIN_GAP) / (BAR_WIDTH + MIN_GAP))),
  );
}

/** Per-bar weights so the waveform peaks in the middle and tapers at the
 * edges, the way a voice-memo waveform reads, instead of a flat comb. */
function weightsFor(bars: number): number[] {
  return Array.from({ length: bars }, (_, i) => {
    const t = bars === 1 ? 0.5 : i / (bars - 1);
    return 0.45 + 0.55 * Math.sin(Math.PI * t);
  });
}

/**
 * The live level meter, drawn on a canvas straight from the AnalyserNode
 * every animation frame — no React state, so recording never re-renders the
 * screen. Draws in the element's text colour (the theme's tint). Stops while
 * the tab is hidden, and under reduced motion (or while paused) shows a
 * still, dimmed row of bars instead of moving ones.
 */
export function LiveWaveCanvas({
  analyserRef,
  active,
}: {
  analyserRef: React.RefObject<AnalyserNode | null>;
  /** Recording (moving) rather than paused (still). */
  active: boolean;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let bars = barCount(canvas.clientWidth);
    let weights = weightsFor(bars);
    let levels = new Float32Array(bars).fill(MIN_LEVEL);
    let data: Uint8Array<ArrayBuffer> | null = null;
    let frame = 0;

    const size = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const next = barCount(canvas.clientWidth);
      if (next !== bars) {
        bars = next;
        weights = weightsFor(bars);
        levels = new Float32Array(bars).fill(MIN_LEVEL);
      }
    };

    const moving = () =>
      active && !reduceMotion.matches && document.visibilityState === "visible";

    const draw = () => {
      frame = 0;
      const analyser = analyserRef.current;
      if (analyser && moving()) {
        if (!data || data.length !== analyser.frequencyBinCount) {
          data = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(data);
        const bucket = Math.max(1, Math.floor(data.length / bars));
        for (let i = 0; i < bars; i++) {
          let sum = 0;
          for (let j = 0; j < bucket; j++) sum += data[i * bucket + j] ?? 0;
          const target = Math.max(
            MIN_LEVEL,
            Math.min(1, (sum / bucket / 255) * 1.6 * weights[i]!),
          );
          // Rise fast, fall gently: reads as a voice, not as flicker.
          const current = levels[i]!;
          levels[i] =
            current + (target - current) * (target > current ? 0.55 : 0.18);
        }
      } else {
        levels.fill(MIN_LEVEL);
      }

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = getComputedStyle(canvas).color;
      ctx.globalAlpha = active ? 1 : 0.4;
      const gap = bars > 1 ? (w - bars * BAR_WIDTH) / (bars - 1) : 0;
      for (let i = 0; i < bars; i++) {
        const barH = Math.max(BAR_WIDTH, levels[i]! * h);
        const x = i * (BAR_WIDTH + gap);
        const y = (h - barH) / 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, BAR_WIDTH, barH, BAR_WIDTH / 2);
        else ctx.rect(x, y, BAR_WIDTH, barH);
        ctx.fill();
      }
      if (moving()) frame = requestAnimationFrame(draw);
    };

    const restart = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      draw();
    };
    size();
    draw();

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
  }, [active, analyserRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      // An explicit CSS width: a canvas's own size comes from its width
      // attribute, which is set from clientWidth, so without this it would
      // start (and stay) 0 px wide inside a flex row.
      className="text-primary block h-10 w-full min-w-0"
    />
  );
}
