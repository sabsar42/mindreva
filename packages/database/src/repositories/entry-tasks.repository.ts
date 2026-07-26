import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../client";
import { entries, entryTasks, type EntryTask } from "../schema";

/**
 * Task checklist items extracted from an entry's summary, scoped to entries
 * the user owns. Every summarize/regenerate call replaces the full list (see
 * replaceForEntry) rather than merging — task extraction always reflects the
 * currently confirmed text, same as summary_text itself.
 */
export const EntryTasksRepository = {
  async listByEntry(entryId: string, userId: string): Promise<EntryTask[]> {
    const rows = await getDb()
      .select({ t: entryTasks })
      .from(entryTasks)
      .innerJoin(entries, eq(entries.id, entryTasks.entryId))
      .where(and(eq(entryTasks.entryId, entryId), eq(entries.userId, userId)))
      .orderBy(asc(entryTasks.createdAt));
    return rows.map((r) => r.t);
  },

  /** Deletes any tasks from a prior extraction and inserts the fresh list in
   * one transaction. Passing an empty array just clears the entry's tasks —
   * the correct outcome when a regenerate finds no action items this time. */
  async replaceForEntry(
    entryId: string,
    userId: string,
    taskTexts: string[],
  ): Promise<EntryTask[]> {
    const rows = await getDb()
      .select({ id: entries.id })
      .from(entries)
      .where(and(eq(entries.id, entryId), eq(entries.userId, userId)))
      .limit(1);
    if (!rows[0]) throw new Error("Entry not found for user");

    return getDb().transaction(async (tx) => {
      await tx.delete(entryTasks).where(eq(entryTasks.entryId, entryId));
      if (taskTexts.length === 0) return [];
      return tx
        .insert(entryTasks)
        .values(taskTexts.map((text) => ({ entryId, text })))
        .returning();
    });
  },

  async setDone(
    id: string,
    userId: string,
    isDone: boolean,
  ): Promise<EntryTask | null> {
    const owned = await getDb()
      .select({ id: entryTasks.id })
      .from(entryTasks)
      .innerJoin(entries, eq(entries.id, entryTasks.entryId))
      .where(and(eq(entryTasks.id, id), eq(entries.userId, userId)))
      .limit(1);
    if (!owned[0]) return null;

    const rows = await getDb()
      .update(entryTasks)
      .set({ isDone })
      .where(eq(entryTasks.id, id))
      .returning();
    return rows[0] ?? null;
  },
};
