import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import {
  DATE_KEY,
  getMyCalendarEvents,
  isCalendarConfigured,
} from "@/lib/services/calendar.service";

/**
 * GET /api/calendar/events?start=YYYY-MM-DD&end=YYYY-MM-DD — the signed-in
 * user's events for those local days. `{ status, events }`; status is
 * "disconnected" when the integration is off or not connected, so callers can
 * simply render nothing. Cached privately for a minute.
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!isCalendarConfigured()) {
    return NextResponse.json({ status: "disconnected", events: [] });
  }
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start") ?? "";
  const end = searchParams.get("end") ?? start;
  if (!DATE_KEY.test(start) || !DATE_KEY.test(end)) {
    return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
  }
  const result = await getMyCalendarEvents(start, end);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
