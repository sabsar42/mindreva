import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { toggleMyTask } from "@/lib/services/entries.service";

/** entryId isn't needed by the service call (setDone is scoped by taskId +
 * userId), but it's kept in the route shape for consistency with the other
 * entry-scoped routes and so the client can build the URL from what it has. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ entryId: string; taskId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { taskId } = await params;
  const body = await request.json().catch(() => null);
  const isDone = body?.isDone;
  if (typeof isDone !== "boolean") {
    return NextResponse.json({ error: "Invalid isDone" }, { status: 400 });
  }

  const task = await toggleMyTask(taskId, isDone);
  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ task });
}
