/**
 * Mindreva has no paid tiers and never asks anyone to upgrade. When one of the
 * services behind it (speech-to-text, the language model) says it has hit its
 * own limit, the user sees a calm explanation and nothing else.
 */

/** Provider errors that mean "limit reached", across the providers we use. */
const LIMIT_PATTERN =
  /\((?:429|402)\)|\b429\b|quota|rate[\s_-]?limit|resource[\s_-]?exhausted|too many requests|insufficient[\s_-]?(?:credits?|funds)/i;

export function isLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return LIMIT_PATTERN.test(message);
}

/** What the user is told. Friendly, specific about what is safe, no upsell. */
export const LIMIT_MESSAGE =
  "We've reached today's limit for this. Nothing is lost, and it will work again tomorrow.";
