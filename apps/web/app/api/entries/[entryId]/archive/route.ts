import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import {
  archiveMyEntry,
  unarchiveMyEntry,
} from "@/lib/services/entries.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { entryId } = await params;
  const entry = await archiveMyEntry(entryId);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ entry });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { entryId } = await params;
  const entry = await unarchiveMyEntry(entryId);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ entry });
}
