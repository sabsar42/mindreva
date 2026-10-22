"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ChevronLeft,
  Archive,
  ArchiveRestore,
  Check,
  FileText,
  ImagePlus,
  Loader2,
  RefreshCw,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  TaskChecklist,
  buttonVariants,
  cn,
  haptic,
  toast,
  type TaskChecklistTask,
} from "@mindreva/ui";
import type {
  EntryPhotoKind,
  EntrySource,
  TranscriptStatus,
} from "@mindreva/database";
import { getDefaultArtworkWide } from "@/lib/default-artwork";
import {
  appendPhotoToForm,
  prepareImageForUpload,
} from "@/lib/prepare-image-upload";
import { rememberEntryThumbnail, stablePhotoUrl } from "@/lib/photo-url-cache";
import { ConfirmTrashDialog } from "../../_components/confirm-trash-dialog";
import { ShareSheet } from "./share-sheet";
import { TranscriptSheet } from "./transcript-sheet";
import { DayEventsInline } from "../../_components/calendar-events";

// Lexical is a client-only interactive widget — its SSR output for the
// contentEditable div doesn't match what it renders once hydrated (a known
// Lexical/Next.js mismatch), and its bundle has no business loading on every
// page that merely imports @mindreva/ui. ssr: false skips the server render
// entirely (fixing the hydration error) and code-splits the editor into its own
// chunk, fetched only when this page actually mounts.
const RichTextEditor = dynamic(
  () => import("@mindreva/ui/rich-text-editor").then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted h-48 w-full animate-pulse rounded-xl" />
    ),
  },
);

const POLL_INTERVAL_MS = 2000;
const TEXT_AUTOSAVE_MS = 900;
const TITLE_AUTOSAVE_MS = 700;
// One summary refresh after the user stops editing, instead of one per save.
const SUMMARY_IDLE_MS = 25_000;

export interface EntryPhoto {
  id: string;
  url: string;
  kind: EntryPhotoKind;
}

type SaveState = "saved" | "dirty" | "saving" | "error";

function SaveStatus({
  state,
  onRetry,
}: {
  state: SaveState;
  onRetry: () => void;
}) {
  return (
    <p
      aria-live="polite"
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium transition-colors",
        state === "error" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {state === "saving" && (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          Saving…
        </>
      )}
      {state === "saved" && (
        <>
          <Check className="text-primary size-3.5" />
          Saved
        </>
      )}
      {state === "dirty" && <>Unsaved changes</>}
      {state === "error" && (
        <>
          <AlertCircle className="size-3.5" />
          Couldn&apos;t save
          <button
            type="button"
            onClick={onRetry}
            className="text-primary font-semibold underline underline-offset-2"
          >
            Retry
          </button>
        </>
      )}
    </p>
  );
}

export function EntryDetail({
  entryId,
  source,
  title,
  entryDate,
  archived,
  shared,
  transcriptStatus,
  confirmedText,
  summaryText,
  summaryPending,
  initialPhotos,
  initialTasks,
  calendarConnected = false,
}: {
  entryId: string;
  source: EntrySource;
  title: string | null;
  entryDate: string | null;
  archived: boolean;
  shared: boolean;
  transcriptStatus: TranscriptStatus | null;
  confirmedText: string;
  summaryText: string | null;
  /** The server will write the summary later (a limit, or the AI was busy). */
  summaryPending: boolean;
  initialPhotos: EntryPhoto[];
  initialTasks: TaskChecklistTask[];
  /** Google Calendar is connected: show that day's events under the date. */
  calendarConnected?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<TranscriptStatus | null>(
    transcriptStatus,
  );
  const [text, setText] = React.useState(confirmedText);
  const [titleValue, setTitleValue] = React.useState(title ?? "");
  const [textState, setTextState] = React.useState<SaveState>("saved");
  const [titleState, setTitleState] = React.useState<SaveState>("saved");
  const [summary, setSummary] = React.useState(summaryText);
  const [pendingSummary, setPendingSummary] = React.useState(summaryPending);
  const [regenerating, setRegenerating] = React.useState(false);
  const [isArchived, setIsArchived] = React.useState(archived);
  const [trashing, setTrashing] = React.useState(false);
  const [confirmTrashOpen, setConfirmTrashOpen] = React.useState(false);
  // Signed URLs are re-issued on every render with a new token; reuse the one
  // already loaded this session so the browser shows its cached image instead
  // of downloading the photo again (see lib/photo-url-cache.ts).
  const [coverPhotos, setCoverPhotos] = React.useState<EntryPhoto[]>(() =>
    initialPhotos
      .filter((p) => p.kind === "cover")
      .map((p) => ({ ...p, url: stablePhotoUrl(p.url) })),
  );
  const [uploadingCover, setUploadingCover] = React.useState(false);
  const [tasks, setTasks] = React.useState<TaskChecklistTask[]>(initialTasks);
  const [summarizingInBackground, setSummarizingInBackground] =
    React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [transcriptOpen, setTranscriptOpen] = React.useState(false);
  const [isShared, setIsShared] = React.useState(shared);

  // Pictures already in the body, id -> signed URL. New ones are tracked inside
  // the editor itself.
  const inlineImageUrls = React.useMemo(
    () =>
      Object.fromEntries(
        initialPhotos
          .filter((p) => p.kind === "inline")
          .map((p) => [p.id, stablePhotoUrl(p.url)]),
      ),
    [initialPhotos],
  );

  // ---- autosave plumbing (refs, so timers/handlers never see stale values) ----
  const latestTextRef = React.useRef(confirmedText);
  const lastSavedTextRef = React.useRef(confirmedText);
  const textSavingRef = React.useRef(false);
  const textTimerRef = React.useRef<number | null>(null);
  const latestTitleRef = React.useRef(title ?? "");
  const lastSavedTitleRef = React.useRef(title ?? "");
  const titleSavingRef = React.useRef(false);
  const titleTimerRef = React.useRef<number | null>(null);
  const summaryTimerRef = React.useRef<number | null>(null);
  const summaryStaleRef = React.useRef(false);
  const summaryRef = React.useRef(summary);
  summaryRef.current = summary;

  const dateLabel = entryDate
    ? new Date(`${entryDate}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const overallState: SaveState =
    textState === "error" || titleState === "error"
      ? "error"
      : textState === "saving" || titleState === "saving"
        ? "saving"
        : textState === "dirty" || titleState === "dirty"
          ? "dirty"
          : "saved";

  async function refreshSummaryNow(keepalive = false) {
    if (!summaryStaleRef.current) return;
    summaryStaleRef.current = false;
    try {
      const res = await fetch(`/api/entries/${entryId}/summarize`, {
        method: "POST",
        keepalive,
      });
      if (!res.ok || keepalive) return;
      const data = (await res.json()) as {
        summary: { summaryText: string } | null;
        tasks: TaskChecklistTask[];
      };
      if (data.summary) {
        setSummary(data.summary.summaryText);
        setTasks(data.tasks);
      }
    } catch {
      // The summary just stays as it was; the refresh button is still there.
    } finally {
      setSummarizingInBackground(false);
    }
  }

  function scheduleSummaryRefresh() {
    summaryStaleRef.current = true;
    if (summaryTimerRef.current) window.clearTimeout(summaryTimerRef.current);
    summaryTimerRef.current = window.setTimeout(() => {
      setSummarizingInBackground(true);
      void refreshSummaryNow();
    }, SUMMARY_IDLE_MS);
  }

  async function persistText(keepalive = false): Promise<boolean> {
    if (textSavingRef.current) return true; // the in-flight save re-checks when it ends
    const toSave = latestTextRef.current;
    if (toSave === lastSavedTextRef.current) {
      setTextState("saved");
      return true;
    }
    textSavingRef.current = true;
    setTextState("saving");
    try {
      const res = await fetch(`/api/entries/${entryId}/transcript`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Autosave must not re-summarize on every pause; see scheduleSummaryRefresh.
        body: JSON.stringify({ editedText: toSave, resummarize: false }),
        keepalive,
      });
      if (!res.ok) throw new Error("Save failed");
      lastSavedTextRef.current = toSave;
      scheduleSummaryRefresh();
      textSavingRef.current = false;
      if (latestTextRef.current !== toSave) {
        // Typed more while that save was in flight: save again.
        return persistText(keepalive);
      }
      setTextState("saved");
      haptic("success");
      return true;
    } catch {
      textSavingRef.current = false;
      setTextState("error");
      return false;
    }
  }

  async function persistTitle(keepalive = false): Promise<boolean> {
    if (titleSavingRef.current) return true;
    const toSave = latestTitleRef.current;
    if (toSave === lastSavedTitleRef.current) {
      setTitleState("saved");
      return true;
    }
    titleSavingRef.current = true;
    setTitleState("saving");
    try {
      const res = await fetch(`/api/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: toSave }),
        keepalive,
      });
      if (!res.ok) throw new Error("Save failed");
      lastSavedTitleRef.current = toSave;
      titleSavingRef.current = false;
      if (latestTitleRef.current !== toSave) return persistTitle(keepalive);
      setTitleState("saved");
      return true;
    } catch {
      titleSavingRef.current = false;
      setTitleState("error");
      return false;
    }
  }

  function handleTextChange(value: string) {
    setText(value);
    latestTextRef.current = value;
    if (value === lastSavedTextRef.current) {
      setTextState("saved");
      return;
    }
    setTextState("dirty");
    if (textTimerRef.current) window.clearTimeout(textTimerRef.current);
    textTimerRef.current = window.setTimeout(
      () => void persistText(),
      TEXT_AUTOSAVE_MS,
    );
  }

  function handleTitleChange(value: string) {
    setTitleValue(value);
    latestTitleRef.current = value;
    if (value === lastSavedTitleRef.current) {
      setTitleState("saved");
      return;
    }
    setTitleState("dirty");
    if (titleTimerRef.current) window.clearTimeout(titleTimerRef.current);
    titleTimerRef.current = window.setTimeout(
      () => void persistTitle(),
      TITLE_AUTOSAVE_MS,
    );
  }

  /** Save anything pending now. Resolves false if a save failed. */
  async function flushAll(): Promise<boolean> {
    if (textTimerRef.current) window.clearTimeout(textTimerRef.current);
    if (titleTimerRef.current) window.clearTimeout(titleTimerRef.current);
    const [textOk, titleOk] = await Promise.all([
      persistText(),
      persistTitle(),
    ]);
    return textOk && titleOk;
  }

  // Keep the latest flush handlers reachable from effects that mount once.
  const flushRef = React.useRef({
    text: persistText,
    title: persistTitle,
    summary: refreshSummaryNow,
  });
  flushRef.current = {
    text: persistText,
    title: persistTitle,
    summary: refreshSummaryNow,
  };
  const overallStateRef = React.useRef(overallState);
  overallStateRef.current = overallState;

  React.useEffect(() => {
    // Closing the tab or locking the phone: send what's pending with keepalive
    // so it survives the page going away, and ask the browser to confirm if a
    // save is still outstanding.
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (overallStateRef.current !== "saved") e.preventDefault();
    }
    function sendPending() {
      void flushRef.current.text(true);
      void flushRef.current.title(true);
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") sendPending();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", sendPending);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", sendPending);
      document.removeEventListener("visibilitychange", onVisibility);
      // Leaving the page in-app: flush edits and refresh a stale summary once.
      sendPending();
      if (summaryTimerRef.current) window.clearTimeout(summaryTimerRef.current);
      void flushRef.current.summary(true);
    };
  }, []);

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
        const value = data.editedText ?? data.rawText ?? "";
        latestTextRef.current = value;
        lastSavedTextRef.current = value;
        setText(value);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [entryId, status]);

  async function regenerateSummary() {
    setRegenerating(true);
    const hadSummaryBefore = Boolean(summary);
    try {
      // Make sure the summary reflects what's on screen, not an older save.
      await flushAll();
      summaryStaleRef.current = false;
      const res = await fetch(`/api/entries/${entryId}/summarize`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as {
        summary: { summaryText: string; provider: string | null } | null;
        tasks: TaskChecklistTask[];
        pending: { message: string } | null;
      };
      if (data.pending) {
        // A limit or a busy AI, not a failure: the server retries it later.
        setPendingSummary(true);
        toast(data.pending.message);
      } else if (data.summary) {
        setSummary(data.summary.summaryText);
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
      router.push("/journal");
    } catch {
      toast.error("Couldn't move to Trash.");
      setTrashing(false);
    }
  }

  async function handleBack() {
    // Don't navigate away with edits still unsaved.
    const ok = await flushAll();
    if (!ok) {
      toast.error("Your latest changes couldn't be saved yet. Try again.");
      return;
    }
    // router.back() reuses Next.js's Router Cache for the page we came from —
    // instant, same as the browser's own back button. Only falls back to push()
    // when there's no in-app history (e.g. a deep link straight to this entry).
    if (window.history.length > 1) router.back();
    else router.push("/journal");
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

  /** "Add a picture": uploads an inline image; the editor inserts it at the cursor. */
  async function uploadInlineImage(file: File) {
    const form = new FormData();
    form.set("image", await prepareImageForUpload(file));
    form.set("kind", "inline");
    const res = await fetch(`/api/entries/${entryId}/photos`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error("Upload failed");
    const data = (await res.json()) as { photo: EntryPhoto };
    return { photoId: data.photo.id, url: data.photo.url };
  }

  /** "Change cover": a separate action that only affects the cover/thumbnail. */
  async function changeCover(file: File) {
    setUploadingCover(true);
    try {
      const form = new FormData();
      await appendPhotoToForm(form, file);
      form.set("kind", "cover");
      form.set("makeCover", "true");
      const res = await fetch(`/api/entries/${entryId}/photos`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = (await res.json()) as { photo: EntryPhoto };
      // Also replaces the journal list's remembered thumbnail, so going back
      // shows the new cover rather than the old one from memory.
      const url = rememberEntryThumbnail(entryId, data.photo.url);
      setCoverPhotos((prev) => [{ ...data.photo, url }, ...prev]);
      toast.success("Cover updated");
      router.refresh();
    } catch {
      toast.error("Couldn't change the cover. Please try again.");
    } finally {
      setUploadingCover(false);
    }
  }

  const coverUrl = coverPhotos[0]?.url ?? getDefaultArtworkWide(entryId);
  const coverInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <main className="min-h-app mx-auto px-4 pb-24 pt-6">
      <header className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => void handleBack()}
          aria-label="Back"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "-ml-3 [&_svg]:size-7",
          )}
        >
          <ChevronLeft />
        </button>
        <div className="flex items-center gap-1.5">
          {source === "voice" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setTranscriptOpen(true)}
              aria-label="View transcript"
            >
              <FileText />
              Transcript
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setShareOpen(true)}
            aria-label={isShared ? "Share (currently shared)" : "Share"}
          >
            <Share2 />
            Share
          </Button>
          <button
            type="button"
            onClick={toggleArchive}
            aria-label={isArchived ? "Unarchive" : "Archive"}
            className={buttonVariants({ variant: "quiet", size: "icon" })}
          >
            {isArchived ? <ArchiveRestore /> : <Archive />}
          </button>
          <button
            type="button"
            onClick={() => setConfirmTrashOpen(true)}
            disabled={trashing}
            aria-label="Move to Trash"
            className={cn(
              buttonVariants({ variant: "quiet", size: "icon" }),
              "hover:text-destructive",
            )}
          >
            <Trash2 />
          </button>
        </div>
      </header>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {dateLabel && (
            <p className="text-muted-foreground text-sm">{dateLabel}</p>
          )}
          {isArchived && <Badge variant="neutral">Archived</Badge>}
          {isShared && <Badge variant="accent">Shared</Badge>}
        </div>
        <SaveStatus
          state={overallState}
          onRetry={() => {
            void persistText();
            void persistTitle();
          }}
        />
      </div>
      {calendarConnected && entryDate && (
        <DayEventsInline dateKey={entryDate} className="mt-1.5" />
      )}

      {/* The title is edited in place: no dialog, no separate screen. */}
      <textarea
        value={titleValue}
        onChange={(e) => handleTitleChange(e.target.value.replace(/\n/g, " "))}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        onBlur={() => void persistTitle()}
        placeholder="Untitled entry"
        aria-label="Journal title"
        rows={1}
        maxLength={200}
        spellCheck
        className="text-foreground placeholder:text-muted-foreground/60 mt-1 block w-full resize-none bg-transparent text-2xl font-bold leading-snug tracking-tight [field-sizing:content] focus-visible:outline-none"
      />

      <div className="relative mt-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl}
          alt=""
          className="h-48 w-full rounded-2xl object-cover"
        />
        {/* Cover and inline pictures are separate actions: this one only ever
            changes the cover/thumbnail. "Add a picture" is in the editor. */}
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          disabled={uploadingCover}
          aria-label="Change cover image"
          className={cn(
            buttonVariants({ variant: "glass", size: "sm" }),
            "absolute bottom-3 right-3",
          )}
        >
          {uploadingCover ? (
            <Loader2 className="animate-spin" />
          ) : (
            <ImagePlus />
          )}
          Change cover
        </button>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          data-testid="cover-image-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void changeCover(file);
          }}
        />
      </div>

      <div className="border-border bg-card shadow-subtle mt-4 rounded-2xl border p-4">
        <div className="flex items-center justify-between">
          <p className="text-primary flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest">
            <Sparkles className="size-3.5" />
            Summary
            {summarizingInBackground && (
              <span className="text-primary/60 flex items-center gap-1 font-normal normal-case tracking-normal">
                <Loader2 className="size-3 animate-spin" />
                updating…
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={regenerateSummary}
            disabled={
              regenerating || status === "pending" || status === "processing"
            }
            aria-label={summary ? "Regenerate summary" : "Generate summary"}
            className="text-primary/60 hover:text-primary transition-colors disabled:opacity-40"
          >
            {regenerating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </button>
        </div>
        {summary ? (
          <p className="text-foreground mt-3 whitespace-pre-wrap text-sm leading-relaxed">
            {summary}
          </p>
        ) : (
          <p className="text-primary/70 mt-3 text-sm">
            {status === "pending" || status === "processing"
              ? "Waiting for the transcript to finish."
              : pendingSummary
                ? "Your summary is on its way. It will appear here once it's written."
                : "No summary yet. Tap the refresh icon to generate one."}
          </p>
        )}
      </div>

      {tasks.length > 0 && (
        <TaskChecklist
          tasks={tasks}
          onToggle={(taskId, isDone) => void toggleTask(taskId, isDone)}
          className="mt-4"
        />
      )}

      <div className="mt-6">
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
            onChange={handleTextChange}
            placeholder={
              source === "voice" ? "Your transcript…" : "Start writing…"
            }
            textareaClassName="min-h-64"
            imageUrls={inlineImageUrls}
            onUploadImage={uploadInlineImage}
            onImageError={(message) => toast.error(message)}
          />
        )}
      </div>

      <ShareSheet
        entryId={entryId}
        open={shareOpen}
        onOpenChange={setShareOpen}
        onStatusChange={setIsShared}
      />
      {source === "voice" && (
        <TranscriptSheet
          entryId={entryId}
          open={transcriptOpen}
          onOpenChange={setTranscriptOpen}
        />
      )}
      {/* Same confirmation as the list's swipe-to-trash: the header icon
          used to trash the entry on a single tap. */}
      <ConfirmTrashDialog
        open={confirmTrashOpen}
        onOpenChange={setConfirmTrashOpen}
        onConfirm={() => void handleTrash()}
      />
    </main>
  );
}
