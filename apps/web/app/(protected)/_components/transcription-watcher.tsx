"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@mindreva/ui";
import { takeWatchedTranscriptionIds } from "@/lib/transcription-watch";
import type { TranscriptStatus } from "@mindreva/database";

const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 40; // ~2 minutes

/**
 * Renders nothing — on mount, picks up any entry IDs queued by the record
 * flow (recording finished, transcription running in the background) and
 * polls each until its transcript is done or failed, then toasts and
 * refreshes the list so the new snippet/title show up. Mount this once on
 * the journal list screen, where the user lands immediately after
 * recording.
 */
export function TranscriptionWatcher() {
  const router = useRouter();

  React.useEffect(() => {
    const ids = takeWatchedTranscriptionIds();
    if (ids.length === 0) return;

    let cancelled = false;

    async function watch(entryId: string) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/entries/${entryId}/transcript`);
          if (res.ok) {
            const data = (await res.json()) as { status: TranscriptStatus };
            if (data.status === "done") {
              toast.success("Transcription complete");
              router.refresh();
              return;
            }
            if (data.status === "failed") {
              toast.error(
                "Couldn't transcribe that recording — it's still saved.",
              );
              return;
            }
          }
        } catch {
          // Keep polling; a single failed check isn't fatal.
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

    for (const id of ids) void watch(id);

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
