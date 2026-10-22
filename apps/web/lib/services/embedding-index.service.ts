import "server-only";
import { getLLMProvider } from "@mindreva/llm";
import {
  ChunksRepository,
  EmbeddingJobsRepository,
  EntriesRepository,
  ProfilesRepository,
  TranscriptsRepository,
  type ClaimedEmbeddingJob,
} from "@mindreva/database";
import { stripFormatting } from "@mindreva/types";
import { contentHash, prepareChunks } from "../retrieval/chunker";
import { isLimitError } from "../limit-error";
import {
  EMBEDDING_BACKOFF_BASE_MS,
  EMBEDDING_BACKOFF_MAX_MS,
  EMBEDDING_LEASE_MS,
  EMBEDDING_MAX_ATTEMPTS,
  EMBEDDING_RATE_LIMIT_WAIT_MS,
  EMBEDDING_WAIT_FOR_TRANSCRIPT_MS,
} from "../usage-limits";
import { nextDailyReset, refundDaily, tryUseDaily } from "./usage.service";
import { recomputeMindmapForUser } from "./mindmap.service";

/**
 * Keeps an entry's retrieval chunks (entry_chunks) in step with its text.
 *
 * Every save arms the entry's embedding job; the job runs right away in the
 * background, and again later if it couldn't finish. Nothing here can block
 * or undo a save: until an entry's chunks exist it simply isn't searchable.
 */

export type IndexOutcome =
  | { status: "indexed"; chunks: number }
  /** Same text as last time: zero API calls. */
  | { status: "unchanged" }
  /** No text any more: chunks removed. */
  | { status: "cleared" }
  /** Still being transcribed; check back later. */
  | { status: "waiting" }
  /** Trashed or gone: nothing to do (trashed chunks are kept but never
   * searched, so a restore needs no re-embedding). */
  | { status: "skipped" }
  | { status: "daily-limit"; retryAt: Date };

/** Brings one entry's chunks up to date. Throws only for an embedding or
 * database failure, which the job runner turns into a retry. */
export async function indexEntry(
  entryId: string,
  userId: string,
): Promise<IndexOutcome> {
  const entry = await EntriesRepository.getByIdForUser(entryId, userId);
  if (!entry) return { status: "skipped" };

  const transcript = await TranscriptsRepository.getByEntry(entryId, userId);
  const raw = (transcript?.editedText ?? transcript?.rawText)?.trim() ?? "";
  const plain = raw ? stripFormatting(raw).trim() : "";
  if (!plain) {
    if (
      transcript?.status === "pending" ||
      transcript?.status === "processing"
    ) {
      return { status: "waiting" };
    }
    await ChunksRepository.deleteForEntry(entryId, userId);
    return { status: "cleared" };
  }

  const hash = contentHash(plain, entry.entryDate);
  if ((await ChunksRepository.getHashForEntry(entryId, userId)) === hash) {
    return { status: "unchanged" };
  }

  const chunks = prepareChunks(plain, entry.entryDate);
  const profile = await ProfilesRepository.getById(userId);
  if (!(await tryUseDaily(userId, profile?.timezone, "embeddings"))) {
    return {
      status: "daily-limit",
      retryAt: nextDailyReset(profile?.timezone),
    };
  }

  let vectors: number[][];
  try {
    // One HTTP call for all of this entry's chunks = one unit of the limit.
    vectors = await getLLMProvider().embedMany(chunks.map((c) => c.content));
  } catch (err) {
    await refundDaily(userId, "embeddings");
    throw err;
  }

  await ChunksRepository.replaceForEntry({
    userId,
    entryId,
    entryDate: entry.entryDate,
    contentHash: hash,
    plainText: plain,
    chunks: chunks.map((c, i) => ({ ...c, embedding: vectors[i]! })),
  });

  // The mindmap clusters on the per-entry vector refreshed above. Failure is
  // non-fatal: a stale map still renders and the next index pass retries.
  try {
    await recomputeMindmapForUser(userId);
  } catch (err) {
    console.error(`Mindmap recompute failed for user ${userId}:`, err);
  }
  return { status: "indexed", chunks: chunks.length };
}

function backoffMs(attempt: number): number {
  return Math.min(
    EMBEDDING_BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1),
    EMBEDDING_BACKOFF_MAX_MS,
  );
}

/** Runs one claimed job and records what happened. Never throws. */
export async function runEmbeddingJob(
  job: ClaimedEmbeddingJob,
): Promise<IndexOutcome | { status: "error"; error: string }> {
  try {
    const outcome = await indexEntry(job.entryId, job.userId);
    if (outcome.status === "daily-limit") {
      await EmbeddingJobsRepository.markRetry(job, {
        nextAttemptAt: outcome.retryAt,
        error: "daily embedding limit reached",
        countAttempt: false,
        maxAttempts: EMBEDDING_MAX_ATTEMPTS,
      });
    } else if (outcome.status === "waiting") {
      await EmbeddingJobsRepository.markRetry(job, {
        nextAttemptAt: new Date(Date.now() + EMBEDDING_WAIT_FOR_TRANSCRIPT_MS),
        error: null,
        countAttempt: false,
        maxAttempts: EMBEDDING_MAX_ATTEMPTS,
      });
    } else {
      await EmbeddingJobsRepository.markDone(job);
    }
    return outcome;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const limited = isLimitError(err);
    try {
      const status = await EmbeddingJobsRepository.markRetry(job, {
        nextAttemptAt: new Date(
          Date.now() +
            (limited
              ? EMBEDDING_RATE_LIMIT_WAIT_MS
              : backoffMs(job.attempts + 1)),
        ),
        error: message,
        countAttempt: !limited,
        maxAttempts: EMBEDDING_MAX_ATTEMPTS,
      });
      console.error(
        `Embedding job for entry ${job.entryId} failed (${status}):`,
        message.slice(0, 300),
      );
    } catch (markErr) {
      // The lease simply expires and the job is picked up again.
      console.error("Couldn't record embedding job failure:", markErr);
    }
    return { status: "error", error: message };
  }
}

/**
 * Arms the entry's job; cheap, DB only. Call on every text save. Never
 * throws: the save it rides on has already succeeded and must not report a
 * failure because of this. A job that couldn't be armed is still caught
 * later, because the backfill (scripts/backfill-embeddings.mjs) arms every
 * entry that has text but no chunks.
 */
export async function enqueueEntryIndex(
  entryId: string,
  userId: string,
): Promise<void> {
  try {
    await EmbeddingJobsRepository.enqueue(userId, entryId);
  } catch (err) {
    console.error(`Couldn't arm the embedding job for entry ${entryId}:`, err);
  }
}

/** Runs this entry's job now if it's due (e.g. right after a save, inside
 * after()). Returns null when another worker holds it or it isn't due. */
export async function indexEntryNow(
  entryId: string,
  userId: string,
): Promise<Awaited<ReturnType<typeof runEmbeddingJob>> | null> {
  const job = await EmbeddingJobsRepository.claimDue({
    userId,
    entryId,
    leaseUntil: new Date(Date.now() + EMBEDDING_LEASE_MS),
  });
  return job ? runEmbeddingJob(job) : null;
}

/**
 * Works through due jobs, oldest first: for one user (page-load catch-up)
 * or everyone (the scheduled route). Stops at `max` jobs or `budgetMs`.
 */
export async function drainEmbeddingJobs(input: {
  userId?: string;
  max: number;
  budgetMs: number;
}): Promise<{ processed: number; outcomes: Record<string, number> }> {
  const started = Date.now();
  const outcomes: Record<string, number> = {};
  let processed = 0;
  while (processed < input.max && Date.now() - started < input.budgetMs) {
    const job = await EmbeddingJobsRepository.claimDue({
      userId: input.userId,
      leaseUntil: new Date(Date.now() + EMBEDDING_LEASE_MS),
    });
    if (!job) break;
    const outcome = await runEmbeddingJob(job);
    outcomes[outcome.status] = (outcomes[outcome.status] ?? 0) + 1;
    processed += 1;
  }
  return { processed, outcomes };
}
