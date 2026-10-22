"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTitle,
  Button,
  Textarea,
  haptic,
} from "@mindreva/ui";

/**
 * Write an entry: an iOS compose sheet (Cancel · New entry · Save). Saving
 * goes through the existing POST /api/entries (a text journal entry), then
 * opens the entry in the full editor. On failure the text stays put with an
 * inline message; nothing is lost.
 */
export function WriteSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  async function save() {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, type: "journal" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { entryId } = (await res.json()) as { entryId: string };
      haptic("success");
      setText("");
      onOpenChange(false);
      router.push(`/entries/${entryId}`);
    } catch {
      setError("Couldn't save just now. Your words are still here; try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          ref.current?.focus();
        }}
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-primary justify-self-start px-2"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <BottomSheetTitle className="text-headline text-foreground normal-case tracking-normal">
            New entry
          </BottomSheetTitle>
          <Button
            size="sm"
            className="justify-self-end"
            loading={saving}
            disabled={!text.trim()}
            onClick={() => void save()}
          >
            Save
          </Button>
        </div>
        <Textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
          }}
          placeholder="What's on your mind?"
          aria-label="Entry text"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "write-error" : undefined}
          className="mt-3 min-h-[40dvh] resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
        />
        {error && (
          <p
            id="write-error"
            role="alert"
            className="text-footnote text-destructive mt-2"
          >
            {error}
          </p>
        )}
      </BottomSheetContent>
    </BottomSheet>
  );
}
