/**
 * Shrinks a photo in the browser before it's uploaded.
 *
 * Phone photos and screenshots arrive at full resolution (a 2.4MB PNG was
 * measured as an entry cover) and were stored and served as-is, so every view
 * downloaded megabytes from Storage to show a card-sized image. Supabase's
 * image transformations aren't on the free plan, so resizing happens here:
 * longest edge capped at MAX_EDGE, re-encoded as WebP (JPEG where the browser
 * can't encode WebP, e.g. Safari).
 *
 * Never blocks an upload: anything it can't decode (HEIC outside Safari),
 * animated or vector formats, and results that wouldn't be smaller all fall
 * back to the original file.
 */

// 1600px covers the widest the app ever shows a photo (full-width entry
// cover on desktop) at 2x density for the phone-sized layouts.
const MAX_EDGE = 1600;
const QUALITY = 0.82;
// Already small and within MAX_EDGE: re-encoding would only cost quality.
const SKIP_BELOW_BYTES = 400 * 1024;
const PASSTHROUGH_TYPES = new Set(["image/gif", "image/svg+xml"]);

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// List cards show covers at 80px; 240px on the short edge covers 3x density.
const THUMB_SHORT_EDGE = 240;
const THUMB_QUALITY = 0.75;

/**
 * A small WebP (JPEG on Safari) copy for list thumbnails, so a card doesn't
 * download the 1600px photo to show an 80px square. Null when the browser
 * can't decode the file; the server then falls back to the full photo.
 */
export async function prepareThumbnail(file: File): Promise<File | null> {
  if (!file.type.startsWith("image/") || PASSTHROUGH_TYPES.has(file.type)) {
    return null;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    const scale = Math.min(
      1,
      THUMB_SHORT_EDGE / Math.min(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    let blob = await canvasToBlob(canvas, "image/webp", THUMB_QUALITY);
    if (!blob || blob.type !== "image/webp") {
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      blob = await canvasToBlob(canvas, "image/jpeg", THUMB_QUALITY);
    }
    if (!blob) return null;
    return new File([blob], "thumbnail", { type: blob.type });
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}

/** Sets the resized photo and its list thumbnail on an upload form. */
export async function appendPhotoToForm(
  form: FormData,
  file: File,
): Promise<void> {
  const [image, thumbnail] = await Promise.all([
    prepareImageForUpload(file),
    prepareThumbnail(file),
  ]);
  form.set("image", image);
  if (thumbnail) form.set("thumbnail", thumbnail);
}

export async function prepareImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || PASSTHROUGH_TYPES.has(file.type)) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= SKIP_BELOW_BYTES) return file;

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, "image/webp", QUALITY);
    if (!blob || blob.type !== "image/webp") {
      // JPEG has no alpha: paint transparent areas white rather than black.
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      blob = await canvasToBlob(canvas, "image/jpeg", QUALITY);
    }
    if (!blob || blob.size >= file.size) return file;

    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.${extension}`, { type: blob.type });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
