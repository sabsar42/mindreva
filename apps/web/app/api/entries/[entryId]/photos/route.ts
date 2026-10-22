import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { addPhotoToEntry } from "@/lib/services/entries.service";
import { timed } from "@/lib/timing";

// Generous client-side cap for a single photo; the "recordings" route uses the
// same pattern to guard against a modified client pushing an oversized upload.
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 512 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { entryId } = await params;

  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing image file" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large" }, { status: 400 });
  }

  if (file.type && !file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Not an image" }, { status: 400 });
  }

  // 'inline' = a picture inserted into the journal body; anything else is the
  // cover set (the default, which is what attaching a photo has always meant).
  // `makeCover` is "Change cover image": the new photo becomes the cover.
  const kind = form.get("kind") === "inline" ? "inline" : "cover";
  const makeCover = form.get("makeCover") === "true";

  // Optional small copy for list thumbnails; ignored if missing or suspicious.
  const thumb = form.get("thumbnail");
  const thumbnail =
    thumb instanceof File &&
    thumb.size > 0 &&
    thumb.size <= MAX_THUMBNAIL_BYTES &&
    (thumb.type === "image/webp" || thumb.type === "image/jpeg")
      ? { image: Buffer.from(await thumb.arrayBuffer()), mimeType: thumb.type }
      : undefined;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const photo = await timed(
      "photo-upload",
      "total",
      addPhotoToEntry(entryId, {
        image: buffer,
        mimeType: file.type || "image/jpeg",
        kind,
        makeCover,
        thumbnail: kind === "cover" ? thumbnail : undefined,
      }),
    );
    return NextResponse.json({ photo }, { status: 201 });
  } catch (err) {
    console.error(`POST /api/entries/${entryId}/photos failed:`, err);
    return NextResponse.json(
      { error: "Failed to upload photo" },
      { status: 500 },
    );
  }
}
