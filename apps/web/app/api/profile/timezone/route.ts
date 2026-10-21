import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { syncMyTimeZone } from "@/lib/services/heatmap.service";

/** The browser reports its IANA zone so days are cut at the user's midnight. */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    timezone?: unknown;
  } | null;
  if (typeof body?.timezone !== "string" || body.timezone.length > 64) {
    return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
  }
  try {
    await syncMyTimeZone(body.timezone);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/profile/timezone failed:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
