import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { listMyEntryEvents } from "@/lib/services/calendar.service";

/** Calendar-event suggestions found in this entry, plus whether the user's
 * calendar can take them. Read-only; no AI call. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { entryId } = await params;
  const data = await listMyEntryEvents(entryId);
  return NextResponse.json({
    configured: data.configured,
    status: data.status,
    canAddEvents: data.canAddEvents,
    events: data.events.map((e) => ({
      id: e.id,
      title: e.title,
      startDate: e.startDate,
      startTime: e.startTime,
      status: e.status,
    })),
  });
}
