import { eq, sql } from "drizzle-orm";
import { getDb } from "../client";
import {
  calendarConnections,
  type CalendarConnection,
  type CalendarConnectionStatus,
} from "../schema";

/**
 * One Google Calendar connection per user. Stores only the encrypted
 * refresh token (the service encrypts/decrypts; this layer never sees the
 * plain token). Server-only: the table has no client RLS policies.
 */
export const CalendarConnectionsRepository = {
  async getForUser(userId: string): Promise<CalendarConnection | null> {
    const [row] = await getDb()
      .select()
      .from(calendarConnections)
      .where(eq(calendarConnections.userId, userId))
      .limit(1);
    return row ?? null;
  },

  /** Insert or replace the connection (reconnecting overwrites the old token). */
  async upsert(input: {
    userId: string;
    accountEmail: string | null;
    refreshTokenEnc: string;
    scopes: string;
  }): Promise<void> {
    await getDb()
      .insert(calendarConnections)
      .values({ ...input, status: "connected" })
      .onConflictDoUpdate({
        target: calendarConnections.userId,
        set: {
          accountEmail: input.accountEmail,
          refreshTokenEnc: input.refreshTokenEnc,
          scopes: input.scopes,
          status: "connected",
          updatedAt: sql`now()`,
        },
      });
  },

  async setStatus(
    userId: string,
    status: CalendarConnectionStatus,
  ): Promise<void> {
    await getDb()
      .update(calendarConnections)
      .set({ status, updatedAt: sql`now()` })
      .where(eq(calendarConnections.userId, userId));
  },

  async setSelectedCalendars(userId: string, ids: string[]): Promise<void> {
    await getDb()
      .update(calendarConnections)
      .set({ selectedCalendarIds: ids, updatedAt: sql`now()` })
      .where(eq(calendarConnections.userId, userId));
  },

  async deleteForUser(userId: string): Promise<void> {
    await getDb()
      .delete(calendarConnections)
      .where(eq(calendarConnections.userId, userId));
  },
};
