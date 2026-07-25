import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../client";
import { entries, summaries, type Summary } from "../schema";

async function assertEntryOwned(
  entryId: string,
  userId: string,
): Promise<void> {
  const rows = await getDb()
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.id, entryId), eq(entries.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new Error("Entry not found for user");
}

/** Summaries keep `provider` + `prompt_version` for every AI-generated row. */
export const SummariesRepository = {
  async create(input: {
    entryId: string;
    userId: string;
    summaryText: string;
    promptVersion?: string | null;
    provider?: string | null;
  }): Promise<Summary> {
    await assertEntryOwned(input.entryId, input.userId);
    const rows = await getDb()
      .insert(summaries)
      .values({
        entryId: input.entryId,
        summaryText: input.summaryText,
        promptVersion: input.promptVersion ?? null,
        provider: input.provider ?? null,
      })
      .returning();
    return rows[0]!;
  },

  /**
   * "Regenerate" always inserts a new row rather than overwriting — so we can
   * tell which entries used an older prompt_version. This returns the latest.
   */
  async getByEntry(entryId: string, userId: string): Promise<Summary | null> {
    const rows = await getDb()
      .select({ s: summaries })
      .from(summaries)
      .innerJoin(entries, eq(entries.id, summaries.entryId))
      .where(and(eq(summaries.entryId, entryId), eq(entries.userId, userId)))
      .orderBy(desc(summaries.createdAt))
      .limit(1);
    return rows[0]?.s ?? null;
  },
};
