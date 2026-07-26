/**
 * Converts RichTextEditor's Markdown (bold/italic only — `**bold**` and
 * `*italic*`, nothing else it ever produces) to plain text. Use this
 * anywhere formatted body text is sent to an LLM (summarization, embeddings)
 * or shown in a plain-text context (search snippets) — never send raw
 * Markdown to a model or display it unstripped where plain text is expected.
 */
export function stripFormatting(markdown: string): string {
  return (
    markdown
      // Bold: **text** -> text. Non-greedy, no nested/adjacent-marker
      // ambiguity since the editor only ever produces this exact shape.
      .replace(/\*\*(.+?)\*\*/g, "$1")
      // Italic: *text* -> text. Runs after bold so a lone leftover "*" from
      // an unmatched bold marker can't be mistaken for italic.
      .replace(/\*(.+?)\*/g, "$1")
  );
}
