import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { listMyDayThumbnails } from "@/lib/services/entries.service";
import type { EntryType } from "@mindreva/database";

function parseType(value: string | null): EntryType | undefined {
  return value === "journal" || value === "note" ? value : undefined;
}

/** Cover-photo URLs for the calendar's day cells. Split out from the list
 * screen's initial server render — the calendar is inside a closed-by-
 * default BottomSheet, so fetching this lazily (on first open) keeps it off
 * the critical path for the list itself. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = parseType(searchParams.get("type"));

  try {
    const dayThumbnails = await listMyDayThumbnails(type);
    return NextResponse.json({ dayThumbnails });
  } catch (err) {
    console.error("GET /api/entries/day-thumbnails failed:", err);
    return NextResponse.json(
      { error: "Failed to load day thumbnails" },
      { status: 500 },
    );
  }
}
