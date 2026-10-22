import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import {
  listMyCalendars,
  setMyCalendars,
} from "@/lib/services/calendar.service";

/** GET: the connected account's calendars, each with `selected`. */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const calendars = await listMyCalendars();
    if (!calendars) {
      return NextResponse.json({ error: "Not connected" }, { status: 409 });
    }
    return NextResponse.json({ calendars });
  } catch {
    return NextResponse.json(
      { error: "Google Calendar isn't answering right now." },
      { status: 502 },
    );
  }
}

/** PUT { ids: string[] }: which calendars' events to show. */
export async function PUT(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    ids?: unknown;
  } | null;
  if (!Array.isArray(body?.ids)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  await setMyCalendars(
    body.ids.filter((id): id is string => typeof id === "string"),
  );
  return NextResponse.json({ ok: true });
}
