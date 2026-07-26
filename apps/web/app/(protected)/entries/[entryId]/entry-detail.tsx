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
      const data = (await res.json()) as {
        summary: { summaryText: string; provider: string | null } | null;
        tasks: TaskChecklistTask[];
      };
      setTextDirty(false);
      if (data.summary) {
        setSummary(data.summary.summaryText);
        setProvider(data.summary.provider);
      }
      setTasks(data.tasks);
      toast.success("Saved");
    } catch {
      toast.error("Couldn't save. Please try again.");
    } finally {
      setSavingText(false);
    }
  }

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
      for (const file of files) {
        const form = new FormData();
        form.set("image", file);
        const res = await fetch(`/api/entries/${entryId}/photos`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = (await res.json()) as { photo: PhotoUploaderPhoto };
        setPhotos((prev) => [...prev, data.photo]);
      }
    } catch {
      toast.error("Couldn't upload that photo. Please try again.");
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
        <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Summary
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
        <PhotoUploader
          photos={photos}
          onFilesSelected={(files) => void handlePhotosSelected(files)}
          uploading={uploadingPhoto}
        />
      </div>

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
          <RichTextEditor
            value={text}
            onChange={(value) => {
              setText(value);
              setTextDirty(true);
            }}
            placeholder={type === "journal" ? "Your transcript…" : "Your note…"}
            textareaClassName="min-h-48"
          />
        )}
      </div>
    </main>
  );
}
