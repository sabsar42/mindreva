import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { restoreMyEntry } from "@/lib/services/entries.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { entryId } = await params;
  const entry = await restoreMyEntry(entryId);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ entry });
}
