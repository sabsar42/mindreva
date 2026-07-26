"use client";

import * as React from "react";
import { Bold, Italic } from "lucide-react";
import { cn } from "../lib/utils";

export interface RichTextEditorProps {
  /** Markdown source — the single source of truth. Bold/italic only:
   * `**bold**` and `*italic*`, nothing else this editor produces or expects. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  textareaClassName?: string;
}

/**
 * Minimal bold/italic Markdown editor: a plain textarea plus a two-button
 * toolbar that wraps the current selection with `**`/`*` markers. The
 * editing surface shows raw Markdown syntax rather than rendering it live —
 * deliberately, to avoid pulling in a WYSIWYG library for a two-mark feature
 * set. Markdown is the storage format everywhere this is used; see
 * `stripFormatting()` for converting it to plain text before it reaches an
 * LLM or a plain-text display context.
 */
function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  textareaClassName,
}: RichTextEditorProps) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  function wrapSelection(marker: string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const before = value.slice(0, selectionStart);
    const selected = value.slice(selectionStart, selectionEnd);
    const after = value.slice(selectionEnd);

    // Toggle off if the selection is already wrapped by exactly this marker —
    // otherwise wrap it. Keeps repeated clicks from stacking markers.
    const alreadyWrapped =
      selected.startsWith(marker) &&
      selected.endsWith(marker) &&
      selected.length >= marker.length * 2;

    const nextSelected = alreadyWrapped
      ? selected.slice(marker.length, selected.length - marker.length)
      : `${marker}${selected}${marker}`;

    const next = `${before}${nextSelected}${after}`;
    onChange(next);

    // Restore focus and select the (un)wrapped text, matching how a normal
    // bold/italic toolbar button behaves in any text editor.
    requestAnimationFrame(() => {
      el.focus();
      const start = before.length;
      el.setSelectionRange(start, start + nextSelected.length);
    });
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={() => wrapSelection("**")}
          aria-label="Bold"
          className="text-muted-foreground hover:bg-warm-100 hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors"
        >
          <Bold className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => wrapSelection("*")}
          aria-label="Italic"
          className="text-muted-foreground hover:bg-warm-100 hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors"
        >
          <Italic className="size-4" />
        </button>
      </div>

      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "text-foreground placeholder:text-muted-foreground w-full resize-none text-base leading-relaxed focus-visible:outline-none",
          textareaClassName,
        )}
      />
    </div>
  );
}

export { RichTextEditor };
