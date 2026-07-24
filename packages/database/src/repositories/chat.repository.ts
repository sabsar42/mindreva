import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../client";
import {
  chatMessages,
  chatSessions,
  type ChatMessage,
  type ChatRole,
  type ChatSession,
} from "../schema";

/** Past-self chat sessions and messages (Phase 6), scoped by userId. */
export const ChatRepository = {
  async createSession(input: {
    userId: string;
    personaYearStart?: number | null;
    personaYearEnd?: number | null;
    title?: string | null;
  }): Promise<ChatSession> {
    const rows = await getDb()
      .insert(chatSessions)
      .values({
        userId: input.userId,
        personaYearStart: input.personaYearStart ?? null,
        personaYearEnd: input.personaYearEnd ?? null,
        title: input.title ?? null,
      })
      .returning();
    return rows[0]!;
  },

  async listSessions(userId: string): Promise<ChatSession[]> {
    return getDb()
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
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
        and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
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
        and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
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
