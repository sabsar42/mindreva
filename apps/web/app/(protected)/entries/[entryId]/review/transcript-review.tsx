"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Button,
  PhotoUploader,
  PhotoThumbnailStrip,
  Textarea,
  toast,
  type PhotoUploaderPhoto,
} from "@mindreva/ui";
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
  const [skipping, setSkipping] = React.useState(false);
  const [photos, setPhotos] = React.useState<PhotoUploaderPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false);

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

  // Skipping still confirms the transcript as-is (raw text) — it should still
  // get summarized, just via the same "regenerate" endpoint since no edit is
  // being saved. Deliberately not awaited: summarizing is an LLM call that
  // can take several seconds, and navigating away shouldn't wait on it — the
  // entry detail screen offers "Generate summary" if it hasn't finished by
  // the time the user lands there.
  function handleSkip() {
    setSkipping(true);
    fetch(`/api/entries/${entryId}/summarize`, { method: "POST" }).catch(() => {
      // Non-fatal — the entry detail screen offers "Generate summary" too.
    });
    router.push("/journal");
  }

  async function handlePhotosSelected(files: File[]) {
    setUploadingPhoto(true);
    try {
      // Parallel, not one-at-a-time — see entry-detail.tsx's identical fix
      // for why.
      const results = await Promise.allSettled(
        files.map(async (file) => {
          const form = new FormData();
          form.set("image", file);
          const res = await fetch(`/api/entries/${entryId}/photos`, {
            method: "POST",
            body: form,
          });
          if (!res.ok) throw new Error("Upload failed");
          const data = (await res.json()) as { photo: PhotoUploaderPhoto };
          return data.photo;
        }),
      );
      const uploaded = results
        .filter(
          (r): r is PromiseFulfilledResult<PhotoUploaderPhoto> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);
      if (uploaded.length > 0) {
        setPhotos((prev) => [...prev, ...uploaded]);
      }
      if (uploaded.length < files.length) {
        toast.error("Couldn't upload one or more photos. Please try again.");
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (status === "pending" || status === "processing") {
    return (
      <main className="mx-auto flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center md:max-w-2xl">
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
      <main className="mx-auto flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center md:max-w-2xl">
        <p className="text-foreground">
          We couldn&apos;t transcribe this recording.
        </p>
        <p className="text-muted-foreground text-sm">
          It&apos;s still saved. You can find it in your journal.
        </p>
        <Button variant="secondary" onClick={() => router.push("/journal")}>
          Back to journal
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen flex-col gap-4 px-6 py-6 md:max-w-2xl">
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

      <div className="flex items-center gap-2">
        <h2 className="text-foreground text-sm font-semibold">Photos</h2>
        <PhotoUploader
          photos={photos}
          onFilesSelected={(files) => void handlePhotosSelected(files)}
          uploading={uploadingPhoto}
        />
      </div>
      <PhotoThumbnailStrip photos={photos} />

      <div className="flex gap-3">
        <Button
          variant="ghost"
          className="flex-1"
          onClick={handleSkip}
          disabled={skipping}
        >
          {skipping ? "…" : "Skip for now"}
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </main>
  );
}
