import "server-only";
import { ChatRepository } from "@mindreva/database";
import { getUser } from "@mindreva/auth/server";
import { listMyEntries } from "./entries.service";
import {
  buildPastSelf,
  type PastSelfYear,
  type SessionConversation,
  type SessionEntry,
} from "@/lib/past-self/sessions";

async function requireUserId(): Promise<string> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

/**
 * Everything the Past Self screen lists, grouped into years of exactly two
 * six-month sessions. Reads the user's existing entries and conversations and
 * only groups them: it creates nothing, so no historical content is duplicated
 * or moved in the database.
 *
 * Includes every entry type, not just journals: the conversations are grounded
 * on all of a user's entries, so the list should match what they can draw on.
 */
export async function getMyPastSelf(): Promise<PastSelfYear[]> {
  const userId = await requireUserId();
  const [entries, sessions] = await Promise.all([
    listMyEntries(),
    ChatRepository.listSessions(userId),
  ]);

  const sessionEntries: SessionEntry[] = entries.map((e) => ({
    id: e.id,
    title: e.title,
    entryDate: e.entryDate,
    createdAt: e.createdAt.toISOString(),
    snippet: e.snippet,
  }));
  const conversations: SessionConversation[] = sessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt.toISOString(),
    personaYearStart: s.personaYearStart,
    personaYearEnd: s.personaYearEnd,
    personaHalf:
      s.personaHalf === 1 || s.personaHalf === 2 ? s.personaHalf : null,
  }));

  return buildPastSelf(sessionEntries, conversations);
}
