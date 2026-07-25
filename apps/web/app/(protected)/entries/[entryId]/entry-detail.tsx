"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Badge, Button, Card, Textarea, toast } from "@mindreva/ui";
import type { EntryType, TranscriptStatus } from "@mindreva/database";

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

  const dateLabel = entryDate
    ? new Date(`${entryDate}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
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
      };
      setTextDirty(false);
      if (data.summary) {
        setSummary(data.summary.summaryText);
        setProvider(data.summary.provider);
      }
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
      };
      if (data.summary) {
        setSummary(data.summary.summaryText);
        setProvider(data.summary.provider);
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

      <div className="mt-4">
        <h1 className="text-foreground text-xl font-bold tracking-tight">
          {title || "Untitled entry"}
        </h1>
        <div className="mt-1 flex items-center gap-2">
          {dateLabel && (
            <p className="text-muted-foreground text-sm">{dateLabel}</p>
          )}
          {isArchived && <Badge variant="neutral">Archived</Badge>}
        </div>
      </div>

      <Card className="mt-5 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-foreground text-sm font-semibold">Summary</h2>
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
            <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
              {summary}
            </p>
            {provider && (
              <p className="text-muted-foreground mt-3 text-xs">
                Generated by {provider}
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            {status === "pending" || status === "processing"
              ? "Waiting for the transcript to finish."
              : "No summary yet."}
          </p>
        )}
      </Card>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-foreground text-sm font-semibold">
            {type === "journal" ? "Transcript" : "Note"}
          </h2>
          {textDirty && (
            <Button size="sm" onClick={saveText} disabled={savingText}>
              {savingText ? "Saving…" : "Save"}
            </Button>
          )}
        </div>

        {status === "pending" || status === "processing" ? (
          <div className="border-border bg-card text-muted-foreground flex items-center gap-2 rounded-lg border p-5 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Transcribing…
          </div>
        ) : status === "failed" ? (
          <div className="border-border bg-card text-muted-foreground rounded-lg border p-5 text-sm">
            This recording couldn&apos;t be transcribed.
          </div>
        ) : (
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setTextDirty(true);
            }}
            className="min-h-48"
          />
        )}
      </div>
    </main>
  );
}
