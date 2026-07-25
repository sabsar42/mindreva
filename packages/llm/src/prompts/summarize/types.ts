import type { LLMMessage } from "../../types";

export interface SummaryPromptTemplate {
  /** Bump this any time the prompt text changes so old summaries stay traceable. */
  promptVersion: string;
  buildMessages(confirmedText: string): LLMMessage[];
}

/** Shared instruction every style includes: never invent what isn't there. */
export const GROUNDING_RULE =
  "Base the summary only on the content provided below. Do not invent names, numbers, decisions, or details that are not explicitly present. If the entry is too short or unclear to summarize meaningfully, say so plainly instead of guessing.";
