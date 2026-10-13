import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import {
  InvalidRecipientError,
  addMyShareRecipient,
  removeMyShareRecipient,
} from "@/lib/services/shares.service";

/** Allow someone to open a private link. Body: { email: string }. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { entryId } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.email !== "string") {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  try {
    return NextResponse.json(await addMyShareRecipient(entryId, body.email), {
      status: 201,
    });
  } catch (err) {
    if (err instanceof InvalidRecipientError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

/** Remove someone from a private link. Body: { email: string }. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { entryId } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.email !== "string") {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  try {
    return NextResponse.json(await removeMyShareRecipient(entryId, body.email));
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
