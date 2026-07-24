import "server-only";
import { ChatRepository, type ChatSession } from "@mindreva/database";
import { getUser } from "@mindreva/auth/server";

/**
 * Business rules for the past-self chat. The RAG retrieval + LLM call land in
 * Phase 6; for now this exposes session listing/creation so the schema and
 * layering are exercised end-to-end.
 */

async function requireUserId(): Promise<string> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function listMyChatSessions(): Promise<ChatSession[]> {
  const userId = await requireUserId();
  return ChatRepository.listSessions(userId);
}

export async function startChatSession(input: {
  personaYearStart?: number;
  personaYearEnd?: number;
  title?: string;
}): Promise<ChatSession> {
  const userId = await requireUserId();
  return ChatRepository.createSession({ userId, ...input });
}
