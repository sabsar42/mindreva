import type { LLMMessage } from "../types";

// Versioned like every other prompt in this package — bump when the wording
// changes so existing labels stay traceable to the rules that produced them.
export const PROMPT_VERSION = "theme-label-v1";

/** Fallback when the model returns nothing usable. Never invents a theme. */
export const UNLABELED_THEME = "Other";

/**
 * Asks for a short, human theme label for one cluster of journal excerpts.
 * The excerpts are the entries nearest the cluster's centroid, not all of
 * them — enough signal to name the theme without spending tokens on the tail.
 *
 * The label is a UI affordance (a node on a map), not a claim about the user,
 * so the rules keep it descriptive and plain: no diagnosis, no interpretation
 * of what the writing "means" about them.
 */
export function buildThemeLabelMessages(excerpts: string[]): LLMMessage[] {
  const numbered = excerpts
    .map((text, i) => `${i + 1}. ${text.slice(0, 400)}`)
    .join("\n\n");

  return [
    {
      role: "system",
      content: `You name themes in someone's journal entries. Given a few excerpts that were grouped together, reply with a short label naming what they have in common.

Rules:
- 1 to 3 words. Title case. No trailing punctuation.
- Name the subject matter, not the emotion behind it: "Job hunting", "Sleep", "Family visits" — not "Feeling lost" or "Anxiety about work".
- Never diagnose, interpret, or make claims about the person's mental state.
- If the excerpts have no clear common subject, reply with exactly: ${UNLABELED_THEME}
- Reply with the label only. No quotes, no explanation, no preamble.`,
    },
    {
      role: "user",
      content: `Excerpts:\n\n${numbered}`,
    },
  ];
}

/**
 * Normalizes a raw model reply into a usable label. Models occasionally wrap
 * the answer in quotes, add a trailing period, or return a whole sentence
 * despite the instructions — this keeps a stray verbose reply from becoming a
 * paragraph-long node label on the map.
 */
export function parseThemeLabel(raw: string): string {
  const cleaned = raw
    .trim()
    .split(/\r?\n/)[0]!
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.,;:]+$/, "")
    .trim();

  if (!cleaned) return UNLABELED_THEME;

  // Guard against a model that ignored "1 to 3 words" entirely.
  const words = cleaned.split(/\s+/);
  if (words.length > 4) return words.slice(0, 3).join(" ");

  return cleaned;
}
