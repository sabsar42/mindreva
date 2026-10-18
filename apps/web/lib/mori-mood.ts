import type { MoriMood } from "@mindreva/ui";

/**
 * What decides Mori's face. Pure, so every rule is testable and the same
 * inputs always give the same mood.
 *
 *   1. What the user is doing right now wins: recording, saving, a memory
 *      forming, a memory just finished.
 *   2. Otherwise the week on screen sets the base mood, from how many days
 *      had any activity and how many recordings there were.
 *   3. For the current week, today adjusts it: recording today lifts Mori, a
 *      quiet late night puts Mori to sleep, and a quiet evening after a good
 *      week gets a gentle, unpushy nudge.
 */

export type RecorderPhase = "idle" | "recording" | "paused" | "processing";

export interface MoriContext {
  phase: RecorderPhase;
  /** A memory is being transcribed or written right now. */
  forming: boolean;
  /** A memory finished forming a moment ago. */
  celebrating: boolean;
  /** The week on screen (null until the strip has reported). */
  week: { days: number; recordings: number; isCurrent: boolean } | null;
  /** Recordings made today. */
  todayRecordings: number;
  /** Local hour, 0-23. */
  hour: number;
}

type WeekMood = "sleepy" | "calm" | "happy" | "thriving";
const ORDER: WeekMood[] = ["sleepy", "calm", "happy", "thriving"];

export function weekMood(days: number, recordings: number): WeekMood {
  if (days === 0) return "sleepy";
  if (days >= 5 || recordings >= 4) return "thriving";
  if (days >= 3 || recordings >= 2) return "happy";
  return "calm";
}

const atLeast = (mood: WeekMood, min: WeekMood): WeekMood =>
  ORDER.indexOf(mood) >= ORDER.indexOf(min) ? mood : min;

export const isNight = (hour: number): boolean => hour >= 22 || hour < 5;
export const isEvening = (hour: number): boolean => hour >= 18 && hour < 22;

export function moriMood(ctx: MoriContext): MoriMood {
  if (ctx.phase === "recording") return "listening";
  if (ctx.phase === "paused") return "calm";
  if (ctx.phase === "processing") return "thinking";
  if (ctx.celebrating) return "celebrating";
  if (ctx.forming) return "thinking";
  if (!ctx.week) return "calm";

  const base = weekMood(ctx.week.days, ctx.week.recordings);
  if (!ctx.week.isCurrent) return base;

  if (ctx.todayRecordings >= 3) return "thriving";
  if (ctx.todayRecordings >= 1) return atLeast(base, "happy");
  if (isNight(ctx.hour)) return "sleepy";
  if (isEvening(ctx.hour) && ORDER.indexOf(base) >= ORDER.indexOf("happy")) {
    return "calm";
  }
  return base;
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export function weekStats(week: { days: number; recordings: number }): string {
  return `${plural(week.days, "active day", "active days")} · ${plural(
    week.recordings,
    "recording",
    "recordings",
  )}`;
}

/** What Mori says when tapped: a short title and one line of detail. */
export function moriLine(
  mood: MoriMood,
  ctx: MoriContext,
): { title: string; detail: string } {
  const stats = ctx.week ? weekStats(ctx.week) : "";
  switch (mood) {
    case "listening":
      return { title: "I'm listening", detail: "Take your time." };
    case "thinking":
      return ctx.phase === "processing"
        ? { title: "Saving your recording", detail: "Just a moment." }
        : {
            title: "Shaping your memory",
            detail: "I'm turning that into a card.",
          };
    case "celebrating":
      return { title: "A new memory", detail: "It's ready. Tap it to open." };
    case "sleepy":
      return ctx.week?.isCurrent && isNight(ctx.hour)
        ? { title: "Shh, it's late", detail: "Rest. Tomorrow is a fresh page." }
        : {
            title: "A quiet week",
            detail: "Nothing yet. Say something today?",
          };
    case "calm":
      return ctx.week?.isCurrent &&
        isEvening(ctx.hour) &&
        ctx.todayRecordings === 0
        ? {
            title: "A quiet evening",
            detail: "Nothing recorded today. A minute is plenty.",
          }
        : { title: "A gentle week", detail: stats };
    case "happy":
      return { title: "Nice rhythm", detail: stats };
    case "thriving":
      return { title: "On a roll", detail: stats };
  }
}

/** Local calendar day as the activity data keys it. */
export function localDayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
