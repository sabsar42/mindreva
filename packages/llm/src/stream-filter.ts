/**
 * Strips <think>…</think> / <thinking>…</thinking> reasoning blocks from a
 * STREAMED completion, where a tag can arrive split across chunks ("<thi" +
 * "nk>"). Text that might be the start of a tag is held back until the next
 * chunk shows what it is. The non-streaming equivalent is the strip regex in
 * providers/openrouter-provider.ts; this exists because a fallback model may
 * ignore `reasoning.exclude` and the system-prompt instruction.
 */
const OPEN = /<think(?:ing)?>/i;
const CLOSE = /<\/think(?:ing)?>/i;
const LONGEST_TAG = "</thinking>".length;

export class ThinkTagFilter {
  private buffer = "";
  private inside = false;

  /** Feed one streamed chunk; returns the text that is safe to show now. */
  push(chunk: string): string {
    this.buffer += chunk;
    let out = "";
    for (;;) {
      if (this.inside) {
        const close = CLOSE.exec(this.buffer);
        if (!close) {
          // Keep only a tail that could still be the start of the close tag.
          this.buffer = this.buffer.slice(-LONGEST_TAG);
          return out;
        }
        this.buffer = this.buffer.slice(close.index + close[0].length);
        this.inside = false;
        continue;
      }
      const open = OPEN.exec(this.buffer);
      if (open) {
        out += this.buffer.slice(0, open.index);
        this.buffer = this.buffer.slice(open.index + open[0].length);
        this.inside = true;
        continue;
      }
      // Hold back a trailing "<", "<th", "<thinkin"… that may become a tag.
      const lt = this.buffer.lastIndexOf("<");
      if (
        lt !== -1 &&
        "<thinking>".startsWith(this.buffer.slice(lt).toLowerCase())
      ) {
        out += this.buffer.slice(0, lt);
        this.buffer = this.buffer.slice(lt);
      } else {
        out += this.buffer;
        this.buffer = "";
      }
      return out;
    }
  }

  /** End of stream: whatever is left (an unclosed think block is dropped). */
  flush(): string {
    const rest = this.inside ? "" : this.buffer;
    this.buffer = "";
    return rest;
  }
}
