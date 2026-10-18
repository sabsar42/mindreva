"use client";

import * as React from "react";

/**
 * Memories that are being made right now, shared across the app.
 *
 * A voice entry goes through two real steps after the upload: the recording is
 * transcribed (the server does this in the background), then the transcript is
 * turned into a memory (title, summary, tasks). This store drives both from
 * the client and reports what actually happened, step by step, so a card on
 * the Journal can show the true state instead of a generic spinner.
 *
 * It is a module-level store, not React state, on purpose: the work carries on
 * if the user navigates to another tab, and the card is still there, at the
 * right stage, when they come back.
 */

export type FormingPhase =
  | "transcribing" // the recording is being turned into text
  | "writing" // the transcript is being turned into a memory
  | "ready" // the memory exists; waiting for the list to pick it up
  | "settled" // it is in the list; the green treatment is draining out
  | "failed";

export interface FormingMemory {
  id: string;
  createdAt: number;
  durationMs: number;
  phase: FormingPhase;
  /** The transcript, once it exists. */
  text: string;
  /** Why it failed, in words for the user. */
  failure?: string;
}

const POLL_MS = 1500;
const STALL_MS = 150_000;
const SUMMARIZE_TIMEOUT_MS = 90_000;
const SETTLE_MS = 1300;
const FAILED_VISIBLE_MS = 6000;

const EMPTY: FormingMemory[] = [];
let items: FormingMemory[] = EMPTY;
let owner: string | null = null;
const listeners = new Set<() => void>();
const running = new Set<string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit(next: FormingMemory[]) {
  items = next;
  listeners.forEach((l) => l());
}
function patch(id: string, change: Partial<FormingMemory>) {
  if (!items.some((m) => m.id === id)) return;
  emit(items.map((m) => (m.id === id ? { ...m, ...change } : m)));
}
function remove(id: string) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
  running.delete(id);
  emit(items.filter((m) => m.id !== id));
}
function later(id: string, ms: number, fn: () => void) {
  const prev = timers.get(id);
  if (prev) clearTimeout(prev);
  timers.set(id, setTimeout(fn, ms));
}

function fail(id: string, failure: string) {
  patch(id, { phase: "failed", failure });
  later(id, FAILED_VISIBLE_MS, () => remove(id));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run(id: string) {
  if (running.has(id)) return;
  running.add(id);
  const startedAt = Date.now();

  // 1. Wait for the transcript, reporting nothing until it is really done.
  let text = "";
  for (;;) {
    if (!items.some((m) => m.id === id)) return;
    if (Date.now() - startedAt > STALL_MS) {
      return fail(
        id,
        "Still transcribing. It will appear in your journal shortly.",
      );
    }
    try {
      const res = await fetch(`/api/entries/${id}/transcript`);
      if (res.ok) {
        const data = (await res.json()) as {
          status: "pending" | "processing" | "done" | "failed";
          rawText: string | null;
          editedText: string | null;
        };
        if (data.status === "failed") {
          return fail(id, "Couldn't transcribe that. The recording is saved.");
        }
        if (data.status === "done") {
          text = (data.editedText ?? data.rawText ?? "").trim();
          break;
        }
      }
    } catch {
      // A single failed check isn't fatal; keep polling.
    }
    await sleep(POLL_MS);
  }

  if (!text) return fail(id, "Couldn't hear anything in that recording.");
  patch(id, { phase: "writing", text: text.slice(0, 220) });

  // 2. Turn the transcript into a memory.
  const controller = new AbortController();
  const abort = setTimeout(() => controller.abort(), SUMMARIZE_TIMEOUT_MS);
  try {
    const res = await fetch(`/api/entries/${id}/summarize`, {
      method: "POST",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("summarize failed");
  } catch {
    return fail(
      id,
      "Saved, but the summary didn't finish. Open it to try again.",
    );
  } finally {
    clearTimeout(abort);
  }

  patch(id, { phase: "ready" });
}

/** Start forming a memory for a freshly uploaded recording. */
export function beginForming(id: string, durationMs: number): void {
  if (items.some((m) => m.id === id)) return;
  emit([
    { id, createdAt: Date.now(), durationMs, phase: "transcribing", text: "" },
    ...items,
  ]);
  void run(id);
}

/** The memory is in the list now: drain the green, then drop the temporary
 * card. */
export function settleForming(id: string): void {
  const m = items.find((x) => x.id === id);
  if (!m || m.phase === "settled") return;
  patch(id, { phase: "settled" });
  later(id, SETTLE_MS, () => remove(id));
}

/** Forget everything belonging to a different signed-in user. */
export function resetFormingFor(ownerId: string): void {
  if (owner === ownerId) return;
  owner = ownerId;
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
  running.clear();
  emit(EMPTY);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFormingMemories(): FormingMemory[] {
  return React.useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY,
  );
}
