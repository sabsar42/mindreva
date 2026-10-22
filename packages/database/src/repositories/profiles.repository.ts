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
      // Keep retrieval chunks on the same (re-cut) day as their entry, so the
      // chat's date-range filter stays right. Their "Date:" text line catches
      // up on the next index pass (the content hash includes the date).
      await tx.execute(sql`
        update entry_chunks c set entry_date = e.entry_date
        from entries e
        where c.entry_id = e.id
          and c.user_id = ${userId}
          and c.entry_date is distinct from e.entry_date`);
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
    const used = profiles[USAGE_COLUMN[kind]];
    const expired = sql`(${profiles.usageResetsAt} is null or ${profiles.usageResetsAt} <= now())`;
    const set: Record<string, unknown> = {
      usageResetsAt: sql`case when ${expired} then ${nextResetAt.toISOString()}::timestamptz else ${profiles.usageResetsAt} end`,
    };
    for (const k of DAILY_USAGE_KINDS) {
      const col = profiles[USAGE_COLUMN[k]];
      set[USAGE_COLUMN[k]] =
        k === kind
          ? sql`case when ${expired} then 1 else ${col} + 1 end`
          : sql`case when ${expired} then 0 else ${col} end`;
    }
    const rows = await getDb()
      .update(profiles)
      .set(set)
      .where(
        and(eq(profiles.id, userId), sql`(${expired} or ${used} < ${limit})`),
      )
      .returning({ id: profiles.id });
    return rows.length > 0;
  },

  /** Gives back a unit when the AI call it was reserved for never produced
   * anything. No-op once the counters have reset. */
  async releaseDailyUsage(userId: string, kind: DailyUsageKind): Promise<void> {
    const key = USAGE_COLUMN[kind];
    await getDb()
      .update(profiles)
      .set({ [key]: sql`greatest(${profiles[key]} - 1, 0)` })
      .where(
        and(eq(profiles.id, userId), sql`${profiles.usageResetsAt} > now()`),
      );
  },
};

export const DAILY_USAGE_KINDS = [
  "summaries",
  "chatMessages",
  "embeddings",
] as const;
export type DailyUsageKind = (typeof DAILY_USAGE_KINDS)[number];

/** Which profiles counter each kind uses. All reset together. */
const USAGE_COLUMN = {
  summaries: "summariesUsedToday",
  chatMessages: "chatMessagesUsedToday",
  embeddings: "embeddingCallsToday",
} as const satisfies Record<DailyUsageKind, keyof typeof profiles.$inferSelect>;
