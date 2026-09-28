"use client";

import * as React from "react";
import { Camera, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

export interface PhotoUploaderPhoto {
  id: string;
  /** A displayable URL — typically a short-lived signed URL for a private
   * Storage object. The component doesn't know or care where it came from. */
  url: string;
}

export interface PhotoUploaderProps {
  photos: PhotoUploaderPhoto[];
  /** Fires with the newly picked file(s). Uploading is the caller's job —
   * this component is presentation-only, same as every other packages/ui
   * component that touches app data (e.g. RecordButton knows nothing about
   * the recordings API). */
  onFilesSelected: (files: File[]) => void;
  uploading?: boolean;
  maxPhotos?: number;
  className?: string;
}

/**
 * A single camera-icon trigger button — no large "tap to upload" box, no
 * thumbnail strip attached. Meant to sit directly beside a RichTextEditor's
 * own Bold/Italic toolbar buttons (same row, same size, same affordance
 * language) via its `toolbarEnd` slot, for a cleaner, more editor-like feel
 * than a separate photo-forward block. Pair with `PhotoThumbnailStrip` to
 * show already-added photos elsewhere in the layout — the two are split so
 * the trigger can live in a toolbar row while the thumbnails live in normal
 * document flow underneath.
 */
function PhotoUploader({
  photos,
  onFilesSelected,
  uploading = false,
  maxPhotos = 6,
  className,
}: PhotoUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const canAddMore = photos.length < maxPhotos;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onFilesSelected(files);
    // Reset so picking the same file again later still fires onChange.
    e.target.value = "";
  }

  function openPicker() {
    if (!uploading && canAddMore) inputRef.current?.click();
  }

  return (
    <div className={cn("inline-flex", className)}>
      <button
        type="button"
        onClick={openPicker}
        disabled={uploading || !canAddMore}
        aria-label="Add photo"
        className="hover:bg-accent hover:text-foreground text-muted-foreground flex size-8 items-center justify-center rounded-md transition-colors disabled:opacity-40"
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Camera className="size-4" />
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

export interface PhotoThumbnailStripProps {
  photos: PhotoUploaderPhoto[];
  className?: string;
}

/** Small thumbnail row for photos already attached to an entry. Renders
 * nothing when there are none — pairs with `PhotoUploader`'s trigger
 * button, which typically lives elsewhere (e.g. a RichTextEditor toolbar). */
function PhotoThumbnailStrip({ photos, className }: PhotoThumbnailStripProps) {
  if (photos.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {photos.map((photo) => (
        // Plain <img>, deliberately: these are dynamic, per-request signed
        // URLs for private Storage objects — next/image's remote-domain
        // allowlisting and optimization pipeline don't fit that shape well,
        // and this file isn't linted by apps/web's Next-specific ESLint
        // rules anyway (packages/ui has its own, thinner config).
        <img
          key={photo.id}
          src={photo.url}
          alt=""
          className="border-border size-16 rounded-md border object-cover"
        />
      ))}
    </div>
  );
}

export { PhotoUploader, PhotoThumbnailStrip };
