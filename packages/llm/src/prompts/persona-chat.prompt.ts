import type { LLMMessage } from "../types";

// This is the actual safeguard for the whole feature, not decoration — see
// docs/roadmap.md Phase 6 "The grounding prompt" and Common mistakes. Bump
// this any time the wording changes so past sessions stay traceable to which
// grounding rules they ran under.
export const PROMPT_VERSION = "persona-chat-v1";

export interface PersonaChatExcerpt {
  entryId: string;
  entryDate: string | null;
  text: string;
}

/**
 * Builds the full message list for one turn of a past-self conversation:
 * the grounded system prompt (with the date range and retrieved excerpts
 * baked in), the session's prior turns, and the new question. Excerpts must
 * already be hard-filtered to [startDate, endDate] by the caller (see
 * EmbeddingsRepository.matchEntries) — this prompt only adds the second
 * layer of defense (instructing the model not to go beyond them), it is not
 * a substitute for the date-range filter itself.
 */
export function buildPersonaChatMessages(input: {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  excerpts: PersonaChatExcerpt[];
  conversationHistory: LLMMessage[];
  question: string;
}): LLMMessage[] {
  const excerptsText = input.excerpts.length
    ? input.excerpts
        .map((e) => `[${e.entryDate ?? "undated"}] ${e.text}`)
        .join("\n\n---\n\n")
    : "(No journal excerpts were found for this date range.)";

  const system = `You are simulating a reflective conversation with the user's own past self, based ONLY on journal entries they actually wrote between ${input.startDate} and ${input.endDate}.

Rules:
1. Only reference facts, feelings, or events that appear in the excerpts below. Never invent details, people, or events not present in the excerpts.
2. If the question asks about something not covered in the excerpts, say plainly: "I don't have a journal entry from this period about that."
3. Speak in first person, grounded in the tone and words actually used in the excerpts.
4. Never diagnose or make clinical claims about the user's mental state. Reflect only what they wrote.
5. Never offer therapy-style advice. This is a reflective exercise, not counseling.

Journal excerpts from ${input.startDate} to ${input.endDate}:
${excerptsText}`;

  return [
    { role: "system", content: system },
    ...input.conversationHistory,
    { role: "user", content: input.question },
  ];
}
