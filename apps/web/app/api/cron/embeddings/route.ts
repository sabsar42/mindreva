import { NextResponse } from "next/server";
import { drainEmbeddingJobs } from "@/lib/services/embedding-index.service";

// Each job is one embedding call plus DB writes; stop well inside the
// function's time limit so a run never gets cut off mid-job.
const MAX_JOBS_PER_RUN = 25;
const BUDGET_MS = 45_000;

export const maxDuration = 60;

/**
 * Scheduled drain of the embedding queue for every user (vercel.json crons).
 * Locked unless CRON_SECRET is set: Vercel sends it as a Bearer token on
 * cron requests, and without it this route refuses everything (fail closed).
 * Per-user daily limits still apply inside each job.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await drainEmbeddingJobs({
    max: MAX_JOBS_PER_RUN,
    budgetMs: BUDGET_MS,
  });
  // Counts only: no entry text or ids in logs.
  console.info("[cron] embeddings drained", JSON.stringify(result));
  return NextResponse.json(result);
}
