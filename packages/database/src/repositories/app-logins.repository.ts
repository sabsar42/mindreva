import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../client";
import { appLogins } from "../schema";

/**
 * "Did this user open the app on day X" — the activity heatmap's lighter
 * tier. One row per user per calendar day; a recorded entry that same day is
 * a separate, stronger signal read from `entries` (see heatmap.service.ts).
 */
export const AppLoginsRepository = {
  /**
   * Records today's visit, once per calendar day. Insert-if-missing via the
   * (user_id, day) unique constraint, so a page reloaded ten times the same
   * day still costs one row and nine cheap no-op conflicts.
   */
  async recordVisit(userId: string, day: string): Promise<void> {
    await getDb()
      .insert(appLogins)
      .values({ userId, day })
      .onConflictDoNothing();
  },

  /** Which days in [dateFrom, dateTo] this user visited, for the heatmap. */
  async listDaysForUser(
    userId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<string[]> {
    const rows = await getDb()
      .select({ day: appLogins.day })
      .from(appLogins)
      .where(
        and(
          eq(appLogins.userId, userId),
          gte(appLogins.day, dateFrom),
          lte(appLogins.day, dateTo),
        ),
      );
    return rows.map((r) => r.day);
  },
};
