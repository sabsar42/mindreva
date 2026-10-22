import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../client";
import { embeddingJobs, entries } from "../schema";

export interface ClaimedEmbeddingJob {
  id: string;
  userId: string;
  entryId: string;
  attempts: number;
  /** Opaque lease token: the row's updated_at at claim time. A transition
   * only applies if nobody re-armed the job meanwhile. */
  lease: string;
}

type Row = Record<string, unknown>;
const rowsOf = (r: unknown): Row[] =>
  (Array.isArray(r) ? r : ((r as { rows?: Row[] }).rows ?? [])) as Row[];

/**
 * The embedding retry queue: one row per entry. Jobs are never deleted on
 * failure — they are parked as 'failed' with last_error, for visibility.
 */
export const EmbeddingJobsRepository = {
  /**
   * Arms the entry's job (insert, or reset to pending with attempts = 0).
   * If a worker currently holds it, the job goes back to pending but stays
   * due only when that lease ends, so the newer text gets indexed by the
   * next pass rather than raced by a second concurrent one.
   */
  async enqueue(userId: string, entryId: string): Promise<void> {
    const owned = await getDb()
      .select({ id: entries.id })
      .from(entries)
      .where(and(eq(entries.id, entryId), eq(entries.userId, userId)))
      .limit(1);
    if (!owned[0]) throw new Error("Entry not found for user");

    await getDb().execute(sql`
      INSERT INTO ${embeddingJobs} (user_id, entry_id, status, attempts, next_attempt_at)
      VALUES (${userId}, ${entryId}, 'pending', 0, now())
      ON CONFLICT (entry_id) DO UPDATE SET
        status = 'pending',
        attempts = 0,
        last_error = NULL,
        next_attempt_at = CASE
          WHEN ${embeddingJobs}.status = 'processing'
           AND ${embeddingJobs}.next_attempt_at > now()
          THEN ${embeddingJobs}.next_attempt_at
          ELSE now() END,
        updated_at = clock_timestamp()`);
  },

  /**
   * Claims the oldest due job (optionally for one user, optionally one
   * entry), leasing it until `leaseUntil`. A 'processing' job whose lease
   * ran out (the worker died) is claimable again. SKIP LOCKED: concurrent
   * workers never get the same job.
   */
  async claimDue(input: {
    leaseUntil: Date;
    userId?: string;
    entryId?: string;
  }): Promise<ClaimedEmbeddingJob | null> {
    const userFilter = input.userId
      ? sql`AND user_id = ${input.userId}`
      : sql``;
    const entryFilter = input.entryId
      ? sql`AND entry_id = ${input.entryId}`
      : sql``;
    const result = await getDb().execute(sql`
      UPDATE ${embeddingJobs}
      SET status = 'processing',
          next_attempt_at = ${input.leaseUntil.toISOString()}::timestamptz,
          updated_at = clock_timestamp()
      WHERE id = (
        SELECT id FROM ${embeddingJobs}
        WHERE status IN ('pending', 'processing')
          AND next_attempt_at <= now()
          ${userFilter}
          ${entryFilter}
        ORDER BY next_attempt_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, user_id, entry_id, attempts, updated_at::text AS lease`);
    const row = rowsOf(result)[0];
    if (!row) return null;
    return {
      id: String(row.id),
      userId: String(row.user_id),
      entryId: String(row.entry_id),
      attempts: Number(row.attempts),
      lease: String(row.lease),
    };
  },

  async markDone(job: ClaimedEmbeddingJob): Promise<void> {
    await getDb().execute(sql`
      UPDATE ${embeddingJobs}
      SET status = 'done', last_error = NULL, updated_at = clock_timestamp()
      WHERE id = ${job.id} AND updated_at = ${job.lease}::timestamptz`);
  },

  /**
   * Puts the job back to pending until `nextAttemptAt`. `countAttempt`:
   * false for waits that aren't the job's fault (a daily limit, a provider
   * rate limit). Reaching `maxAttempts` parks it as 'failed'.
   */
  async markRetry(
    job: ClaimedEmbeddingJob,
    input: {
      nextAttemptAt: Date;
      error: string | null;
      countAttempt: boolean;
      maxAttempts: number;
    },
  ): Promise<"pending" | "failed"> {
    const attempts = job.attempts + (input.countAttempt ? 1 : 0);
    const status = attempts >= input.maxAttempts ? "failed" : "pending";
    await getDb().execute(sql`
      UPDATE ${embeddingJobs}
      SET status = ${status},
          attempts = ${attempts},
          next_attempt_at = ${input.nextAttemptAt.toISOString()}::timestamptz,
          last_error = ${input.error ? input.error.slice(0, 1000) : null},
          updated_at = clock_timestamp()
      WHERE id = ${job.id} AND updated_at = ${job.lease}::timestamptz`);
    return status;
  },
};
