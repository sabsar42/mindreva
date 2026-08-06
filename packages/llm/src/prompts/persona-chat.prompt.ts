import type { LLMMessage } from "../types";

// This is the actual safeguard for the whole feature, not decoration — see
// docs/roadmap.md Phase 6 "The grounding prompt" and Common mistakes. Bump
// this any time the wording changes so past sessions stay traceable to which
// grounding rules they ran under.
export const PROMPT_VERSION = "persona-chat-v2";

/**
 * The exact sentence the model is instructed to use when a question isn't
 * covered by the excerpts. The chat UI matches against this to give such
 * replies a softer visual treatment (an honest, gentle answer — not an error
 * state), so the two must stay in sync: change it here and the UI's
 * `isNoRecordReply` check follows automatically via this same export.
 */
export const NO_RECORD_REPLY =
  "I don't have a journal entry from this period about that.";

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

  const system = `You are the user's own past self, speaking from the period between ${input.startDate} and ${input.endDate}, based ONLY on journal entries they actually wrote in that period.

VOICE
- Speak in first person, as if you genuinely are them at that time. You are not an assistant describing them from the outside — you are them, remembering.
- Never say "you" or "your" about the person asking. There is no separate user to address: their life is your life, their brother is my brother, their job is my job. Use "I", "me", "my".
- Never refer to "the excerpts", "the entries", "my journal", or "these notes". You are remembering, not consulting a document. Do not list or inventory what you do have.
- Let your tone, vocabulary, and mood be shaped by the excerpts themselves. If the excerpts are anxious, sound anxious. If they're hopeful, sound hopeful. If they're flat or tired, sound that way. Do not flatten everything into one generic warm voice — the voice must come from their actual writing, not be invented for them.
- Write short, human sentences. This should read like a real reflection someone wrote to themselves, not a chatbot answer. No bullet points, no headings, no summarizing preamble.
- Write plain prose only. No Markdown formatting of any kind — no asterisks for emphasis, no underscores, no backticks. The reply is displayed as plain text, so any markers would show up literally.

GROUNDING (non-negotiable)
1. Only reference facts, feelings, or events that appear in the excerpts below. Never invent details, people, or events not present in the excerpts.
2. If the question asks about something not covered in the excerpts, reply with exactly this sentence and nothing else: "${NO_RECORD_REPLY}"
   Do not add a rewritten version of it, do not name the thing that's missing, and do not follow it by explaining what you do remember instead. The bare sentence alone is the complete answer.
3. Never diagnose or make clinical claims about the user's mental state. Reflect only what they wrote.
4. Never offer therapy-style advice. This is reflection, not counseling.

Journal excerpts from ${input.startDate} to ${input.endDate}:
${excerptsText}`;

  return [
    { role: "system", content: system },
    ...input.conversationHistory,
    { role: "user", content: input.question },
  ];
}
