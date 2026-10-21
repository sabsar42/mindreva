"use client";

import * as React from "react";
import { Clock, FileText, Loader2, Search } from "lucide-react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
  Button,
  IconTile,
  Input,
  Skeleton,
  cn,
  toast,
} from "@mindreva/ui";
import {
  findBlockAt,
  formatRange,
  formatTimestamp,
  groupSegments,
  parseTimestamp,
  type Segment,
} from "@/lib/transcript/segments";

interface TranscriptViewData {
  status: "pending" | "processing" | "done" | "failed" | null;
  segments: Segment[] | null;
  fallbackText: string | null;
  canGenerateTimestamps: boolean;
}

/**
 * Read-only transcript of a recording: the recognized words, split into
 * timestamped blocks you can jump around. It never plays or shows the audio.
 * Timestamps come from the speech recognizer's own segments, saved with the
 * transcript; for recordings made before they were saved there is a clear note
 * and an option to add them.
 */
export function TranscriptSheet({
  entryId,
  open,
  onOpenChange,
}: {
  entryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [data, setData] = React.useState<TranscriptViewData | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [generateError, setGenerateError] = React.useState<string | null>(null);
  const [jump, setJump] = React.useState("");
  const [jumpError, setJumpError] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const blockRefs = React.useRef<Map<number, HTMLElement>>(new Map());

  const load = React.useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch(`/api/entries/${entryId}/transcript/segments`);
      if (!res.ok) throw new Error("load failed");
      setData((await res.json()) as TranscriptViewData);
    } catch {
      setLoadError(true);
    }
  }, [entryId]);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const blocks = React.useMemo(
    () => (data?.segments ? groupSegments(data.segments) : []),
    [data?.segments],
  );

  function scrollToBlock(index: number) {
    setActiveIndex(index);
    const node = blockRefs.current.get(index);
    if (!node) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    node.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "center",
    });
  }

  function submitJump(e: React.FormEvent) {
    e.preventDefault();
    const ms = parseTimestamp(jump);
    if (ms === null) {
      setJumpError("Enter a time like 1:15");
      return;
    }
    const target = findBlockAt(blocks, ms);
    if (!target) return;
    setJumpError(null);
    scrollToBlock(target.index);
  }

  async function generateTimestamps() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch(`/api/entries/${entryId}/transcript/segments`, {
        method: "POST",
      });
      if (res.status === 422) {
        setGenerateError(
          "The speech recognizer didn't return timing for this recording.",
        );
        return;
      }
      if (!res.ok) throw new Error("generate failed");
      toast.success("Timestamps added");
      await load();
    } catch {
      setGenerateError("Couldn't add timestamps. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent className="flex max-h-[90dvh] flex-col">
        <div className="flex items-center gap-3">
          <IconTile>
            <FileText />
          </IconTile>
          <div className="min-w-0 flex-1">
            <BottomSheetTitle>Transcript</BottomSheetTitle>
            <BottomSheetDescription className="text-muted-foreground text-sm">
              What was said, by time. Text only, no audio.
            </BottomSheetDescription>
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pb-2">
          {loadError ? (
            <p
              className="text-muted-foreground py-8 text-center text-sm"
              role="alert"
            >
              Couldn&apos;t load the transcript. Close this and try again.
            </p>
          ) : !data ? (
            <div className="space-y-3" aria-busy>
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          ) : data.status === "pending" || data.status === "processing" ? (
            <p className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Still transcribing. Check back in a moment.
            </p>
          ) : data.status === "failed" ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              This recording couldn&apos;t be transcribed.
            </p>
          ) : blocks.length > 0 ? (
            <>
              <form
                onSubmit={submitJump}
                className="mb-3 flex items-start gap-2"
                aria-label="Jump to a time"
              >
                <div className="flex-1">
                  <div className="relative">
                    <Clock className="text-muted-foreground pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2" />
                    <Input
                      value={jump}
                      onChange={(e) => {
                        setJump(e.target.value);
                        setJumpError(null);
                      }}
                      inputMode="decimal"
                      enterKeyHint="go"
                      autoComplete="off"
                      placeholder="Jump to a time, e.g. 1:15"
                      aria-label="Jump to a time"
                      aria-invalid={jumpError ? true : undefined}
                      className="h-11 pl-10"
                    />
                  </div>
                  {jumpError && (
                    <p
                      className="text-destructive mt-1 pl-4 text-xs"
                      role="alert"
                    >
                      {jumpError}
                    </p>
                  )}
                </div>
                <Button type="submit" variant="secondary">
                  Go
                </Button>
              </form>

              <nav
                aria-label="Transcript sections"
                className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1"
              >
                {blocks.map((block) => (
                  <button
                    key={block.index}
                    type="button"
                    onClick={() => scrollToBlock(block.index)}
                    aria-label={`Go to ${formatTimestamp(block.startMs)}`}
                    className={cn(
                      "focus-visible:ring-ring shrink-0 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2",
                      activeIndex === block.index
                        ? "bg-primary text-primary-foreground border-transparent"
                        : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    {formatTimestamp(block.startMs)}
                  </button>
                ))}
              </nav>

              <ol className="space-y-2">
                {blocks.map((block) => (
                  <li key={block.index}>
                    <button
                      type="button"
                      ref={(node) => {
                        if (node) blockRefs.current.set(block.index, node);
                        else blockRefs.current.delete(block.index);
                      }}
                      onClick={() => setActiveIndex(block.index)}
                      aria-current={
                        activeIndex === block.index ? "true" : undefined
                      }
                      className={cn(
                        "press focus-visible:ring-ring block w-full rounded-2xl border p-3.5 text-left focus-visible:outline-none focus-visible:ring-2",
                        activeIndex === block.index
                          ? "border-primary bg-accent/35"
                          : "border-border bg-card hover:bg-secondary",
                      )}
                    >
                      <span className="text-primary block text-xs font-bold tabular-nums">
                        {formatRange(block.startMs, block.endMs)}
                      </span>
                      <span className="text-foreground mt-1 block text-sm leading-relaxed">
                        {block.text}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <div className="space-y-4">
              <div className="border-border bg-secondary/60 rounded-2xl border p-4">
                <p className="text-foreground text-sm font-semibold">
                  No timestamps for this recording
                </p>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  {data.canGenerateTimestamps
                    ? "It was transcribed before timestamps were saved. You can add them now: the recording is processed again, and your text stays exactly as it is."
                    : "The speech recognizer didn't provide timing for it, so only the text is available."}
                </p>
                {data.canGenerateTimestamps && (
                  <Button
                    className="mt-3"
                    size="sm"
                    onClick={() => void generateTimestamps()}
                    disabled={generating}
                  >
                    {generating ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Search />
                    )}
                    {generating ? "Adding timestamps…" : "Add timestamps"}
                  </Button>
                )}
                {generateError && (
                  <p className="text-destructive mt-2 text-xs" role="alert">
                    {generateError}
                  </p>
                )}
              </div>
              {data.fallbackText ? (
                <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
                  {data.fallbackText}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  There&apos;s no transcript text yet.
                </p>
              )}
            </div>
          )}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
