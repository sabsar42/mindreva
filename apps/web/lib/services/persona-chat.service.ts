import "server-only";
import { buildPersonaChatMessages, getLLMProvider } from "@mindreva/llm";
import {
  ChatRepository,
  EmbeddingsRepository,
  EntriesRepository,
  type ChatMessage,
  type ChatSession,
} from "@mindreva/database";
import { getUser } from "@mindreva/auth/server";

const MATCH_LIMIT = 8;
// A simple cap bounding LLM usage per conversation — see docs/roadmap.md
// Phase 6 Common mistakes: "No cap on messages per session. A free LLM tier
// disappears fast if one conversation can run unbounded turns."
export const MAX_MESSAGES_PER_SESSION = 40;

async function requireUserId(): Promise<string> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

function dateRangeForSession(session: ChatSession): {
  start: string;
  end: string;
} {
  const startYear = session.personaYearStart ?? new Date().getFullYear();
  const endYear = session.personaYearEnd ?? startYear;
  return { start: `${startYear}-01-01`, end: `${endYear}-12-31` };
}

export async function listMyChatSessions(): Promise<ChatSession[]> {
  const userId = await requireUserId();
  return ChatRepository.listSessions(userId);
}

export async function startPersonaChatSession(input: {
  yearStart: number;
  yearEnd: number;
}): Promise<ChatSession> {
  const userId = await requireUserId();
  const title =
    input.yearStart === input.yearEnd
      ? String(input.yearStart)
      : `${input.yearStart}–${input.yearEnd}`;
  return ChatRepository.createSession({
    userId,
    personaYearStart: input.yearStart,
    personaYearEnd: input.yearEnd,
    title,
  });
}

export async function getMyChatSession(
  sessionId: string,
): Promise<ChatSession | null> {
  const userId = await requireUserId();
  return ChatRepository.getSession(sessionId, userId);
}

/** Entries actually available in this session's range — the upfront empty-state warning needs this before the user sends anything. */
export async function countEntriesInSessionRange(
  sessionId: string,
): Promise<number> {
  const userId = await requireUserId();
  const session = await ChatRepository.getSession(sessionId, userId);
  if (!session) return 0;
  const { start, end } = dateRangeForSession(session);
  return EntriesRepository.countForUser(userId, {
    dateFrom: start,
    dateTo: end,
  });
}

export async function listMyChatMessages(
  sessionId: string,
): Promise<ChatMessage[]> {
  const userId = await requireUserId();
  return ChatRepository.listMessages(sessionId, userId);
}

/**
 * One turn: embed the question, retrieve top-k excerpts hard-filtered to the
 * session's date range (see EmbeddingsRepository.matchEntries — the range
 * filter runs BEFORE vector ranking, not after), build the grounded prompt,
 * and store both the question and the reply. citedEntryIds is the
 * deduplicated set of entries whose excerpts were actually included in the
 * prompt context for this reply.
 */
export interface CitedEntry {
  entryId: string;
  entryDate: string | null;
}

export async function sendPersonaChatMessage(
  sessionId: string,
  question: string,
): Promise<{ reply: ChatMessage; citedEntries: CitedEntry[] }> {
  const userId = await requireUserId();
  const session = await ChatRepository.getSession(sessionId, userId);
  if (!session) throw new Error("Chat session not found");

  const priorMessages = await ChatRepository.listMessages(sessionId, userId);
  if (priorMessages.length >= MAX_MESSAGES_PER_SESSION) {
    throw new Error(
      `This conversation has reached its ${MAX_MESSAGES_PER_SESSION}-message limit. Start a new session to keep exploring.`,
    );
  }

  await ChatRepository.addMessage({
    sessionId,
    userId,
    role: "user",
    content: question,
  });

  const { start, end } = dateRangeForSession(session);
  const provider = getLLMProvider();

  let excerpts: { entryId: string; entryDate: string | null; text: string }[] =
    [];
  try {
    const queryVector = await provider.embed(question);
    const matches = await EmbeddingsRepository.matchEntries(
      userId,
      queryVector,
      start,
      end,
      MATCH_LIMIT,
    );
    excerpts = matches
      .filter((m) => m.chunkText)
      .map((m) => ({
        entryId: m.entryId,
        entryDate: m.entryDate,
        text: m.chunkText!,
      }));
  } catch (err) {
    // Retrieval failure shouldn't crash the conversation — fall back to no
    // excerpts, which the grounding prompt explicitly handles ("I don't have
    // a journal entry from this period about that").
    console.error(`Retrieval failed for chat session ${sessionId}:`, err);
  }

  const conversationHistory = priorMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const messages = buildPersonaChatMessages({
    startDate: start,
    endDate: end,
    excerpts,
    conversationHistory,
    question,
  });

  const replyText = await provider.complete(messages);
  const citedEntries = [
    ...new Map(excerpts.map((e) => [e.entryId, e])).values(),
  ].map((e) => ({ entryId: e.entryId, entryDate: e.entryDate }));

  const reply = await ChatRepository.addMessage({
    sessionId,
    userId,
    role: "assistant",
    content: replyText,
    citedEntryIds: citedEntries.map((e) => e.entryId),
  });

  return { reply, citedEntries };
}
