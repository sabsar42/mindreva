import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { trashMyEntry } from "@/lib/services/entries.service";

/** Soft delete only (sets deleted_at). Never a hard DELETE. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { entryId } = await params;
  const entry = await trashMyEntry(entryId);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ entry });
}
