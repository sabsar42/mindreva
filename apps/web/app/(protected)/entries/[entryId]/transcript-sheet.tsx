"use client";

import * as React from "react";
import { FileText, Loader2 } from "lucide-react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
  IconTile,
  Skeleton,
} from "@mindreva/ui";
import { groupSegments } from "@/lib/transcript/segments";
import type { Segment } from "@/lib/transcript/segments";

interface RecordingTranscriptData {
  recordingIndex: number;
  recordedAt: string | null;
  status: "pending" | "processing" | "done" | "failed" | null;
  segments: Segment[] | null;
  fallbackText: string | null;
  canGenerateTimestamps: boolean;
}

interface TranscriptSheetData {
  recordings: RecordingTranscriptData[];
}

function RecordingLabel({
  index,
  recordedAt,
  total,
}: {
  index: number;
  recordedAt: string | null;
  total: number;
}) {
  if (total <= 1) return null;
  const date = recordedAt
    ? new Date(recordedAt).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  return (
    <p className="text-primary mb-2 mt-4 text-xs font-bold uppercase tracking-widest first:mt-0">
      Recording {index}
      {date ? ` — ${date}` : ""}
    </p>
  );
}

function RecordingSection({
  recording,
  total,
}: {
  recording: RecordingTranscriptData;
  total: number;
}) {
  const plainText = React.useMemo(() => {
    if (recording.segments && recording.segments.length > 0) {
      return groupSegments(recording.segments)
        .map((b) => b.text)
        .join(" ");
    }
    return recording.fallbackText;
  }, [recording.segments, recording.fallbackText]);

  if (recording.status === "pending" || recording.status === "processing") {
    return (
      <>
        <RecordingLabel
          index={recording.recordingIndex}
          recordedAt={recording.recordedAt}
          total={total}
        />
        <p className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Still transcribing. Check back in a moment.
        </p>
      </>
    );
  }

  if (recording.status === "failed") {
    return (
      <>
        <RecordingLabel
          index={recording.recordingIndex}
          recordedAt={recording.recordedAt}
          total={total}
        />
        <p className="text-muted-foreground py-4 text-sm">
          This recording couldn&apos;t be transcribed.
        </p>
      </>
    );
  }

  return (
    <>
      <RecordingLabel
        index={recording.recordingIndex}
        recordedAt={recording.recordedAt}
        total={total}
      />
      {plainText ? (
        <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">
          {plainText}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          There&apos;s no transcript text yet.
        </p>
      )}
    </>
  );
}

export function TranscriptSheet({
  entryId,
  open,
  onOpenChange,
  refreshToken = 0,
}: {
  entryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Increment to trigger a reload while the sheet is open (e.g. after a new
   *  recording finishes transcribing). */
  refreshToken?: number;
}) {
  const [data, setData] = React.useState<TranscriptSheetData | null>(null);
  const [loadError, setLoadError] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch(`/api/entries/${entryId}/transcript/segments`);
      if (!res.ok) throw new Error("load failed");
      setData((await res.json()) as TranscriptSheetData);
    } catch {
      setLoadError(true);
    }
  }, [entryId]);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // When a new recording finishes transcribing, reload if the sheet is open.
  const prevTokenRef = React.useRef(refreshToken);
  React.useEffect(() => {
    if (refreshToken !== prevTokenRef.current) {
      prevTokenRef.current = refreshToken;
      if (open) void load();
    }
  }, [refreshToken, open, load]);

  const total = data?.recordings.length ?? 0;

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
              What was said, word for word.
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
          ) : data.recordings.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No recordings yet.
            </p>
          ) : (
            <div className="space-y-1">
              {data.recordings.map((rec) => (
                <RecordingSection
                  key={rec.recordingIndex}
                  recording={rec}
                  total={total}
                />
              ))}
            </div>
          )}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
