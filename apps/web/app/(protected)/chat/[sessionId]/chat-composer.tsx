"use client";

import * as React from "react";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "@mindreva/ui";

/** Grows with the text up to about five lines, then scrolls. */
const MAX_LINES = 5;
const LINE_HEIGHT_PX = 22; // the body style: 17/22

/**
 * The message box. A multi-line field that grows as you type, and one
 * fixed-size round button that is Send (tinted, enabled with text) or Stop
 * while a reply is being written — the same footprint either way, so
 * nothing shifts. Enter sends; Shift+Enter makes a new line.
 *
 * While sending, the field is readOnly rather than disabled: a disabled
 * field loses focus, which would drop the iOS keyboard after every message.
 */
export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  paused,
  pausedHint,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  /** A reply is being written. */
  busy: boolean;
  /** Today's limit is reached: the draft stays, sending waits. */
  paused: boolean;
  pausedHint: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  // Size to content, capped at MAX_LINES (layout only, no state).
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const max = MAX_LINES * LINE_HEIGHT_PX + 20; // + vertical padding
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [value]);

  const canSend = !busy && !paused && value.trim().length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend();
      }}
      className="flex items-end gap-2"
    >
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (canSend) onSend();
          }
        }}
        placeholder={paused ? pausedHint : "Ask your past self…"}
        aria-label="Ask your past self"
        enterKeyHint="send"
        autoComplete="off"
        readOnly={busy || paused}
        maxLength={2000}
        className={cn(
          "border-separator bg-card text-foreground text-body placeholder:text-muted-foreground focus-visible:ring-ring/40 min-h-11 flex-1 resize-none rounded-[1.375rem] border-[0.5px] px-4 py-[0.5625rem] focus-visible:outline-none focus-visible:ring-[3px]",
          paused && "opacity-70",
        )}
      />
      {busy ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stop"
          className="bg-foreground text-background focus-visible:ring-ring press flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2"
        >
          <Square className="size-4 fill-current" aria-hidden />
        </button>
      ) : (
        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          className={cn(
            "focus-visible:ring-ring press flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2",
            "transition-[background-color,color,transform] duration-150",
            canSend
              ? "bg-primary text-primary-foreground scale-100"
              : "bg-secondary text-muted-foreground scale-95",
          )}
        >
          <ArrowUp className="size-5" strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </form>
  );
}
