"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, Textarea, toast } from "@mindreva/ui";
import type { TranscriptStatus } from "@mindreva/database";

interface TranscriptResponse {
  status: TranscriptStatus;
  rawText: string | null;
  editedText: string | null;
}

const POLL_INTERVAL_MS = 2000;

export function TranscriptReview({
  entryId,
  initialStatus,
  initialText,
}: {
  entryId: string;
  initialStatus: TranscriptStatus;
  initialText: string;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<TranscriptStatus>(initialStatus);
  const [text, setText] = React.useState(initialText);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (status !== "pending" && status !== "processing") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/entries/${entryId}/transcript`);
        if (!res.ok) return;
        const data = (await res.json()) as TranscriptResponse;
        setStatus(data.status);
        if (data.status === "done") {
          setText(data.editedText ?? data.rawText ?? "");
        }
      } catch {
        // Keep polling; a single failed check isn't fatal.
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [entryId, status]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/entries/${entryId}/transcript`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedText: text }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Saved");
      router.push("/journal");
    } catch {
      toast.error("Couldn't save your edits. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "pending" || status === "processing") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <Loader2 className="text-primary size-8 animate-spin" />
        <p className="text-foreground">Transcribing your recording…</p>
        <p className="text-muted-foreground text-sm">
          This usually only takes a few seconds.
        </p>
      </main>
    );
  }

  if (status === "failed") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-foreground">
          We couldn&apos;t transcribe this recording.
        </p>
        <p className="text-muted-foreground text-sm">
          It&apos;s still saved — you can find it in your journal.
        </p>
        <Button variant="secondary" onClick={() => router.push("/journal")}>
          Back to journal
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-6 py-6">
      <div>
        <h1 className="text-foreground text-xl font-bold tracking-tight">
          Review your transcript
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Fix anything the transcription got wrong before it&apos;s used for
          your summary.
        </p>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-64 flex-1"
        placeholder="Your transcript will appear here…"
      />

      <div className="flex gap-3">
        <Button
          variant="ghost"
          className="flex-1"
          onClick={() => router.push("/journal")}
        >
          Skip for now
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </main>
  );
}
