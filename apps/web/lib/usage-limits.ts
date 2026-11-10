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

/**
 * Embedding API calls per user per day. Counted once per HTTP call: an
 * entry's chunks are embedded in ONE batched call, so this is roughly
 * "entry saves with changed text per day". A chat question's own embedding
 * is not counted here — it is part of that message's DAILY_CHAT_MESSAGE_LIMIT
 * unit (one message = one query embedding + one completion).
 */
export const DAILY_EMBEDDING_CALL_LIMIT = 40;

/** Embedding retry queue: backoff for real failures (doubling from 5 min,
 * capped at 12 h), parked as 'failed' after this many. Rate limits and
 * daily limits wait without spending an attempt. */
export const EMBEDDING_MAX_ATTEMPTS = 8;
export const EMBEDDING_BACKOFF_BASE_MS = 5 * 60 * 1000;
export const EMBEDDING_BACKOFF_MAX_MS = 12 * 60 * 60 * 1000;
export const EMBEDDING_RATE_LIMIT_WAIT_MS = 60 * 60 * 1000;
/** How long a worker holds a claimed job. */
export const EMBEDDING_LEASE_MS = 5 * 60 * 1000;
/** While an entry is still being transcribed, check back after this. */
export const EMBEDDING_WAIT_FOR_TRANSCRIPT_MS = 5 * 60 * 1000;

/** Voice recordings per user per (local) day: a ceiling on storage and
 * transcription a single account can use, far above real journaling. */
export const DAILY_RECORDING_LIMIT = 50;

export const DAILY_RECORDING_LIMIT_MESSAGE =
  "That's a lot of recording for one day. You can record again tomorrow; nothing you already saved is affected.";

/** Per-entry cap on voice add-ons, and the rolling-24h upload cap that also
 * covers them (createVoiceEntry's per-day count only sees new entries). */
export const MAX_RECORDINGS_PER_ENTRY = 20;
