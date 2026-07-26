"use client";

import * as React from "react";
import { ImagePlus, Loader2 } from "lucide-react";
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
 * A row of photo thumbnails plus an "add photo" tile. Used on both the
 * record screen (attach while/after recording) and the entry detail screen
 * (add more photos later) — same component, same upload affordance.
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
          className="border-border size-20 rounded-lg border object-cover"
        />
      ))}

      {canAddMore && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label="Add photo"
          className="border-border text-muted-foreground hover:bg-warm-100 flex size-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ImagePlus className="size-5" />
          )}
          <span className="text-[10px]">
            {uploading ? "Uploading…" : "Add photo"}
          </span>
        </button>
      )}

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

export { PhotoUploader };
