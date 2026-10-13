/**
 * The journal body format: Markdown with two additions on top of bold/italic.
 *
 * Inline images are a block token on their own line, in document order:
 *
 *   ![optional alt](mindreva-photo:<photo-id>?size=m&align=left)
 *
 * `photo-id` is an `entry_photos.id` (the image itself lives in Storage; the
 * token only references it, never a temporary URL). Because the tokens sit in
 * the same string as the text, the order of text and images is preserved
 * exactly, and the format stays plain text for search, LLMs (after
 * `stripFormatting`) and export.
 *
 * This file is the single source of truth for the grammar: the editor, the
 * public share page and the text stripper all use it.
 */

export type JournalImageSize = "s" | "m" | "l" | "full";
export type JournalImageAlign = "left" | "center" | "right";

export interface JournalImageAttrs {
  photoId: string;
  size: JournalImageSize;
  align: JournalImageAlign;
  alt: string;
}

export const JOURNAL_IMAGE_SIZES: readonly JournalImageSize[] = [
  "s",
  "m",
  "l",
  "full",
];
export const JOURNAL_IMAGE_ALIGNS: readonly JournalImageAlign[] = [
  "left",
  "center",
  "right",
];

export const DEFAULT_IMAGE_SIZE: JournalImageSize = "l";
export const DEFAULT_IMAGE_ALIGN: JournalImageAlign = "center";

/** Matches a whole line that is an image token. Groups: alt, photoId, query. */
export const IMAGE_LINE_REGEX =
  /^!\[([^\]]*)\]\(mindreva-photo:([0-9a-fA-F-]{36})(?:\?([^)]*))?\)\s*$/;

function isSize(value: string | null): value is JournalImageSize {
  return (
    value !== null && (JOURNAL_IMAGE_SIZES as readonly string[]).includes(value)
  );
}
function isAlign(value: string | null): value is JournalImageAlign {
  return (
    value !== null &&
    (JOURNAL_IMAGE_ALIGNS as readonly string[]).includes(value)
  );
}

/** Tiny `a=b&c=d` reader; this package has no DOM lib, so no URLSearchParams. */
function parseQuery(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of query.split("&")) {
    const eq = pair.indexOf("=");
    if (eq > 0) out[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return out;
}

export function parseImageLine(line: string): JournalImageAttrs | null {
  const match = IMAGE_LINE_REGEX.exec(line);
  if (!match) return null;
  const params = parseQuery(match[3] ?? "");
  const size = params.size ?? null;
  const align = params.align ?? null;
  return {
    photoId: match[2]!.toLowerCase(),
    size: isSize(size) ? size : DEFAULT_IMAGE_SIZE,
    align: isAlign(align) ? align : DEFAULT_IMAGE_ALIGN,
    alt: match[1] ?? "",
  };
}

export function formatImageToken(attrs: JournalImageAttrs): string {
  // `]` and newlines would end the alt text early, so they're flattened.
  const alt = attrs.alt.replace(/[\]\n\r]/g, " ").trim();
  return `![${alt}](mindreva-photo:${attrs.photoId}?size=${attrs.size}&align=${attrs.align})`;
}

/** Every photo id referenced by inline image tokens in the body, in order. */
export function extractInlinePhotoIds(markdown: string): string[] {
  const ids: string[] = [];
  for (const line of markdown.split("\n")) {
    const image = parseImageLine(line);
    if (image) ids.push(image.photoId);
  }
  return ids;
}

/** A run of text with its bold/italic marks, from `**bold**` and `*italic*`. */
export interface InlineSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

export type JournalBlock =
  | { type: "paragraph"; inline: InlineSegment[] }
  | ({ type: "image" } & JournalImageAttrs);

/** Splits a line of text into styled runs. Bold is matched before italic. */
export function parseInline(text: string): InlineSegment[] {
  const out: InlineSegment[] = [];
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const start = match.index ?? 0;
    if (start > last) {
      out.push({ text: text.slice(last, start), bold: false, italic: false });
    }
    if (match[1] !== undefined) {
      out.push({ text: match[1], bold: true, italic: false });
    } else if (match[2] !== undefined) {
      out.push({ text: match[2], bold: false, italic: true });
    }
    last = start + match[0].length;
  }
  if (last < text.length) {
    out.push({ text: text.slice(last), bold: false, italic: false });
  }
  return out;
}

/**
 * Parses a journal body into ordered blocks: paragraphs (blank-line separated;
 * single newlines stay inside a paragraph) and images. Used to render a read-
 * only view (the public share page) without loading the editor.
 */
export function parseJournalMarkdown(markdown: string): JournalBlock[] {
  const blocks: JournalBlock[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const text = buffer.join("\n");
    blocks.push({ type: "paragraph", inline: parseInline(text) });
    buffer = [];
  };

  for (const line of markdown.split("\n")) {
    const image = parseImageLine(line);
    if (image) {
      flush();
      blocks.push({ type: "image", ...image });
    } else if (line.trim() === "") {
      flush();
    } else {
      buffer.push(line);
    }
  }
  flush();
  return blocks;
}
