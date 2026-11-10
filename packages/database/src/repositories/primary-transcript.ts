import { sql } from "drizzle-orm";

/**
 * An entry can have several recordings and several transcripts (voice added
 * to it later). Anything that wants ONE row per entry must not LEFT JOIN
 * those tables (the entry would repeat once per transcript); it selects these
 * correlated subqueries instead. "Primary" = the oldest, the one the entry
 * started with, which also holds the combined edited text.
 *
 * The outer table is referenced with an explicit, quoted "entries"."id".
 * Interpolating the Drizzle column instead renders a bare "id" whenever the
 * outer query reads a single table, and inside the subquery a bare id means
 * the subquery's OWN id, so it silently never matches. Every query using
 * these must read FROM entries without an alias.
 */
const ENTRY_ID = sql.raw('"entries"."id"');

/** The entry's display text: its primary transcript's edited text, else raw. */
export const primaryTranscriptText = sql<string | null>`(
  SELECT coalesce(t.edited_text, t.raw_text) FROM transcripts t
  WHERE t.entry_id = ${ENTRY_ID}
  ORDER BY t.created_at ASC
  LIMIT 1
)`;

/** Duration of the entry's first recording, in milliseconds. */
export const firstRecordingDurationMs = sql<number | null>`(
  SELECT r.duration_ms FROM recordings r
  WHERE r.entry_id = ${ENTRY_ID}
  ORDER BY r.created_at ASC
  LIMIT 1
)`;
