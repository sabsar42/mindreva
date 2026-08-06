import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { getMySummaryAndTasks } from "@/lib/services/entries.service";

/** Read-only summary + tasks poll, used after a save to pick up a
 * background re-summarize's result without re-triggering it. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { entryId } = await params;
  try {
    const { summary, tasks } = await getMySummaryAndTasks(entryId);
    return NextResponse.json({
      summary: summary
        ? { summaryText: summary.summaryText, provider: summary.provider }
        : null,
      tasks,
    });
  } catch (err) {
    console.error("GET /api/entries/[entryId]/summary failed:", err);
    return NextResponse.json(
      { error: "Failed to load summary" },
      { status: 500 },
    );
  }
}
