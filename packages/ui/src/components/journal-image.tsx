import * as React from "react";
import type { JournalImageAlign, JournalImageSize } from "@mindreva/types";
import { cn } from "../lib/utils";

/**
 * Layout for an image inside a journal body. One function decides it, and both
 * the editor (a Lexical node) and the read-only share page use it, so a picture
 * looks the same while writing and when shared.
 *
 * The rule is editorial:
 *  - small and medium pictures aligned left or right FLOAT, and the following
 *    text wraps around them;
 *  - everything else (large, full width, or centred) is a block on its own line
 *    with the text continuing below.
 *
 * Widths are a share of the column, so they scale with the screen; on a phone a
 * small picture is roughly a third of the width, never an overflow.
 */
export function journalImageWrapperClass(
  size: JournalImageSize,
  align: JournalImageAlign,
): string {
  const width =
    size === "s"
      ? "w-[38%]"
      : size === "m"
        ? "w-[55%]"
        : size === "l"
          ? "w-[80%]"
          : "w-full";

  const floats = (size === "s" || size === "m") && align !== "center";
  if (floats) {
    return cn(
      width,
      "mb-2 mt-1",
      align === "left" ? "float-left mr-4" : "float-right ml-4",
    );
  }

  const margin =
    align === "left" ? "mr-auto" : align === "right" ? "ml-auto" : "mx-auto";
  // clear-both so a block picture never sits beside an earlier floated one.
  return cn(width, margin, "clear-both my-4");
}

export interface JournalImageProps extends React.ComponentProps<"figure"> {
  src: string;
  alt?: string;
  size: JournalImageSize;
  align: JournalImageAlign;
}

/** A read-only inline image (used by the public share page). */
function JournalImage({
  src,
  alt = "",
  size,
  align,
  className,
  ...props
}: JournalImageProps) {
  return (
    <figure
      className={cn(journalImageWrapperClass(size, align), className)}
      {...props}
    >
      {/* Signed Storage URLs are short-lived and per-request, so a plain <img>
          is used instead of next/image (same reasoning as NoteCard). */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="h-auto w-full rounded-xl object-cover"
      />
    </figure>
  );
}

export { JournalImage };
