/**
 * Per-user daily caps on the AI calls that draw from SHARED free-tier quotas.
 * Every user's summaries and chat replies come out of the same provider
 * allowance (see docs/DECISIONS.md 2026-10-22 "Free-tier AI quotas"), so
 * without these one heavy user could use up the day for everyone. Counters
 * reset at the user's own midnight. These are fairness limits, not tiers:
 * nobody can pay to raise them, and the wording below never suggests it.
 */
export const DAILY_SUMMARY_LIMIT = 15;
export const DAILY_CHAT_MESSAGE_LIMIT = 20;

/** How long after a failed AI call a pending summary is tried again. */
export const SUMMARY_RETRY_DELAY_MS = 30 * 60 * 1000;
/** A provider said "limit reached": give it longer before trying again. */
export const SUMMARY_PROVIDER_LIMIT_DELAY_MS = 60 * 60 * 1000;
/** A new entry whose summary hasn't landed after this long gets retried in
 * the background (e.g. the app was closed before it finished). */
export const SUMMARY_GRACE_MS = 10 * 60 * 1000;
/** How long a background retry holds its claim on an entry. */
export const SUMMARY_RETRY_LEASE_MS = 15 * 60 * 1000;

/** Shown when a user has used today's summaries. Calm, says what's safe. */
export const DAILY_SUMMARY_LIMIT_MESSAGE =
  "You've written a lot today. Your entry is saved, and its summary will be written tomorrow.";

/** Shown in place of a reply when today's chat messages are used up. */
export const DAILY_CHAT_LIMIT_MESSAGE =
  "That's all for today's conversation. Come back tomorrow and we can pick up where we left off.";

/** Shown when the AI couldn't write a summary right now (not the user's
 * limit — the services behind it). The entry is safe either way. */
export const SUMMARY_PENDING_MESSAGE =
  "Your entry is saved. The summary will be written a little later.";
