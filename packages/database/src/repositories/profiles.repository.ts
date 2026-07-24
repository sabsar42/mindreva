import { eq } from "drizzle-orm";
import { getDb } from "../client";
import { profiles, type Profile } from "../schema";

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
    patch: Partial<Pick<Profile, "displayName" | "languages" | "summaryStyle">>,
  ): Promise<Profile | null> {
    const rows = await getDb()
      .update(profiles)
      .set(patch)
      .where(eq(profiles.id, userId))
      .returning();
    return rows[0] ?? null;
  },
};
