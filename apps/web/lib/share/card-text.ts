import { stripFormatting } from "@mindreva/types";

/**
 * A short, social-media-sized blurb from a summary: markdown and list markers
 * removed, whole sentences kept while they fit, and an ellipsis only if the
 * first sentence alone is too long.
 */
export function cardBlurb(summary: string | null | undefined, max = 200) {
  if (!summary) return "";
  const plain = stripFormatting(summary)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  // Split only where a capitalised sentence follows, so "3 p.m., and" stays whole.
  const sentences = plain.split(/(?<=[.!?])\s+(?=[A-Z"“])/);
  let out = "";
  for (const s of sentences) {
    const next = `${out} ${s}`.trim();
    if (next.length > max) break;
    out = next;
  }
  if (out) return out;
  const cut = plain.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : cut.length).trimEnd()}…`;
}
