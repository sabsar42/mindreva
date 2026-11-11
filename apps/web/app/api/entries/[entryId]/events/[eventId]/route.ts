import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import {
  addMyEventToCalendar,
  dismissMyEvent,
} from "@/lib/services/calendar.service";

/**
 * One tap on a suggestion: { action: "add" } puts it on the user's Google
 * Calendar, { action: "dismiss" } hides it. Add answers 200 with a `result`
 * ("added", "needs_permission", "failed") so the screen can react in place.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ entryId: string; eventId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { eventId } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action;

  if (action === "dismiss") {
    const ok = await dismissMyEvent(eventId);
    return ok
      ? NextResponse.json({ result: "dismissed" })
      : NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (action === "add") {
    const out = await addMyEventToCalendar(eventId);
    if (out.result === "not_found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ result: out.result });
  }
  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
