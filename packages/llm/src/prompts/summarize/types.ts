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

/**
 * Appended to every style's system prompt. Keeps task extraction a single
 * additional instruction on the existing summarize call, rather than a
 * second LLM call — action items are common enough across journal/note
 * styles (not just meetings) that every style gets the option, but the
 * model is told explicitly to skip the block when nothing qualifies.
 */
export const TASK_EXTRACTION_RULE = `${TITLE_RULE} After the summary, if the content clearly implies one or more concrete action items, follow-ups, or to-dos the person should do (most common in meeting notes, but not limited to them), add a line "${TASK_BLOCK_MARKER}" and then one task per line starting with "- ". Each task should be a short, self-contained action (e.g. "- Email Priya the budget draft"), not a restatement of the whole entry. If nothing in the content is genuinely an action item, omit the ${TASK_BLOCK_MARKER} block entirely — do not invent tasks to fill it.`;

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
