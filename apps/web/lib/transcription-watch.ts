"use client";

/**
 * Tracks entry IDs whose transcription is running in the background (kicked
 * off via createVoiceEntry's after(), see record-flow.tsx) so any page —
 * typically the journal list the user lands back on immediately after
 * recording — can poll for completion and toast once it's done, without a
 * dedicated "please wait" screen. Backed by sessionStorage so the watch list
 * survives the client-side navigation from /record back to /journal.
 */
const STORAGE_KEY = "mindreva:transcribing-entry-ids";

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function queueTranscriptionWatch(entryId: string): void {
  const ids = readIds();
  if (!ids.includes(entryId)) writeIds([...ids, entryId]);
}

export function takeWatchedTranscriptionIds(): string[] {
  const ids = readIds();
  if (ids.length > 0) writeIds([]);
  return ids;
}
