"use client";

import * as React from "react";
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isParagraphNode,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  type EditorState,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
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
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  ImagePlus,
  Italic,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  DEFAULT_IMAGE_ALIGN,
  DEFAULT_IMAGE_SIZE,
  type JournalImageAlign,
  type JournalImageAttrs,
  type JournalImageSize,
} from "@mindreva/types";
import { cn } from "../lib/utils";
import {
  $createJournalImageNode,
  $isJournalImageNode,
  JOURNAL_IMAGE_TRANSFORMER,
  JournalImageNode,
  JournalImageUrlsContext,
} from "./journal-image-node";

export interface UploadedImage {
  photoId: string;
  url: string;
}

export interface RichTextEditorProps {
  /** Markdown source, the single source of truth: bold/italic plus inline image
   * tokens (see @mindreva/types journal-markdown). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  textareaClassName?: string;
  /** photoId -> signed URL for pictures already in the body. */
  imageUrls?: Record<string, string>;
  /**
   * Uploads a picture and returns its id and a displayable URL. When omitted
   * the "Add a picture" action is hidden. The editor inserts the picture at the
   * cursor itself; the caller only owns persistence.
   */
  onUploadImage?: (file: File) => Promise<UploadedImage>;
  /** Called with a short message when a picture fails to upload. */
  onImageError?: (message: string) => void;
}

// Bold/italic plus the picture block. Deliberately excludes headings, lists,
// quotes, code and links: this restricted list is passed to both the import and
// the export, which keeps the editor's vocabulary to exactly what the toolbar
// exposes. The image transformer is listed first so a picture line is matched
// before anything else.
const TRANSFORMERS: Transformer[] = [
  JOURNAL_IMAGE_TRANSFORMER,
  BOLD_STAR,
  ITALIC_STAR,
];

const SIZE_OPTIONS: { value: JournalImageSize; label: string }[] = [
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "full", label: "Full" },
];

const ALIGN_OPTIONS: {
  value: JournalImageAlign;
  label: string;
  Icon: typeof AlignLeft;
}[] = [
  { value: "left", label: "Align left", Icon: AlignLeft },
  { value: "center", label: "Center", Icon: AlignCenter },
  { value: "right", label: "Align right", Icon: AlignRight },
];

/** Offset of the caret within its top-level block's text. */
function offsetInBlock(
  block: ElementNode,
  anchorNode: LexicalNode,
  anchorOffset: number,
): number {
  let total = 0;
  for (const text of block.getAllTextNodes()) {
    if (text.is(anchorNode)) return total + anchorOffset;
    total += text.getTextContentSize();
  }
  return total;
}

/**
 * Inserts a picture block at the caret, preserving surrounding text:
 *  - in the middle of a paragraph, the paragraph is split and the picture goes
 *    between the two halves (typing continues where the sentence left off);
 *  - at the start or end of a paragraph, or in an empty one, it goes before or
 *    after it, and a fresh empty paragraph is left to keep writing in.
 * With no caret (editor never focused) it is appended to the end.
 */
function $insertPicture(attrs: JournalImageAttrs): void {
  const node = $createJournalImageNode(attrs);
  const selection = $getSelection();
  let caretAtStartOfNext = false;

  if ($isRangeSelection(selection)) {
    if (!selection.isCollapsed()) selection.removeText();
    const anchor = selection.anchor;
    const top = anchor.getNode().getTopLevelElement();

    if (top && $isParagraphNode(top)) {
      const length = top.getTextContentSize();
      if (length === 0) {
        top.insertBefore(node);
      } else {
        const offset = offsetInBlock(top, anchor.getNode(), anchor.offset);
        if (offset <= 0) {
          top.insertBefore(node);
        } else if (offset >= length) {
          top.insertAfter(node);
        } else {
          selection.insertParagraph();
          const after = $getSelection();
          const block = $isRangeSelection(after)
            ? after.anchor.getNode().getTopLevelElement()
            : null;
          if (block) {
            block.insertBefore(node);
            caretAtStartOfNext = true;
          } else {
            top.insertAfter(node);
          }
        }
      }
    } else if (top) {
      top.insertAfter(node);
    } else {
      $getRoot().append(node);
    }
  } else {
    $getRoot().append(node);
  }

  const next = node.getNextSibling();
  if (caretAtStartOfNext && $isElementNode(next)) {
    next.selectStart();
  } else if ($isParagraphNode(next) && next.getTextContentSize() === 0) {
    next.selectStart();
  } else {
    const paragraph = $createParagraphNode();
    node.insertAfter(paragraph);
    paragraph.selectStart();
  }
}

interface SelectedImage {
  key: string;
  attrs: JournalImageAttrs;
}

const toolButton =
  "hover:bg-secondary hover:text-foreground focus-visible:ring-ring flex size-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2";

function Toolbar({
  canAddPicture,
  uploading,
  onPickFiles,
}: {
  canAddPicture: boolean;
  uploading: boolean;
  onPickFiles: (files: File[]) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = React.useState(false);
  const [isItalic, setIsItalic] = React.useState(false);
  const [selected, setSelected] = React.useState<SelectedImage | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if ($isNodeSelection(selection)) {
          const nodes = selection.getNodes();
          const only = nodes.length === 1 ? nodes[0] : null;
          if ($isJournalImageNode(only)) {
            setSelected({ key: only.getKey(), attrs: only.getAttrs() });
            return;
          }
        }
        setSelected(null);
        if ($isRangeSelection(selection)) {
          setIsBold(selection.hasFormat("bold"));
          setIsItalic(selection.hasFormat("italic"));
        }
      });
    });
  }, [editor]);

  const withImage = (fn: (node: JournalImageNode) => void) => {
    if (!selected) return;
    editor.update(() => {
      const node = $getNodeByKey(selected.key);
      if ($isJournalImageNode(node)) fn(node);
    });
  };

  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  if (selected) {
    const { attrs } = selected;
    return (
      <div
        role="toolbar"
        aria-label="Picture options"
        className="border-border bg-card shadow-subtle motion-safe:animate-pop-in mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border p-2"
      >
        <div
          className="flex items-center gap-0.5"
          role="group"
          aria-label="Size"
        >
          {SIZE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onMouseDown={keepFocus}
              onClick={() => withImage((n) => n.setSize(option.value))}
              aria-pressed={attrs.size === option.value}
              aria-label={`Size ${option.label}`}
              className={cn(
                "h-8 min-w-8 rounded-md px-2 text-xs font-semibold transition-colors",
                attrs.size === option.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div
          className="flex items-center gap-0.5"
          role="group"
          aria-label="Alignment"
        >
          {ALIGN_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onMouseDown={keepFocus}
              onClick={() => withImage((n) => n.setAlign(value))}
              aria-pressed={attrs.align === value}
              aria-label={label}
              className={cn(
                toolButton,
                attrs.align === value
                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>

        <div
          className="flex items-center gap-0.5"
          role="group"
          aria-label="Position"
        >
          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={() =>
              withImage((n) => {
                const previous = n.getPreviousSibling();
                if (previous) previous.insertBefore(n);
              })
            }
            aria-label="Move picture up"
            className={cn(toolButton, "text-muted-foreground")}
          >
            <ArrowUp className="size-4" />
          </button>
          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={() =>
              withImage((n) => {
                const next = n.getNextSibling();
                if (next) next.insertAfter(n);
              })
            }
            aria-label="Move picture down"
            className={cn(toolButton, "text-muted-foreground")}
          >
            <ArrowDown className="size-4" />
          </button>
          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={() => withImage((n) => n.remove())}
            aria-label="Remove picture"
            className={cn(
              toolButton,
              "text-muted-foreground hover:text-destructive",
            )}
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        <input
          type="text"
          value={attrs.alt}
          onChange={(e) => withImage((n) => n.setAlt(e.target.value))}
          placeholder="Describe this picture (optional)"
          aria-label="Picture description"
          maxLength={200}
          className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/20 h-8 min-w-40 flex-1 rounded-full border px-3 text-xs focus-visible:outline-none focus-visible:ring-2"
        />
        <p className="text-muted-foreground w-full text-[11px] leading-snug">
          Small and medium pictures aligned left or right let the text wrap
          around them.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-2 flex items-center gap-1">
      <button
        type="button"
        onMouseDown={keepFocus}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
        aria-label="Bold"
        aria-pressed={isBold}
        className={cn(
          toolButton,
          isBold ? "bg-accent text-accent-foreground" : "text-muted-foreground",
        )}
      >
        <Bold className="size-4" />
      </button>
      <button
        type="button"
        onMouseDown={keepFocus}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
        aria-label="Italic"
        aria-pressed={isItalic}
        className={cn(
          toolButton,
          isItalic
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground",
        )}
      >
        <Italic className="size-4" />
      </button>

      {canAddPicture && (
        <>
          <span aria-hidden className="bg-border mx-1 h-5 w-px" />
          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Add a picture"
            className="text-primary hover:bg-secondary focus-visible:ring-ring flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
            Add a picture
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            data-testid="inline-image-input"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (files.length > 0) onPickFiles(files);
            }}
          />
        </>
      )}
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
 * A distraction-free journal editor built on Lexical. Bold and italic render
 * styled while typing, and pictures are real blocks in the document: they sit
 * between paragraphs in the order they were inserted, text can wrap beside the
 * small ones, and each can be resized, aligned, moved or removed without
 * touching the text around it.
 *
 * Markdown is the storage format (transcripts.edited_text): the initial value
 * is parsed into the node tree once, and every edit is serialized back to the
 * same restricted vocabulary. A picture is stored as a token that references an
 * `entry_photos` row by id (never a temporary URL), so order is preserved and
 * the text stays plain for search and for the LLM (see `stripFormatting`).
 */
function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  textareaClassName,
  imageUrls,
  onUploadImage,
  onImageError,
}: RichTextEditorProps) {
  // Lexical's editor state isn't a controlled React prop — the initial value
  // seeds it once via initialConfig.editorState, and later external changes
  // (e.g. the transcript-review poll overwriting the whole confirmedText)
  // are applied imperatively in the effect below, not through a re-render.
  const editorRef = React.useRef<LexicalEditor | null>(null);
  const lastSyncedValueRef = React.useRef(value);
  const [uploading, setUploading] = React.useState(false);
  // URLs of pictures uploaded during this session, merged over the server's.
  const [localUrls, setLocalUrls] = React.useState<Record<string, string>>({});
  const allUrls = React.useMemo(
    () => ({ ...imageUrls, ...localUrls }),
    [imageUrls, localUrls],
  );

  const initialConfig = {
    namespace: "RichTextEditor",
    nodes: [JournalImageNode],
    theme: { paragraph: "mb-3 last:mb-0" },
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

  async function handleFiles(files: File[]) {
    const editor = editorRef.current;
    if (!editor || !onUploadImage) return;
    setUploading(true);
    try {
      // One at a time so several pictures land in the order they were chosen.
      for (const file of files) {
        try {
          const uploaded = await onUploadImage(file);
          setLocalUrls((prev) => ({
            ...prev,
            [uploaded.photoId]: uploaded.url,
          }));
          editor.update(() => {
            $insertPicture({
              photoId: uploaded.photoId,
              size: DEFAULT_IMAGE_SIZE,
              align: DEFAULT_IMAGE_ALIGN,
              alt: "",
            });
          });
        } catch {
          onImageError?.(`Couldn't add "${file.name}". Please try again.`);
        }
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={cn("w-full", className)}>
      <JournalImageUrlsContext.Provider value={allUrls}>
        <LexicalComposer initialConfig={initialConfig}>
          <div className="bg-background/85 sticky top-0 z-10 -mx-1 px-1 pt-1 backdrop-blur">
            <Toolbar
              canAddPicture={Boolean(onUploadImage)}
              uploading={uploading}
              onPickFiles={(files) => void handleFiles(files)}
            />
          </div>
          <div className="relative">
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className={cn(
                    // flow-root contains floated pictures so the editor grows
                    // to fit them instead of letting them spill out below.
                    "text-foreground flow-root w-full text-[1.0625rem] leading-[1.75] focus-visible:outline-none",
                    textareaClassName,
                  )}
                  aria-placeholder={placeholder ?? ""}
                  placeholder={
                    <div className="text-muted-foreground pointer-events-none absolute top-0 select-none text-[1.0625rem] leading-[1.75]">
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
      </JournalImageUrlsContext.Provider>
    </div>
  );
}

export { RichTextEditor };
