import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../client";
import {
  chatMessages,
  chatSessions,
  type ChatMessage,
  type ChatRole,
  type ChatSession,
  type PersonaHalf,
} from "../schema";

/** Past-self chat sessions and messages (Phase 6), scoped by userId. */
export const ChatRepository = {
  async createSession(input: {
    userId: string;
    personaYearStart?: number | null;
    personaYearEnd?: number | null;
    /** 1 = Jan-Jun, 2 = Jul-Dec of personaYearStart; omit for a whole year. */
    personaHalf?: PersonaHalf | null;
    title?: string | null;
  }): Promise<ChatSession> {
    const rows = await getDb()
      .insert(chatSessions)
      .values({
        userId: input.userId,
        personaYearStart: input.personaYearStart ?? null,
        personaYearEnd: input.personaYearEnd ?? null,
        personaHalf: input.personaHalf ?? null,
        title: input.title ?? null,
      })
      .returning();
    return rows[0]!;
  },

  /**
   * How many live sessions this user already has for a given single-year
   * half (1 = Jan-Jun, 2 = Jul-Dec). Used to enforce the free-tier cap of two
   * conversations per half before creating a new one.
   */
  async countSessionsInHalf(
    userId: string,
    year: number,
    half: PersonaHalf,
  ): Promise<number> {
    const rows = await getDb()
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.userId, userId),
          eq(chatSessions.personaYearStart, year),
          eq(chatSessions.personaYearEnd, year),
          eq(chatSessions.personaHalf, half),
          isNull(chatSessions.deletedAt),
        ),
      );
    return rows.length;
  },

  /**
   * The user's live sessions for a half, oldest first — so a caller enforcing
   * a cap can soft-delete the oldest ones first.
   */
  async listSessionsInHalf(
    userId: string,
    year: number,
    half: PersonaHalf,
  ): Promise<ChatSession[]> {
    return getDb()
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.userId, userId),
          eq(chatSessions.personaYearStart, year),
          eq(chatSessions.personaYearEnd, year),
          eq(chatSessions.personaHalf, half),
          isNull(chatSessions.deletedAt),
        ),
      )
      .orderBy(asc(chatSessions.createdAt));
  },

  /** Soft-delete, like entries: never a hard DELETE. */
  async softDeleteSession(sessionId: string, userId: string): Promise<void> {
    await getDb()
      .update(chatSessions)
      .set({ deletedAt: new Date() })
      .where(
        and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
      );
  },

  async listSessions(userId: string): Promise<ChatSession[]> {
    return getDb()
      .select()
      .from(chatSessions)
      .where(
        and(eq(chatSessions.userId, userId), isNull(chatSessions.deletedAt)),
      )
      .orderBy(desc(chatSessions.createdAt));
  },

  async getSession(
    sessionId: string,
    userId: string,
  ): Promise<ChatSession | null> {
    const rows = await getDb()
      .select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.userId, userId),
          isNull(chatSessions.deletedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  },

  async addMessage(input: {
    sessionId: string;
    userId: string;
    role: ChatRole;
    content: string;
    citedEntryIds?: string[] | null;
  }): Promise<ChatMessage> {
    const owned = await getDb()
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, input.sessionId),
          eq(chatSessions.userId, input.userId),
          isNull(chatSessions.deletedAt),
        ),
      )
      .limit(1);
    if (!owned[0]) throw new Error("Chat session not found for user");

    const rows = await getDb()
      .insert(chatMessages)
      .values({
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        citedEntryIds: input.citedEntryIds?.length
          ? input.citedEntryIds.join(",")
          : null,
      })
      .returning();
    return rows[0]!;
  },

  async listMessages(
    sessionId: string,
    userId: string,
  ): Promise<ChatMessage[]> {
    const owned = await getDb()
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.userId, userId),
          isNull(chatSessions.deletedAt),
        ),
      )
      .limit(1);
    if (!owned[0]) return [];

    return getDb()
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt));
  },
};
