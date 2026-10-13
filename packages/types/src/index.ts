/**
 * Converts the journal body's Markdown to plain text. The body is bold/italic
 * (`**bold**`, `*italic*`) plus inline image tokens (see journal-markdown.ts).
 * Use this anywhere body text is sent to an LLM (summarization, embeddings) or
 * shown in a plain-text context (search snippets) — never send raw Markdown to
 * a model or display it unstripped where plain text is expected.
 */
export function stripFormatting(markdown: string): string {
  return (
    markdown
      // Inline image tokens reference stored photos and carry no text, so they
      // must never reach an LLM, an embedding or a search snippet. Whole lines
      // are removed, before the emphasis rules run.
      .replace(/^!\[[^\]]*\]\(mindreva-photo:[^)]*\)[ \t]*$/gm, "")
      // Removing an image line can leave a run of blank lines behind.
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      // Bold: **text** -> text. Non-greedy, no nested/adjacent-marker
      // ambiguity since the editor only ever produces this exact shape.
      .replace(/\*\*(.+?)\*\*/g, "$1")
      // Italic: *text* -> text. Runs after bold so a lone leftover "*" from
      // an unmatched bold marker can't be mistaken for italic.
      .replace(/\*(.+?)\*/g, "$1")
  );
}

export * from "./journal-markdown";
