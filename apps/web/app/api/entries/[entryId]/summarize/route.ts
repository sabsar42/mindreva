import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { summarizeMyEntry } from "@/lib/services/entries.service";
import { LIMIT_MESSAGE, isLimitError } from "@/lib/limit-error";

/** Manual "regenerate summary" trigger — also used by the transcript review
 * screen's "Skip for now" to confirm the raw transcript as-is. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { entryId } = await params;
  try {
    const { summary, tasks } = await summarizeMyEntry(entryId);
    return NextResponse.json({
      summary: summary
        ? { summaryText: summary.summaryText, provider: summary.provider }
        : null,
      tasks,
    });
  } catch (err) {
    console.error("POST /api/entries/[entryId]/summarize failed:", err);
    if (isLimitError(err)) {
      return NextResponse.json(
        { error: LIMIT_MESSAGE, code: "limit" },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "Failed to summarize entry" },
      { status: 500 },
    );
  }
}
