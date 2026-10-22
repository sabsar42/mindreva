import "server-only";
import { ProfilesRepository, type DailyUsageKind } from "@mindreva/database";
import { nextMidnightInZone } from "../day-key";
import {
  DAILY_CHAT_MESSAGE_LIMIT,
  DAILY_EMBEDDING_CALL_LIMIT,
  DAILY_SUMMARY_LIMIT,
} from "../usage-limits";

const LIMITS: Record<DailyUsageKind, number> = {
  summaries: DAILY_SUMMARY_LIMIT,
  chatMessages: DAILY_CHAT_MESSAGE_LIMIT,
  embeddings: DAILY_EMBEDDING_CALL_LIMIT,
};

/**
 * Reserves one of today's AI uses for this user. False means today's limit
 * is reached (nothing was counted). Takes the user id and zone explicitly
 * because background jobs (after(), retries) call it without a session.
 */
export function tryUseDaily(
  userId: string,
  timezone: string | null | undefined,
  kind: DailyUsageKind,
): Promise<boolean> {
  return ProfilesRepository.consumeDailyUsage(
    userId,
    kind,
    LIMITS[kind],
    nextMidnightInZone(timezone),
  );
}

/** Returns a reserved use when the AI call produced nothing. Never throws:
 * a failed refund only costs the user one unit until midnight. */
export async function refundDaily(
  userId: string,
  kind: DailyUsageKind,
): Promise<void> {
  try {
    await ProfilesRepository.releaseDailyUsage(userId, kind);
  } catch (err) {
    console.error(`Usage refund failed for user ${userId}:`, err);
  }
}

/** When this user's daily counters next reset. */
export function nextDailyReset(timezone: string | null | undefined): Date {
  return nextMidnightInZone(timezone);
}

/** Thrown when a user's daily limit stops an interactive request. The
 * message is meant for the user, verbatim: calm, never an upgrade prompt. */
export class DailyLimitReachedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DailyLimitReachedError";
  }
}
