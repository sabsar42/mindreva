import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { updateMyEntryTitle } from "@/lib/services/entries.service";

/** Rename an entry. Body: { title: string }. An empty title clears it. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { entryId } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.title !== "string") {
    return NextResponse.json({ error: "Invalid title" }, { status: 400 });
  }

  const entry = await updateMyEntryTitle(entryId, body.title);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: entry.id, title: entry.title });
}
