"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  PhotoUploader,
  PhotoThumbnailStrip,
  TaskChecklist,
  toast,
  type PhotoUploaderPhoto,
  type TaskChecklistTask,
} from "@mindreva/ui";
import type { EntryType, TranscriptStatus } from "@mindreva/database";

// Lexical is a client-only interactive widget — its SSR output for the
// contentEditable div doesn't match what it renders once hydrated (a known
// Lexical/Next.js mismatch), and its ~90kB+ bundle has no business loading
// on every page that merely imports @mindreva/ui. ssr: false skips the
// server render entirely (fixing the hydration error) and code-splits the
// editor into its own chunk, fetched only when this page actually mounts —
// note-card taps elsewhere in the app no longer wait on Lexical to parse.
const RichTextEditor = dynamic(
  () => import("@mindreva/ui/rich-text-editor").then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="bg-warm-100 h-48 w-full animate-pulse rounded-md" />
    ),
  },
);

const POLL_INTERVAL_MS = 2000;

export function EntryDetail({
  entryId,
  type,
  title,
  entryDate,
  archived,
  transcriptStatus,
  confirmedText,
  summaryText,
  summaryProvider,
  initialPhotos,
  initialTasks,
}: {
  entryId: string;
  type: EntryType;
  title: string | null;
  entryDate: string | null;
  archived: boolean;
  transcriptStatus: TranscriptStatus | null;
  confirmedText: string;
  summaryText: string | null;
  summaryProvider: string | null;
  initialPhotos: PhotoUploaderPhoto[];
  initialTasks: TaskChecklistTask[];
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<TranscriptStatus | null>(
    transcriptStatus,
  );
  const [text, setText] = React.useState(confirmedText);
  const [savingText, setSavingText] = React.useState(false);
  const [textDirty, setTextDirty] = React.useState(false);
  const [summary, setSummary] = React.useState(summaryText);
  const [provider, setProvider] = React.useState(summaryProvider);
  const [regenerating, setRegenerating] = React.useState(false);
  const [isArchived, setIsArchived] = React.useState(archived);
  const [trashing, setTrashing] = React.useState(false);
  const [photos, setPhotos] =
    React.useState<PhotoUploaderPhoto[]>(initialPhotos);
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false);
  const [tasks, setTasks] = React.useState<TaskChecklistTask[]>(initialTasks);
  // True while a save's background re-summarize (kicked off via
  // next/server's after()) is still in flight — the save itself already
  // completed and returned, this just tracks whether the summary/tasks the
  // save response returned are the stale pre-edit ones.
  const [summarizingInBackground, setSummarizingInBackground] =
    React.useState(false);

  const dateLabel = entryDate
    ? new Date(`${entryDate}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  // Poll while the transcript is still processing (only relevant if the user
  // navigates here before the review screen's own polling finished).
  React.useEffect(() => {
    if (status !== "pending" && status !== "processing") return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/entries/${entryId}/transcript`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        status: TranscriptStatus;
        rawText: string | null;
        editedText: string | null;
      };
      setStatus(data.status);
      if (data.status === "done") {
        setText(data.editedText ?? data.rawText ?? "");
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [entryId, status]);

  async function saveText() {
    setSavingText(true);
    try {
      const res = await fetch(`/api/entries/${entryId}/transcript`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedText: text }),
      });
      if (!res.ok) throw new Error("Save failed");
      // The route responds as soon as the text write lands — it does NOT
      // wait for re-summarization (that runs after the response, via
      // next/server's after()). Clear dirty state and confirm the save
      // immediately; the summary/tasks in this response are still the
      // pre-edit ones, so kick off a short poll to pick up the fresh
      // result once it's ready, same idiom as the transcript-status poll.
      setTextDirty(false);
      toast.success("Saved");
      setSummarizingInBackground(true);
    } catch {
      toast.error("Couldn't save. Please try again.");
    } finally {
      setSavingText(false);
    }
  }

  // Polls briefly after a save to pick up the background re-summarize's
  // result. Stops on its own once the summary/tasks actually change, or
  // after a reasonable ceiling so a failed background job doesn't poll
  // forever.
  React.useEffect(() => {
    if (!summarizingInBackground) return;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/entries/${entryId}/summary`);
        if (res.ok) {
          const data = (await res.json()) as {
            summary: { summaryText: string; provider: string | null } | null;
            tasks: TaskChecklistTask[];
          };
          if (data.summary?.summaryText !== summary) {
            setSummary(data.summary?.summaryText ?? null);
            setProvider(data.summary?.provider ?? null);
            setTasks(data.tasks);
            setSummarizingInBackground(false);
            return;
          }
        }
      } catch {
        // Keep polling; a single failed check isn't fatal.
      }
      if (attempts >= 10) setSummarizingInBackground(false);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summarizingInBackground, entryId]);

  async function regenerateSummary() {
    setRegenerating(true);
    const hadSummaryBefore = Boolean(summary);
    try {
      const res = await fetch(`/api/entries/${entryId}/summarize`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as {
        summary: { summaryText: string; provider: string | null } | null;
        tasks: TaskChecklistTask[];
      };
      if (data.summary) {
        setSummary(data.summary.summaryText);
        setProvider(data.summary.provider);
        setTasks(data.tasks);
        toast.success(
          hadSummaryBefore ? "Summary regenerated" : "Summary generated",
        );
      } else {
        toast.error("Nothing to summarize yet.");
      }
    } catch {
      toast.error("Couldn't generate a summary. Please try again.");
    } finally {
      setRegenerating(false);
    }
  }

  async function toggleArchive() {
    const method = isArchived ? "DELETE" : "POST";
    const res = await fetch(`/api/entries/${entryId}/archive`, { method });
    if (!res.ok) {
      toast.error("Something went wrong.");
      return;
    }
    setIsArchived(!isArchived);
    toast.success(isArchived ? "Unarchived" : "Archived");
  }

  async function handleTrash() {
    setTrashing(true);
    try {
      const res = await fetch(`/api/entries/${entryId}/trash`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Moved to Trash");
      router.push(type === "journal" ? "/journal" : "/notes");
    } catch {
      toast.error("Couldn't move to Trash.");
      setTrashing(false);
    }
  }

  async function toggleTask(taskId: string, isDone: boolean) {
    // Optimistic — a checklist toggle should feel instant, and a failure
    // here is low-stakes enough to just revert on error.
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isDone } : t)),
    );
    const res = await fetch(`/api/entries/${entryId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDone }),
    });
    if (!res.ok) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, isDone: !isDone } : t)),
      );
      toast.error("Couldn't update that task.");
    }
  }

  async function handlePhotosSelected(files: File[]) {
    setUploadingPhoto(true);
    try {
      // Uploads run in parallel, not one-at-a-time — picking several photos
      // used to take N times as long as picking one; each upload is fully
      // independent, so there's no reason to serialize them.
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

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-16 pt-6">
      <header className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() =>
            router.push(type === "journal" ? "/journal" : "/notes")
          }
          aria-label="Back"
          className="text-foreground hover:bg-warm-100 -ml-2 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleArchive}
            aria-label={isArchived ? "Unarchive" : "Archive"}
            className="text-muted-foreground hover:bg-warm-100 hover:text-foreground flex size-9 items-center justify-center rounded-full transition-colors"
          >
            {isArchived ? (
              <ArchiveRestore className="size-5" />
            ) : (
              <Archive className="size-5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleTrash}
            disabled={trashing}
            aria-label="Move to Trash"
            className="text-muted-foreground hover:bg-warm-100 hover:text-destructive flex size-9 items-center justify-center rounded-full transition-colors disabled:opacity-50"
          >
            <Trash2 className="size-5" />
          </button>
        </div>
      </header>

      <div className="mt-4 flex items-center gap-2">
        {dateLabel && (
          <p className="text-muted-foreground text-sm">{dateLabel}</p>
        )}
        {isArchived && <Badge variant="neutral">Archived</Badge>}
      </div>

      <h1 className="text-foreground mt-1 text-2xl font-bold leading-snug tracking-tight">
        {title || "Untitled entry"}
      </h1>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
          Summary
          {summarizingInBackground && (
            <span className="text-muted-foreground/70 flex items-center gap-1 normal-case tracking-normal">
              <Loader2 className="size-3 animate-spin" />
              updating…
            </span>
          )}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={regenerateSummary}
          disabled={
            regenerating || status === "pending" || status === "processing"
          }
        >
          {regenerating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {summary ? "Regenerate" : "Generate"}
        </Button>
      </div>
      {summary ? (
        <>
          <p className="text-foreground mt-1 whitespace-pre-wrap text-base leading-relaxed">
            {summary}
          </p>
          {provider && (
            <p className="text-muted-foreground mt-2 text-xs">
              Generated by {provider}
            </p>
          )}
        </>
      ) : (
        <p className="text-muted-foreground mt-1 text-sm">
          {status === "pending" || status === "processing"
            ? "Waiting for the transcript to finish."
            : "No summary yet."}
        </p>
      )}

      {tasks.length > 0 && (
        <TaskChecklist
          tasks={tasks}
          onToggle={(taskId, isDone) => void toggleTask(taskId, isDone)}
          className="mt-4"
        />
      )}

      <div className="mt-5">
        {textDirty && (
          <div className="mb-2 flex justify-end">
            <Button size="sm" onClick={saveText} disabled={savingText}>
              {savingText ? "Saving…" : "Save"}
            </Button>
          </div>
        )}

        {status === "pending" || status === "processing" ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Transcribing…
          </div>
        ) : status === "failed" ? (
          <p className="text-muted-foreground text-sm">
            This recording couldn&apos;t be transcribed.
          </p>
        ) : (
          <>
            <RichTextEditor
              value={text}
              onChange={(value) => {
                setText(value);
                setTextDirty(true);
              }}
              placeholder={
                type === "journal" ? "Your transcript…" : "Your note…"
              }
              textareaClassName="min-h-48"
              toolbarEnd={
                <PhotoUploader
                  photos={photos}
                  onFilesSelected={(files) => void handlePhotosSelected(files)}
                  uploading={uploadingPhoto}
                />
              }
            />
            <PhotoThumbnailStrip photos={photos} className="mt-3" />
          </>
        )}
      </div>
    </main>
  );
}
