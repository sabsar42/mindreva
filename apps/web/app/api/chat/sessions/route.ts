import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import {
  listMyChatSessions,
  startPersonaChatSession,
} from "@/lib/services/persona-chat.service";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const sessions = await listMyChatSessions();
  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const yearStart = Number(body?.yearStart);
  const yearEnd = Number(body?.yearEnd ?? yearStart);
  const currentYear = new Date().getFullYear();

  if (
    !Number.isInteger(yearStart) ||
    !Number.isInteger(yearEnd) ||
    yearStart < 1900 ||
    yearEnd > currentYear ||
    yearStart > yearEnd
  ) {
    return NextResponse.json({ error: "Invalid year range" }, { status: 400 });
  }

  const session = await startPersonaChatSession({ yearStart, yearEnd });
  return NextResponse.json({ session }, { status: 201 });
}
