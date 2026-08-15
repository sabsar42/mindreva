import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { getMyEntryThumbnails } from "@/lib/services/entries.service";

/** Cover-photo thumbnail URLs for a list screen's rows. Split out from the
 * initial server render (see entries.service.ts's listMyEntries comment) —
 * the list itself paints first, then this fills in thumbnails once the
 * client requests them, keeping the two Storage round trips this needs off
 * the critical path. */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const entryIds = body?.entryIds;
  if (
    !Array.isArray(entryIds) ||
    !entryIds.every((id) => typeof id === "string")
  ) {
    return NextResponse.json({ error: "Invalid entryIds" }, { status: 400 });
  }

  try {
    const thumbnails = await getMyEntryThumbnails(entryIds);
    return NextResponse.json({ thumbnails });
  } catch (err) {
    console.error("POST /api/entries/thumbnails failed:", err);
    return NextResponse.json(
      { error: "Failed to load thumbnails" },
      { status: 500 },
    );
  }
}
