import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import {
  getMyShare,
  revokeMyShare,
  setMyShare,
} from "@/lib/services/shares.service";

// Every handler authenticates and then goes through a service that is scoped to
// entries the caller owns, so only the owner can read or change sharing.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { entryId } = await params;
  return NextResponse.json(await getMyShare(entryId));
}

/** Turn sharing on or change it. Body: { visibility: "public" | "private" }. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { entryId } = await params;
  const body = await request.json().catch(() => null);
  const visibility = body?.visibility;
  if (visibility !== "public" && visibility !== "private") {
    return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
  }
  try {
    return NextResponse.json(await setMyShare(entryId, visibility));
  } catch {
    // The repository throws when the entry isn't the caller's.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

/** Disable the link. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { entryId } = await params;
  try {
    return NextResponse.json(await revokeMyShare(entryId));
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
