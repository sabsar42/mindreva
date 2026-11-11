import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../client";
import {
  entries,
  entryEvents,
  type EntryEvent,
  type EntryEventStatus,
} from "../schema";

export interface EventSuggestion {
  title: string;
  /** "YYYY-MM-DD" */
  startDate: string;
  /** "HH:MM", or null for all-day. */
  startTime: string | null;
}

/** Same event for dedupe purposes: same day, same time, same words. */
function keyOf(e: {
  title: string;
  startDate: string;
  startTime: string | null;
}): string {
  return `${e.startDate}|${e.startTime ?? ""}|${e.title.trim().toLowerCase()}`;
}

/**
 * Calendar-event suggestions found in an entry's summary, scoped to entries the
 * user owns. Regenerating a summary refreshes the still-open suggestions but
 * never resurrects one the user already added or dismissed.
 */
export const EntryEventsRepository = {
  async listByEntry(entryId: string, userId: string): Promise<EntryEvent[]> {
    const rows = await getDb()
      .select({ e: entryEvents })
      .from(entryEvents)
      .innerJoin(entries, eq(entries.id, entryEvents.entryId))
      .where(and(eq(entryEvents.entryId, entryId), eq(entries.userId, userId)))
      .orderBy(asc(entryEvents.startDate), asc(entryEvents.startTime));
    return rows.map((r) => r.e);
  },

  /** One event, only if its entry belongs to the user. */
  async getOwned(id: string, userId: string): Promise<EntryEvent | null> {
    const rows = await getDb()
      .select({ e: entryEvents })
      .from(entryEvents)
      .innerJoin(entries, eq(entries.id, entryEvents.entryId))
      .where(and(eq(entryEvents.id, id), eq(entries.userId, userId)))
      .limit(1);
    return rows[0]?.e ?? null;
  },

  /**
   * Replaces the entry's open ("suggested") events with a fresh list in one
   * transaction. Events already added or dismissed stay, and a fresh event that
   * matches one of them is dropped, so a regenerate never re-offers it.
   */
  async replaceSuggestions(
    entryId: string,
    userId: string,
    suggestions: EventSuggestion[],
  ): Promise<void> {
    const owned = await getDb()
      .select({ id: entries.id })
      .from(entries)
      .where(and(eq(entries.id, entryId), eq(entries.userId, userId)))
      .limit(1);
    if (!owned[0]) throw new Error("Entry not found for user");

    await getDb().transaction(async (tx) => {
      await tx
        .delete(entryEvents)
        .where(
          and(
            eq(entryEvents.entryId, entryId),
            eq(entryEvents.status, "suggested"),
          ),
        );
      const kept = await tx
        .select()
        .from(entryEvents)
        .where(eq(entryEvents.entryId, entryId));
      const seen = new Set(kept.map(keyOf));
      const fresh: EventSuggestion[] = [];
      for (const s of suggestions) {
        const k = keyOf(s);
        if (seen.has(k)) continue;
        seen.add(k);
        fresh.push(s);
      }
      if (fresh.length > 0) {
        await tx
          .insert(entryEvents)
          .values(fresh.map((s) => ({ entryId, ...s })));
      }
    });
  },

  async setStatus(
    id: string,
    userId: string,
    status: EntryEventStatus,
    googleEventId?: string | null,
  ): Promise<EntryEvent | null> {
    const owned = await this.getOwned(id, userId);
    if (!owned) return null;
    const rows = await getDb()
      .update(entryEvents)
      .set({
        status,
        ...(googleEventId !== undefined ? { googleEventId } : {}),
      })
      .where(eq(entryEvents.id, id))
      .returning();
    return rows[0] ?? null;
  },

  /** For tests and callers that need several by id at once. */
  async getManyOwned(ids: string[], userId: string): Promise<EntryEvent[]> {
    if (ids.length === 0) return [];
    const rows = await getDb()
      .select({ e: entryEvents })
      .from(entryEvents)
      .innerJoin(entries, eq(entries.id, entryEvents.entryId))
      .where(and(inArray(entryEvents.id, ids), eq(entries.userId, userId)));
    return rows.map((r) => r.e);
  },
};
