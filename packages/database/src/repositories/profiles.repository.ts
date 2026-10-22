import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../client";
import { appLogins, entries, profiles, type Profile } from "../schema";

/**
 * Profiles are created automatically by a DB trigger on auth.users insert
 * (see the migration), so there is no `create` here — only reads and updates,
 * always scoped to the caller's own id.
 */
export const ProfilesRepository = {
  async getById(userId: string): Promise<Profile | null> {
    const rows = await getDb()
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    return rows[0] ?? null;
  },

  async update(
    userId: string,
    patch: Partial<
      Pick<Profile, "displayName" | "languages" | "summaryStyle" | "timezone">
    >,
  ): Promise<Profile | null> {
    const rows = await getDb()
      .update(profiles)
      .set(patch)
      .where(eq(profiles.id, userId))
      .returning();
    return rows[0] ?? null;
  },

  /**
   * Saves the user's IANA zone. On the FIRST sync it also re-cuts the days
   * already stored under the UTC default into that zone, in one transaction:
   * - entries whose entry_date is still the UTC date of created_at (i.e. not
   *   moved by the user) get the local date of created_at;
   * - app_logins rows are rebuilt from created_at, merging any two UTC days
   *   that fall on the same local day.
   * Later calls only change the zone, so travelling never rewrites history.
   */
  async syncTimezone(userId: string, timezone: string): Promise<void> {
    await getDb().transaction(async (tx) => {
      const [profile] = await tx
        .select({ syncedAt: profiles.timezoneSyncedAt })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);
      if (!profile) return;
      const firstSync = profile.syncedAt === null;

      await tx
        .update(profiles)
        .set({ timezone, ...(firstSync && { timezoneSyncedAt: new Date() }) })
        .where(eq(profiles.id, userId));

      if (!firstSync || timezone === "UTC") return;

      await tx
        .update(entries)
        .set({
          entryDate: sql`(${entries.createdAt} at time zone ${timezone})::date`,
        })
        .where(
          and(
            eq(entries.userId, userId),
            sql`${entries.entryDate} = (${entries.createdAt} at time zone 'UTC')::date`,
          ),
        );

      await tx.execute(sql`
        insert into ${appLogins} (user_id, day, created_at)
        select user_id, (created_at at time zone ${timezone})::date, min(created_at)
        from ${appLogins}
        where user_id = ${userId}
        group by 1, 2
        on conflict (user_id, day) do nothing`);
      await tx.execute(sql`
        delete from ${appLogins}
        where user_id = ${userId}
          and day <> (created_at at time zone ${timezone})::date`);
    });
  },

  /**
   * Counts one AI use against today's per-user limit, atomically: returns
   * false (and changes nothing) when the user is already at `limit`. When
   * the stored reset time has passed, both counters start again from zero
   * and the next reset becomes `nextResetAt` (the user's next midnight).
   * One UPDATE, so two requests racing for the last unit can't both win.
   */
  async consumeDailyUsage(
    userId: string,
    kind: DailyUsageKind,
    limit: number,
    nextResetAt: Date,
  ): Promise<boolean> {
    const [used, other] =
      kind === "summaries"
        ? [profiles.summariesUsedToday, profiles.chatMessagesUsedToday]
        : [profiles.chatMessagesUsedToday, profiles.summariesUsedToday];
    const usedKey =
      kind === "summaries" ? "summariesUsedToday" : "chatMessagesUsedToday";
    const otherKey =
      kind === "summaries" ? "chatMessagesUsedToday" : "summariesUsedToday";
    const expired = sql`(${profiles.usageResetsAt} is null or ${profiles.usageResetsAt} <= now())`;
    const rows = await getDb()
      .update(profiles)
      .set({
        [usedKey]: sql`case when ${expired} then 1 else ${used} + 1 end`,
        [otherKey]: sql`case when ${expired} then 0 else ${other} end`,
        usageResetsAt: sql`case when ${expired} then ${nextResetAt.toISOString()}::timestamptz else ${profiles.usageResetsAt} end`,
      })
      .where(
        and(eq(profiles.id, userId), sql`(${expired} or ${used} < ${limit})`),
      )
      .returning({ id: profiles.id });
    return rows.length > 0;
  },

  /** Gives back a unit when the AI call it was reserved for never produced
   * anything. No-op once the counters have reset. */
  async releaseDailyUsage(userId: string, kind: DailyUsageKind): Promise<void> {
    const used =
      kind === "summaries"
        ? profiles.summariesUsedToday
        : profiles.chatMessagesUsedToday;
    const usedKey =
      kind === "summaries" ? "summariesUsedToday" : "chatMessagesUsedToday";
    await getDb()
      .update(profiles)
      .set({ [usedKey]: sql`greatest(${used} - 1, 0)` })
      .where(
        and(eq(profiles.id, userId), sql`${profiles.usageResetsAt} > now()`),
      );
  },
};

export type DailyUsageKind = "summaries" | "chatMessages";
