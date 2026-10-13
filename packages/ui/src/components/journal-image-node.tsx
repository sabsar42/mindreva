"use client";

import * as React from "react";
import {
  $applyNodeReplacement,
  $getNodeByKey,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  DecoratorNode,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import type { ElementTransformer } from "@lexical/markdown";
import {
  formatImageToken,
  parseImageLine,
  type JournalImageAlign,
  type JournalImageAttrs,
  type JournalImageSize,
} from "@mindreva/types";
import { cn } from "../lib/utils";
import { journalImageWrapperClass } from "./journal-image";

/**
 * photoId -> signed URL for every picture the editor can show. The Markdown only
 * stores the id (never a URL), so the editor needs this map to display them.
 */
export const JournalImageUrlsContext = React.createContext<
  Record<string, string>
>({});

type SerializedJournalImageNode = Spread<
  {
    photoId: string;
    size: JournalImageSize;
    align: JournalImageAlign;
    alt: string;
  },
  SerializedLexicalNode
>;

function JournalImageView({
  nodeKey,
  photoId,
  alt,
}: {
  nodeKey: NodeKey;
  photoId: string;
  alt: string;
}) {
  const [editor] = useLexicalComposerContext();
  const urls = React.useContext(JournalImageUrlsContext);
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  const url = urls[photoId];
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  // Clicking selects the picture so its options appear; it never changes the
  // cover image. This goes through Lexical's CLICK_COMMAND rather than a React
  // onClick on purpose: the rich-text plugin clears any node selection on every
  // click (at the lowest priority), and a React handler would run first and have
  // its selection wiped. Handling it here, at a higher priority, and returning
  // true stops that clearing for clicks on a picture.
  React.useEffect(() => {
    return editor.registerCommand(
      CLICK_COMMAND,
      (event: MouseEvent) => {
        const button = buttonRef.current;
        if (!button || !(event.target instanceof Node)) return false;
        if (!button.contains(event.target)) return false;
        event.preventDefault();
        if (event.shiftKey) {
          setSelected(!isSelected);
        } else {
          clearSelection();
          setSelected(true);
        }
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, isSelected, setSelected, clearSelection]);

  // Delete / Backspace on a selected picture removes just that picture and
  // leaves the surrounding text alone.
  React.useEffect(() => {
    const remove = (event: KeyboardEvent | null) => {
      if (!isSelected) return false;
      event?.preventDefault();
      editor.update(() => {
        $getNodeByKey(nodeKey)?.remove();
      });
      return true;
    };
    const unregister = [
      editor.registerCommand(KEY_DELETE_COMMAND, remove, COMMAND_PRIORITY_LOW),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        remove,
        COMMAND_PRIORITY_LOW,
      ),
    ];
    return () => unregister.forEach((off) => off());
  }, [editor, isSelected, nodeKey]);

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={alt ? `Picture: ${alt}` : "Picture in this journal"}
      aria-pressed={isSelected}
      className={cn(
        "focus-visible:ring-ring block w-full cursor-pointer rounded-xl transition-shadow duration-200 focus-visible:outline-none focus-visible:ring-2",
        isSelected &&
          "ring-primary ring-offset-background ring-2 ring-offset-2",
      )}
    >
      {url ? (
        <img
          src={url}
          alt={alt}
          draggable={false}
          className="pointer-events-none block h-auto w-full rounded-xl object-cover"
        />
      ) : (
        <span className="bg-muted text-muted-foreground flex aspect-[4/3] w-full items-center justify-center rounded-xl text-xs">
          Picture unavailable
        </span>
      )}
    </button>
  );
}

/**
 * A picture inside the journal body. Block-level (it sits between paragraphs),
 * and its wrapper element carries the float/width classes, so following
 * paragraphs wrap beside small pictures. It stores only the photo id and its
 * layout; the image bytes live in Storage as an `entry_photos` row.
 */
export class JournalImageNode extends DecoratorNode<React.ReactNode> {
  __photoId: string;
  __size: JournalImageSize;
  __align: JournalImageAlign;
  __alt: string;

  static getType(): string {
    return "journal-image";
  }

  static clone(node: JournalImageNode): JournalImageNode {
    return new JournalImageNode(
      {
        photoId: node.__photoId,
        size: node.__size,
        align: node.__align,
        alt: node.__alt,
      },
      node.__key,
    );
  }

  static importJSON(serialized: SerializedJournalImageNode): JournalImageNode {
    return $createJournalImageNode({
      photoId: serialized.photoId,
      size: serialized.size,
      align: serialized.align,
      alt: serialized.alt,
    });
  }

  constructor(attrs: JournalImageAttrs, key?: NodeKey) {
    super(key);
    this.__photoId = attrs.photoId;
    this.__size = attrs.size;
    this.__align = attrs.align;
    this.__alt = attrs.alt;
  }

  exportJSON(): SerializedJournalImageNode {
    return {
      ...super.exportJSON(),
      type: "journal-image",
      version: 1,
      photoId: this.__photoId,
      size: this.__size,
      align: this.__align,
      alt: this.__alt,
    };
  }

  getAttrs(): JournalImageAttrs {
    const self = this.getLatest();
    return {
      photoId: self.__photoId,
      size: self.__size,
      align: self.__align,
      alt: self.__alt,
    };
  }

  setSize(size: JournalImageSize): void {
    this.getWritable().__size = size;
  }

  setAlign(align: JournalImageAlign): void {
    this.getWritable().__align = align;
  }

  setAlt(alt: string): void {
    this.getWritable().__alt = alt;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const element = document.createElement("div");
    element.className = journalImageWrapperClass(this.__size, this.__align);
    return element;
  }

  updateDOM(prev: JournalImageNode, dom: HTMLElement): boolean {
    if (prev.__size !== this.__size || prev.__align !== this.__align) {
      dom.className = journalImageWrapperClass(this.__size, this.__align);
    }
    // The decorator re-renders itself; the wrapper element is kept.
    return false;
  }

  isInline(): boolean {
    return false;
  }

  getTextContent(): string {
    return "";
  }

  decorate(): React.ReactNode {
    return (
      <JournalImageView
        nodeKey={this.__key}
        photoId={this.__photoId}
        alt={this.__alt}
      />
    );
  }
}

export function $createJournalImageNode(
  attrs: JournalImageAttrs,
): JournalImageNode {
  return $applyNodeReplacement(new JournalImageNode(attrs));
}

export function $isJournalImageNode(
  node: LexicalNode | null | undefined,
): node is JournalImageNode {
  return node instanceof JournalImageNode;
}

/**
 * Markdown <-> node bridge. Export writes the shared image token (see
 * @mindreva/types journal-markdown); import turns a token line back into a
 * node, so the same string round-trips through the editor unchanged.
 */
export const JOURNAL_IMAGE_TRANSFORMER: ElementTransformer = {
  dependencies: [JournalImageNode],
  export: (node) =>
    $isJournalImageNode(node) ? formatImageToken(node.getAttrs()) : null,
  regExp: /^!\[[^\]]*\]\(mindreva-photo:[0-9a-fA-F-]{36}(?:\?[^)]*)?\)\s?$/,
  replace: (parentNode, _children, match, isImport) => {
    const attrs = parseImageLine((match[0] ?? "").trimEnd());
    if (!attrs) return false;
    const node = $createJournalImageNode(attrs);
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(node);
    } else {
      parentNode.insertBefore(node);
    }
    return true;
  },
  type: "element",
};
