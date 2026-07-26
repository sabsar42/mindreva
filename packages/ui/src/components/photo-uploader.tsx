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
 * Photo-forward attachment control, matching new-journal-overview-page.png's
 * hierarchy: the first photo renders as a large hero (or an inviting empty
 * state when there isn't one yet), with any additional photos and the "add
 * photo" tile in a thumbnail strip underneath. Used both on the transcript
 * review screen (attach right after recording) and the entry detail screen
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
  const [hero, ...rest] = photos;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onFilesSelected(files);
    // Reset so picking the same file again later still fires onChange.
    e.target.value = "";
  }

  function openPicker() {
    if (!uploading) inputRef.current?.click();
  }

  return (
    <div className={cn("w-full", className)}>
      {hero ? (
        // Plain <img>, deliberately: these are dynamic, per-request signed
        // URLs for private Storage objects — next/image's remote-domain
        // allowlisting and optimization pipeline don't fit that shape well,
        // and this file isn't linted by apps/web's Next-specific ESLint
        // rules anyway (packages/ui has its own, thinner config).
        <img
          src={hero.url}
          alt=""
          className="border-border aspect-[4/3] w-full rounded-lg border object-cover"
        />
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={uploading}
          aria-label="Add photo"
          className="border-border text-muted-foreground hover:bg-warm-100 flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <ImagePlus className="size-6" />
          )}
          <span className="text-sm">
            {uploading ? "Uploading…" : "Add a photo"}
          </span>
        </button>
      )}

      {(rest.length > 0 || (hero && canAddMore)) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {rest.map((photo) => (
            <img
              key={photo.id}
              src={photo.url}
              alt=""
              className="border-border size-16 rounded-md border object-cover"
            />
          ))}

          {hero && canAddMore && (
            <button
              type="button"
              onClick={openPicker}
              disabled={uploading}
              aria-label="Add another photo"
              className="border-border text-muted-foreground hover:bg-warm-100 flex size-16 flex-col items-center justify-center gap-0.5 rounded-md border border-dashed transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
            </button>
          )}
        </div>
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
