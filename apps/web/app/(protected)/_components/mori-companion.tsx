"use client";

import * as React from "react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTitle,
  Mori,
  SettingsRow,
  Switch,
  cn,
  type MoriMood,
} from "@mindreva/ui";
import { moriLine, type MoriContext } from "@/lib/mori-mood";

const HOLD_MS = 600;
const BUBBLE_MS = 3500;
const HOVER_COOLDOWN_MS = 2500;
const QUIET_KEY = "mindreva:mori-quiet";

/** Quiet mode: Mori keeps its expressions but stays still. A per-device
 * preference, read after mount so the server render never disagrees. */
function useQuietMode() {
  const [quiet, setQuiet] = React.useState(false);
  React.useEffect(() => {
    try {
      setQuiet(window.localStorage.getItem(QUIET_KEY) === "1");
    } catch {
      /* storage unavailable: default to animated */
    }
  }, []);
  const set = React.useCallback((value: boolean) => {
    setQuiet(value);
    try {
      window.localStorage.setItem(QUIET_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);
  return [quiet, set] as const;
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="bg-secondary rounded-2xl px-3 py-2.5">
      <p className="text-foreground text-xl font-bold tabular-nums leading-tight">
        {value}
      </p>
      <p className="text-muted-foreground mt-0.5 text-xs">{label}</p>
    </div>
  );
}

/**
 * Mori in the header. Three separate interactions, deliberately not mixed:
 *
 *  - hover (mouse): Mori hops, once in a while. Nothing opens.
 *  - tap: a small speech bubble says what Mori is feeling and why.
 *  - press and hold: a sheet with today at a glance and the quiet-mode option.
 *
 * Mood and context come from the parent; this component only presents them.
 */
export function MoriCompanion({
  mood,
  context,
  streak,
  className,
}: {
  mood: MoriMood;
  context: MoriContext;
  streak: number;
  className?: string;
}) {
  const [quiet, setQuiet] = useQuietMode();
  const [bubble, setBubble] = React.useState(false);
  const [sheet, setSheet] = React.useState(false);
  const [holding, setHolding] = React.useState(false);
  const [nudge, setNudge] = React.useState(0);
  const press = React.useRef({
    timer: null as ReturnType<typeof setTimeout> | null,
    held: false,
    x: 0,
    y: 0,
  });
  const bubbleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHover = React.useRef(0);
  const line = moriLine(mood, context);

  function cancelHold() {
    if (press.current.timer) clearTimeout(press.current.timer);
    press.current.timer = null;
    setHolding(false);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button > 0) return;
    const p = press.current;
    p.held = false;
    p.x = e.clientX;
    p.y = e.clientY;
    setHolding(true);
    p.timer = setTimeout(() => {
      p.held = true;
      p.timer = null;
      setHolding(false);
      setBubble(false);
      setSheet(true);
    }, HOLD_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = press.current;
    if (Math.abs(e.clientX - p.x) > 10 || Math.abs(e.clientY - p.y) > 10) {
      cancelHold();
    }
  }

  function onClick() {
    // The click that ends a long press must not also open the bubble.
    if (press.current.held) {
      press.current.held = false;
      return;
    }
    setNudge((n) => n + 1);
    setBubble(true);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(false), BUBBLE_MS);
  }

  function onPointerEnter(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    const now = Date.now();
    if (now - lastHover.current < HOVER_COOLDOWN_MS) return;
    lastHover.current = now;
    setNudge((n) => n + 1);
  }

  // Tapping anywhere else dismisses the bubble.
  React.useEffect(() => {
    if (!bubble) return;
    const close = () => setBubble(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [bubble]);

  React.useEffect(
    () => () => {
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
      if (press.current.timer) clearTimeout(press.current.timer);
    },
    [],
  );

  return (
    <div className={cn("relative shrink-0", className)}>
      <button
        type="button"
        aria-label={`Mori. ${line.title}. ${line.detail} Tap for details, press and hold for options.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onPointerLeave={cancelHold}
        onPointerEnter={onPointerEnter}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={cn(
          "bg-accent/45 focus-visible:ring-ring size-15 flex touch-manipulation select-none items-center justify-center rounded-full transition-[transform,background-color] duration-[600ms] ease-linear [-webkit-touch-callout:none] focus-visible:outline-none focus-visible:ring-2",
          holding && "bg-accent/80 scale-90",
        )}
      >
        <Mori mood={mood} still={quiet} pulse={nudge} className="size-[54px]" />
      </button>

      {bubble && (
        <div
          role="status"
          className="bg-card border-border shadow-elevated animate-pop-in absolute left-0 top-[68px] z-30 w-max max-w-[260px] rounded-2xl border px-3.5 py-2.5"
        >
          <span
            aria-hidden
            className="bg-card border-border absolute -top-1.5 left-6 size-2.5 rotate-45 border-l border-t"
          />
          <b className="text-foreground block text-sm font-bold">
            {line.title}
          </b>
          {line.detail && (
            <span className="text-muted-foreground mt-0.5 block text-[12.5px] leading-snug">
              {line.detail}
            </span>
          )}
        </div>
      )}

      <BottomSheet open={sheet} onOpenChange={setSheet}>
        <BottomSheetContent aria-describedby={undefined}>
          <BottomSheetTitle>Mori</BottomSheetTitle>
          <div className="mt-3 flex items-center gap-4">
            <div className="bg-accent/45 flex size-20 shrink-0 items-center justify-center rounded-full">
              <Mori mood={mood} still={quiet} className="size-[72px]" />
            </div>
            <div className="min-w-0">
              <p className="text-foreground text-lg font-bold leading-snug">
                {line.title}
              </p>
              {line.detail && (
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {line.detail}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat value={context.todayRecordings} label="Today" />
            <Stat value={streak} label="Day streak" />
            <Stat
              value={context.week?.days ?? 0}
              label={
                context.week?.isCurrent === false ? "That week" : "This week"
              }
            />
          </div>

          <div className="border-border bg-card mt-5 overflow-hidden rounded-2xl border">
            <SettingsRow
              title="Quiet mode"
              description="Mori keeps its expressions but stays still."
              trailing={
                <Switch
                  checked={quiet}
                  onCheckedChange={setQuiet}
                  aria-label="Quiet mode"
                />
              }
            />
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
