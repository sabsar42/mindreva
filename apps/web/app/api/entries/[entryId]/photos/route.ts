import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { addPhotoToEntry } from "@/lib/services/entries.service";

// Generous client-side cap for a single photo; the "recordings" route uses the
// same pattern to guard against a modified client pushing an oversized upload.
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

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

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const photo = await addPhotoToEntry(entryId, {
      image: buffer,
      mimeType: file.type || "image/jpeg",
    });
    return NextResponse.json({ photo }, { status: 201 });
  } catch (err) {
    console.error(`POST /api/entries/${entryId}/photos failed:`, err);
    return NextResponse.json(
      { error: "Failed to upload photo" },
      { status: 500 },
    );
  }
}
