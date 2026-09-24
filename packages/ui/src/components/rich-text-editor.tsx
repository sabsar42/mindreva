"use client";

import * as React from "react";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  type EditorState,
  type LexicalEditor,
} from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  BOLD_STAR,
  ITALIC_STAR,
  type Transformer,
} from "@lexical/markdown";
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
  /** Rendered at the trailing end of the Bold/Italic toolbar row — e.g. a
   * camera-icon photo trigger. Purely a layout slot: this component stays
   * agnostic to what's inside it (still bold/italic only as far as the
   * editor itself is concerned), the caller owns whatever it renders here. */
  toolbarEnd?: React.ReactNode;
}

// Bold/italic only — deliberately excludes headings, lists, quotes, code,
// links, and BOLD_ITALIC_STAR (the combined ***text*** marker). Passing this
// restricted list to both $convertFromMarkdownString and
// $convertToMarkdownString is what keeps the editor's vocabulary limited to
// exactly the two marks the toolbar exposes.
const TRANSFORMERS: Transformer[] = [BOLD_STAR, ITALIC_STAR];

function ToolbarPlugin({ toolbarEnd }: { toolbarEnd?: React.ReactNode }) {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = React.useState(false);
  const [isItalic, setIsItalic] = React.useState(false);

  React.useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          setIsBold(selection.hasFormat("bold"));
          setIsItalic(selection.hasFormat("italic"));
        }
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  return (
    <div className="mb-1.5 flex items-center justify-between gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
          aria-label="Bold"
          aria-pressed={isBold}
          className={cn(
            "hover:bg-accent hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors",
            isBold
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground",
          )}
        >
          <Bold className="size-4" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
          aria-label="Italic"
          aria-pressed={isItalic}
          className={cn(
            "hover:bg-accent hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors",
            isItalic
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground",
          )}
        >
          <Italic className="size-4" />
        </button>
      </div>
      {toolbarEnd}
    </div>
  );
}

/** Bridges Lexical's internal editor state to the plain Markdown string this
 * component's value/onChange contract uses everywhere else in the app. */
function MarkdownSyncPlugin({
  onChange,
}: {
  onChange: (markdown: string) => void;
}) {
  function handleChange(editorState: EditorState) {
    editorState.read(() => {
      onChange($convertToMarkdownString(TRANSFORMERS));
    });
  }
  return <OnChangePlugin onChange={handleChange} ignoreSelectionChange />;
}

function EditorRefPlugin({
  editorRef,
}: {
  editorRef: React.MutableRefObject<LexicalEditor | null>;
}) {
  const [editor] = useLexicalComposerContext();
  React.useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);
  return null;
}

/**
 * Real WYSIWYG bold/italic editor built on Lexical — bold and italic render
 * styled while typing, not as visible `**`/`*` markers. Markdown stays the
 * storage format everywhere this is used (transcripts.edited_text): the
 * initial value is parsed into the editor's node tree once, and every edit
 * is serialized back to the same restricted Markdown vocabulary via
 * TRANSFORMERS. See `stripFormatting()` for converting that Markdown to
 * plain text before it reaches an LLM or a plain-text display context.
 */
function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  textareaClassName,
  toolbarEnd,
}: RichTextEditorProps) {
  // Lexical's editor state isn't a controlled React prop — the initial value
  // seeds it once via initialConfig.editorState, and later external changes
  // (e.g. the transcript-review poll overwriting the whole confirmedText)
  // are applied imperatively in the effect below, not through a re-render.
  const editorRef = React.useRef<LexicalEditor | null>(null);
  const lastSyncedValueRef = React.useRef(value);

  const initialConfig = {
    namespace: "RichTextEditor",
    onError(error: Error) {
      throw error;
    },
    editorState: () => {
      $convertFromMarkdownString(value, TRANSFORMERS);
    },
  };

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    // Only re-sync when the value changed from outside this editor — an
    // update triggered by this editor's own onChange already matches
    // lastSyncedValueRef, so re-applying it would just reset the cursor.
    if (value === lastSyncedValueRef.current) return;
    lastSyncedValueRef.current = value;
    editor.update(() => {
      $getRoot().clear();
      $convertFromMarkdownString(value, TRANSFORMERS);
    });
  }, [value]);

  return (
    <div className={cn("w-full", className)}>
      <LexicalComposer initialConfig={initialConfig}>
        <ToolbarPlugin toolbarEnd={toolbarEnd} />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className={cn(
                  "text-foreground w-full text-base leading-relaxed focus-visible:outline-none",
                  textareaClassName,
                )}
                aria-placeholder={placeholder ?? ""}
                placeholder={
                  <div className="text-muted-foreground pointer-events-none absolute top-0 select-none">
                    {placeholder}
                  </div>
                }
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <MarkdownSyncPlugin
          onChange={(markdown) => {
            lastSyncedValueRef.current = markdown;
            onChange(markdown);
          }}
        />
        <EditorRefPlugin editorRef={editorRef} />
      </LexicalComposer>
    </div>
  );
}

export { RichTextEditor };
