import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { summarizeMyEntry } from "@/lib/services/entries.service";
import {
  DAILY_SUMMARY_LIMIT_MESSAGE,
  SUMMARY_PENDING_MESSAGE,
} from "@/lib/usage-limits";

/** Manual "regenerate summary" trigger — also what the forming memory card
 * calls once a voice entry is transcribed. A summary that can't be written
 * right now is not an error: the entry is saved and marked for retry, and
 * the response says so in `pending` (HTTP 200). */
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
    const { outcome, summary, tasks } = await summarizeMyEntry(entryId);
    return NextResponse.json({
      summary: summary
        ? { summaryText: summary.summaryText, provider: summary.provider }
        : null,
      tasks,
      pending:
        outcome.status === "pending"
          ? {
              reason: outcome.reason,
              message:
                outcome.reason === "daily-limit"
                  ? DAILY_SUMMARY_LIMIT_MESSAGE
                  : SUMMARY_PENDING_MESSAGE,
            }
          : null,
    });
  } catch (err) {
    console.error("POST /api/entries/[entryId]/summarize failed:", err);
    return NextResponse.json(
      { error: "Failed to summarize entry" },
      { status: 500 },
    );
  }
}
