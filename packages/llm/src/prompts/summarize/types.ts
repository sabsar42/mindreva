import type { LLMMessage } from "../../types";

export interface SummaryPromptTemplate {
  /** Bump this any time the prompt text changes so old summaries stay traceable. */
  promptVersion: string;
  buildMessages(confirmedText: string): LLMMessage[];
}

/** Shared instruction every style includes: never invent what isn't there. */
export const GROUNDING_RULE =
  "Base the summary only on the content provided below. Do not invent names, numbers, decisions, or details that are not explicitly present. If the entry is too short or unclear to summarize meaningfully, say so plainly instead of guessing.";

/** Marks the start of an optional, separately-parsed task block appended
 * after the summary — see TASK_EXTRACTION_RULE and parseTaskBlock(). Chosen
 * to be extremely unlikely to appear in ordinary summary prose, so a plain
 * string search is enough to split it out without a JSON mode round trip. */
export const TASK_BLOCK_MARKER = "===TASKS===";

/** Prefix of the optional first line carrying a short generated title. */
export const TITLE_PREFIX = "TITLE:";

/** Asks for a short title on the first line of the same completion (no
 * second LLM call). Parsed and stripped by parseTitleLine(). */
export const TITLE_RULE = `Begin your reply with one line "${TITLE_PREFIX} " followed by a title of 2 to 6 words naming what the entry is about (plain words, no quotes, no trailing punctuation), then a blank line, then the rest as described.`;

/** Marks an optional, separately-parsed block of dated events at the very end
 * of a reply — see EVENT_RULE and parseEventBlock(). */
export const EVENT_BLOCK_MARKER = "===EVENTS===";

/** Asks for upcoming dated events in the same completion (no extra call). The
 * entry's own date is appended to the user message by the caller so words like
 * "tomorrow" or "Thursday" resolve correctly. */
export const EVENT_RULE = `Last of all, if the person mentions a specific upcoming appointment, meeting or plan with a clear date (a day name, "tomorrow", "next week", or a date), add a final line "${EVENT_BLOCK_MARKER}" and then one event per line as "- YYYY-MM-DD HH:MM | Short title" (24-hour time; if no time was said, write "- YYYY-MM-DD | Short title"). Work out relative dates from the entry date given below the entry. The title is at most 6 words. Include only things that are still to happen, never past events, vague intentions with no date, or tasks with no set time. If none qualify, omit the ${EVENT_BLOCK_MARKER} block entirely. Never invent a date.`;

/**
 * Appended to every style's system prompt. Keeps task extraction a single
 * additional instruction on the existing summarize call, rather than a
 * second LLM call — action items are common enough across journal/note
 * styles (not just meetings) that every style gets the option, but the
 * model is told explicitly to skip the block when nothing qualifies.
 */
export const TASK_EXTRACTION_RULE = `${TITLE_RULE} After the summary, if the content clearly implies things the person must do (follow-ups, errands, commitments, things to buy, send, book or finish), add a line "${TASK_BLOCK_MARKER}" and then one task per line starting with "- ". Keep the list short and quick to scan: at most 6 tasks, merge duplicates, each one a single action starting with a verb and no longer than 8 words (e.g. "- Email Priya the budget draft"), adding who or when only if it was said. Do not repeat the tasks inside the summary itself; the summary covers what happened and what was felt, the list covers what to do. Do not list a dated appointment or meeting as a task if it belongs in the ${EVENT_BLOCK_MARKER} block; tasks are only things the person still has to do. If nothing is genuinely an action item, omit the ${TASK_BLOCK_MARKER} block entirely and do not invent tasks. ${EVENT_RULE}`;

/**
 * Splits a raw LLM response into the visible summary and the optional task
 * list, using TASK_BLOCK_MARKER as the boundary. Safe against the marker
 * being absent (the common case) or malformed — worst case, no tasks are
 * extracted and the full response becomes the summary.
 */
export function parseTaskBlock(rawResponse: string): {
  summaryText: string;
  tasks: string[];
} {
  const markerIndex = rawResponse.indexOf(TASK_BLOCK_MARKER);
  if (markerIndex === -1) {
    return { summaryText: rawResponse.trim(), tasks: [] };
  }

  const summaryText = rawResponse.slice(0, markerIndex).trim();
  const taskBlock = rawResponse.slice(markerIndex + TASK_BLOCK_MARKER.length);
  const tasks = taskBlock
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);

  return { summaryText, tasks };
}

/**
 * Splits the optional first "TITLE: ..." line off a raw response. Safe when
 * the line is absent: the whole response is returned and the title is null.
 */
export function parseTitleLine(rawResponse: string): {
  title: string | null;
  rest: string;
} {
  const trimmed = rawResponse.trimStart();
  if (!trimmed.toUpperCase().startsWith(TITLE_PREFIX)) {
    return { title: null, rest: rawResponse };
  }
  const newline = trimmed.indexOf("\n");
  const line = newline === -1 ? trimmed : trimmed.slice(0, newline);
  const title = line
    .slice(TITLE_PREFIX.length)
    .trim()
    .replace(/^["'“”*_]+|["'“”*_.]+$/g, "")
    .trim();
  const rest = newline === -1 ? "" : trimmed.slice(newline + 1);
  return { title: title && title.length <= 80 ? title : null, rest };
}

export interface ParsedEvent {
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" (24-hour), or null for an all-day event. */
  time: string | null;
  title: string;
}

const EVENT_LINE =
  /^-\s*(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}))?\s*[|–—-]\s*(.+)$/;

function isRealDate(key: string): boolean {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m! - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Splits the optional EVENTS block off a raw response. Returns the text with
 * the block removed (so the summary and task parsing never see it) and the
 * valid events. Malformed lines are skipped; a missing block is the common
 * case. If the model put the TASKS block after the events, that block is kept.
 */
export function parseEventBlock(rawResponse: string): {
  rest: string;
  events: ParsedEvent[];
} {
  const at = rawResponse.indexOf(EVENT_BLOCK_MARKER);
  if (at === -1) return { rest: rawResponse, events: [] };

  const before = rawResponse.slice(0, at);
  let section = rawResponse.slice(at + EVENT_BLOCK_MARKER.length);
  let tail = "";
  const tasksAt = section.indexOf(TASK_BLOCK_MARKER);
  if (tasksAt !== -1) {
    tail = section.slice(tasksAt);
    section = section.slice(0, tasksAt);
  }

  const events: ParsedEvent[] = [];
  for (const raw of section.split("\n")) {
    const m = raw.trim().match(EVENT_LINE);
    if (!m) continue;
    const date = m[1]!;
    if (!isRealDate(date)) continue;
    let time: string | null = null;
    if (m[2]) {
      const [h, min] = m[2].split(":").map(Number);
      if (h! > 23 || min! > 59) continue;
      time = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    }
    const title = m[3]!
      .trim()
      .replace(/^["'“]+|["'”.]+$/g, "")
      .trim();
    if (!title || title.length > 80) continue;
    events.push({ date, time, title });
  }
  return {
    rest: (before.trimEnd() + (tail ? "\n" + tail : "")).trimEnd(),
    events,
  };
}
