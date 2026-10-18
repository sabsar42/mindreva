import { describe, expect, it } from "vitest";
import {
  localDayKey,
  moriLine,
  moriMood,
  weekMood,
  type MoriContext,
} from "./mori-mood";

const base: MoriContext = {
  phase: "idle",
  forming: false,
  celebrating: false,
  week: { days: 4, recordings: 2, isCurrent: true },
  todayRecordings: 0,
  hour: 14,
};
const ctx = (over: Partial<MoriContext>): MoriContext => ({ ...base, ...over });

describe("weekMood", () => {
  it("maps activity to a mood", () => {
    expect(weekMood(0, 0)).toBe("sleepy");
    expect(weekMood(1, 0)).toBe("calm");
    expect(weekMood(2, 1)).toBe("calm");
    expect(weekMood(3, 0)).toBe("happy");
    expect(weekMood(1, 2)).toBe("happy");
    expect(weekMood(5, 0)).toBe("thriving");
    expect(weekMood(2, 4)).toBe("thriving");
  });
});

describe("moriMood: what the user is doing wins", () => {
  it("listens while recording, whatever the week or hour", () => {
    expect(moriMood(ctx({ phase: "recording", hour: 3 }))).toBe("listening");
  });
  it("is calm while paused, thinks while saving", () => {
    expect(moriMood(ctx({ phase: "paused" }))).toBe("calm");
    expect(moriMood(ctx({ phase: "processing" }))).toBe("thinking");
  });
  it("thinks while a memory forms, celebrates when one finishes", () => {
    expect(moriMood(ctx({ forming: true }))).toBe("thinking");
    expect(moriMood(ctx({ celebrating: true }))).toBe("celebrating");
  });
  it("lets a new recording interrupt a celebration", () => {
    expect(moriMood(ctx({ celebrating: true, phase: "recording" }))).toBe(
      "listening",
    );
  });
});

describe("moriMood: the week on screen", () => {
  it("is calm before the strip has reported", () => {
    expect(moriMood(ctx({ week: null }))).toBe("calm");
  });
  it("uses only the week for past weeks, ignoring today and the hour", () => {
    const past = { days: 6, recordings: 5, isCurrent: false };
    expect(moriMood(ctx({ week: past, hour: 2, todayRecordings: 0 }))).toBe(
      "thriving",
    );
    expect(
      moriMood(ctx({ week: { days: 0, recordings: 0, isCurrent: false } })),
    ).toBe("sleepy");
  });
});

describe("moriMood: today, in the current week", () => {
  const quiet = { days: 1, recordings: 0, isCurrent: true };
  it("lifts Mori once something was recorded today", () => {
    expect(moriMood(ctx({ week: quiet, todayRecordings: 1 }))).toBe("happy");
    expect(moriMood(ctx({ week: quiet, todayRecordings: 3 }))).toBe("thriving");
  });
  it("never lowers a better week mood because of one recording", () => {
    const great = { days: 6, recordings: 6, isCurrent: true };
    expect(moriMood(ctx({ week: great, todayRecordings: 1 }))).toBe("thriving");
  });
  it("sleeps late at night when nothing was recorded", () => {
    expect(moriMood(ctx({ hour: 23 }))).toBe("sleepy");
    expect(moriMood(ctx({ hour: 2 }))).toBe("sleepy");
    expect(moriMood(ctx({ hour: 23, todayRecordings: 1 }))).toBe("happy");
  });
  it("nudges gently on a quiet evening after a good week", () => {
    expect(moriMood(ctx({ hour: 19 }))).toBe("calm");
    const meh = { days: 1, recordings: 0, isCurrent: true };
    expect(moriMood(ctx({ week: meh, hour: 19 }))).toBe("calm");
  });
  it("leaves the daytime week mood alone", () => {
    expect(moriMood(ctx({ hour: 11 }))).toBe("happy");
  });
});

describe("moriLine", () => {
  it("describes the week", () => {
    const c = ctx({});
    expect(moriLine("happy", c)).toEqual({
      title: "Nice rhythm",
      detail: "4 active days · 2 recordings",
    });
  });
  it("uses singular forms", () => {
    const c = ctx({ week: { days: 1, recordings: 1, isCurrent: true } });
    expect(moriLine("calm", c).detail).toBe("1 active day · 1 recording");
  });
  it("explains the evening nudge and the night nap", () => {
    expect(moriLine("calm", ctx({ hour: 19 })).title).toBe("A quiet evening");
    expect(moriLine("sleepy", ctx({ hour: 23 })).title).toBe("Shh, it's late");
  });
  it("tells saving apart from forming", () => {
    expect(moriLine("thinking", ctx({ phase: "processing" })).title).toBe(
      "Saving your recording",
    );
    expect(moriLine("thinking", ctx({ forming: true })).title).toBe(
      "Shaping your memory",
    );
  });
});

describe("localDayKey", () => {
  it("formats the local calendar day", () => {
    expect(localDayKey(new Date(2026, 9, 5))).toBe("2026-10-05");
  });
});
