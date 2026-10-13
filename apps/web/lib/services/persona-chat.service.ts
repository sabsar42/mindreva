import "server-only";
import { buildPersonaChatMessages, getLLMProvider } from "@mindreva/llm";
import { stripFormatting } from "@mindreva/types";
import {
  ChatRepository,
  EmbeddingsRepository,
  EntriesRepository,
  type ChatMessage,
  type ChatSession,
  type PersonaHalf,
} from "@mindreva/database";
import { getUser } from "@mindreva/auth/server";
import {
  halfLabel,
  rangeLabel,
  sessionName,
  windowFor,
} from "@/lib/past-self/sessions";

const MATCH_LIMIT = 8;
// A simple cap bounding LLM usage per conversation — see docs/roadmap.md
// Phase 6 Common mistakes: "No cap on messages per session. A free LLM tier
// disappears fast if one conversation can run unbounded turns."
export const MAX_MESSAGES_PER_SESSION = 40;

// Free-tier cap: at most this many conversations per half-year session. A
// paid tier can raise or remove this later — not configured yet, so for now
// it's a single constant, not a plan lookup. Starting a conversation that
// would exceed it soft-deletes the OLDEST live one in that half first, same
// as entries: never a hard delete.
export const MAX_FREE_CONVERSATIONS_PER_HALF = 2;

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
  // A half-year session grounds the conversation on exactly six months. The
  // hard date filter in retrieval uses this same range, so a conversation about
  // January-June 2026 can never draw on July-December.
  if (session.personaHalf === 1 || session.personaHalf === 2) {
    const window = windowFor(startYear, session.personaHalf);
    return { start: window.start, end: window.end };
  }
  return { start: `${startYear}-01-01`, end: `${endYear}-12-31` };
}

export async function listMyChatSessions(): Promise<ChatSession[]> {
  const userId = await requireUserId();
  return ChatRepository.listSessions(userId);
}

/** Soft-delete one conversation. Scoped to the caller's own sessions. */
export async function deleteMyChatSession(sessionId: string): Promise<void> {
  const userId = await requireUserId();
  await ChatRepository.softDeleteSession(sessionId, userId);
}

export async function startPersonaChatSession(input: {
  yearStart: number;
  yearEnd: number;
  /** 1 = January-June, 2 = July-December. Requires a single year. */
  half?: PersonaHalf;
}): Promise<ChatSession> {
  const userId = await requireUserId();
  const half = input.yearStart === input.yearEnd ? input.half : undefined;
  const title = half
    ? `${input.yearStart} · ${halfLabel(half)}`
    : input.yearStart === input.yearEnd
      ? String(input.yearStart)
      : `${input.yearStart}–${input.yearEnd}`;

  // Only half-year sessions are capped (a whole-year/legacy session has no
  // single half to count against).
  if (half) {
    const existing = await ChatRepository.listSessionsInHalf(
      userId,
      input.yearStart,
      half,
    );
    if (existing.length >= MAX_FREE_CONVERSATIONS_PER_HALF) {
      const toRemove = existing.slice(
        0,
        existing.length - MAX_FREE_CONVERSATIONS_PER_HALF + 1,
      );
      for (const old of toRemove) {
        await ChatRepository.softDeleteSession(old.id, userId);
      }
    }
  }

  return ChatRepository.createSession({
    userId,
    personaYearStart: input.yearStart,
    personaYearEnd: input.yearEnd,
    personaHalf: half ?? null,
    title,
  });
}

/**
 * What to call a conversation in the UI: a half-year session shows its
 * descriptive name and date range; an older whole-year or multi-year one shows
 * its years. Derived from the session's range, never from the stored title.
 */
export function describeChatSession(session: ChatSession): {
  title: string;
  rangeLabel: string;
} {
  const start = session.personaYearStart;
  const end = session.personaYearEnd ?? start;
  if (start && session.personaHalf) {
    return {
      title: sessionName(start, session.personaHalf),
      rangeLabel: rangeLabel(start, session.personaHalf),
    };
  }
  if (start && start === end) {
    return { title: String(start), rangeLabel: `January – December ${start}` };
  }
  return {
    title: start && end ? `${start}–${end}` : "Conversation",
    rangeLabel: start && end ? `${start} to ${end}` : "",
  };
}

export async function getMyChatSession(
  sessionId: string,
): Promise<ChatSession | null> {
  const userId = await requireUserId();
  return ChatRepository.getSession(sessionId, userId);
}

/** Suggested minimum entries for a period to have enough to draw on. Encouragement, not a gate — chatting below this is still allowed. */
export const SUGGESTED_MIN_ENTRIES = 5;

export interface SessionRangeContext {
  entryCount: number;
  /** First and last calendar month (1-12) the session covers, for the bar chart. */
  monthRange: [number, number];
  /** Map of month (1-12) → entry count. Only populated for single-year sessions; empty object for multi-year. */
  entriesPerMonth: Record<number, number>;
  /** Whether the range covers exactly one calendar year, i.e. whether the monthly bar chart applies. */
  isSingleYear: boolean;
  /** The real first line of the earliest entry in range, used to open the conversation. Null when the range has no entries. */
  openingLine: {
    entryId: string;
    entryDate: string | null;
    text: string;
  } | null;
}

/**
 * Everything the chat screen needs to render its empty state and its grounded
 * opening message, in one pass. The opening line is deliberately pulled from
 * real stored text (the earliest entry in range) rather than generated — see
 * docs/roadmap.md Phase 6 Common mistakes on invented detail being a
 * trust-destroying failure for this feature.
 */
export async function getSessionRangeContext(
  sessionId: string,
): Promise<SessionRangeContext> {
  const userId = await requireUserId();
  const session = await ChatRepository.getSession(sessionId, userId);
  if (!session) {
    return {
      entryCount: 0,
      monthRange: [1, 12],
      entriesPerMonth: {},
      isSingleYear: false,
      openingLine: null,
    };
  }

  const { start, end } = dateRangeForSession(session);
  const isSingleYear =
    (session.personaYearStart ?? 0) === (session.personaYearEnd ?? 0);

  const [dates, earliest] = await Promise.all([
    EntriesRepository.listEntryDatesInRange(userId, start, end),
    EntriesRepository.getEarliestInRange(userId, start, end),
  ]);

  const entriesPerMonth: Record<number, number> = isSingleYear
    ? dates.reduce<Record<number, number>>((acc, d) => {
        const m = Number(d.slice(5, 7));
        acc[m] = (acc[m] ?? 0) + 1;
        return acc;
      }, {})
    : {};

  const monthRange: [number, number] =
    session.personaHalf === 1
      ? [1, 6]
      : session.personaHalf === 2
        ? [7, 12]
        : [1, 12];

  return {
    entryCount: dates.length,
    monthRange,
    entriesPerMonth,
    isSingleYear,
    openingLine: earliest ? buildOpeningLine(earliest) : null,
  };
}

/**
 * The first sentence (or first ~180 chars) of an entry's real text, with the
 * editor's Markdown stripped. Falls back to the entry title when there's no
 * transcript text at all; returns null if there's nothing real to show —
 * never fabricates an opening.
 */
function buildOpeningLine(entry: {
  id: string;
  entryDate: string | null;
  title: string | null;
  text: string | null;
}): SessionRangeContext["openingLine"] {
  const source =
    stripFormatting(entry.text ?? "").trim() || entry.title?.trim();
  if (!source) return null;

  const firstLine = source
    .split(/\r?\n/)
    .find((l) => l.trim())
    ?.trim();
  if (!firstLine) return null;

  // Prefer a natural sentence boundary; fall back to a hard cap so a long
  // unpunctuated first line doesn't dominate the screen.
  const sentenceEnd = firstLine.search(/[.!?](\s|$)/);
  const text =
    sentenceEnd > 0 && sentenceEnd < 180
      ? firstLine.slice(0, sentenceEnd + 1)
      : firstLine.length > 180
        ? `${firstLine.slice(0, 180).trimEnd()}…`
        : firstLine;

  return { entryId: entry.id, entryDate: entry.entryDate, text };
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

/**
 * The real pipeline steps of one turn, emitted as each actually begins so the
 * UI can show what's genuinely happening rather than a timed fake sequence.
 * See docs/roadmap.md Phase 6 — the loading copy is tied to these.
 */
export type PersonaChatStage = "embedding" | "retrieving" | "generating";

export async function sendPersonaChatMessage(
  sessionId: string,
  question: string,
  onStage?: (stage: PersonaChatStage) => void,
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
    onStage?.("embedding");
    const queryVector = await provider.embed(question);
    onStage?.("retrieving");
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

  onStage?.("generating");
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
