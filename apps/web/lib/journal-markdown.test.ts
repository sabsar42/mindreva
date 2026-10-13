import { describe, expect, it } from "vitest";
import {
  extractInlinePhotoIds,
  formatImageToken,
  parseImageLine,
  parseJournalMarkdown,
  stripFormatting,
} from "@mindreva/types";

const ID_A = "0b6f3f5e-1c2d-4e8a-9a41-3c5d7e9f1a22";
const ID_B = "7d1a9c20-5b34-4f6e-8c11-2a9b0d4e6f33";

describe("image tokens", () => {
  it("round-trips through format and parse", () => {
    const token = formatImageToken({
      photoId: ID_A,
      size: "m",
      align: "left",
      alt: "Lake at dawn",
    });
    expect(token).toBe(
      `![Lake at dawn](mindreva-photo:${ID_A}?size=m&align=left)`,
    );
    expect(parseImageLine(token)).toEqual({
      photoId: ID_A,
      size: "m",
      align: "left",
      alt: "Lake at dawn",
    });
  });

  it("falls back to defaults for missing or invalid options", () => {
    expect(
      parseImageLine(`![](mindreva-photo:${ID_A}?size=huge&align=sideways)`),
    ).toMatchObject({ size: "l", align: "center" });
    expect(parseImageLine(`![](mindreva-photo:${ID_A})`)).toMatchObject({
      size: "l",
      align: "center",
    });
  });

  it("flattens characters that would break the alt text", () => {
    const token = formatImageToken({
      photoId: ID_A,
      size: "l",
      align: "center",
      alt: "a]b\nc",
    });
    expect(parseImageLine(token)?.alt).toBe("a b c");
  });

  it("does not treat ordinary text or foreign images as tokens", () => {
    expect(parseImageLine("just a sentence")).toBeNull();
    expect(parseImageLine("![x](https://example.com/a.png)")).toBeNull();
    expect(parseImageLine(`text ![](mindreva-photo:${ID_A})`)).toBeNull();
  });
});

describe("parseJournalMarkdown", () => {
  it("keeps text and images in their original order", () => {
    const md = [
      "First paragraph.",
      "",
      formatImageToken({ photoId: ID_A, size: "l", align: "center", alt: "" }),
      "",
      "Second paragraph.",
      "",
      formatImageToken({ photoId: ID_B, size: "s", align: "right", alt: "" }),
      "",
      "Third.",
    ].join("\n");

    const blocks = parseJournalMarkdown(md);
    expect(blocks.map((b) => b.type)).toEqual([
      "paragraph",
      "image",
      "paragraph",
      "image",
      "paragraph",
    ]);
    expect(extractInlinePhotoIds(md)).toEqual([ID_A, ID_B]);
  });

  it("parses bold and italic runs", () => {
    const [block] = parseJournalMarkdown("Plain **bold** and *italic* end");
    expect(block).toEqual({
      type: "paragraph",
      inline: [
        { text: "Plain ", bold: false, italic: false },
        { text: "bold", bold: true, italic: false },
        { text: " and ", bold: false, italic: false },
        { text: "italic", bold: false, italic: true },
        { text: " end", bold: false, italic: false },
      ],
    });
  });

  it("treats single newlines as part of one paragraph", () => {
    const blocks = parseJournalMarkdown("line one\nline two\n\nnext");
    expect(blocks).toHaveLength(2);
  });
});

describe("stripFormatting", () => {
  it("removes image tokens so they never reach an LLM or embedding", () => {
    const md = `Before.\n\n${formatImageToken({ photoId: ID_A, size: "m", align: "left", alt: "" })}\n\nAfter **bold**.`;
    expect(stripFormatting(md)).toBe("Before.\n\nAfter bold.");
  });

  it("returns an empty string for an image-only body", () => {
    expect(
      stripFormatting(
        formatImageToken({
          photoId: ID_A,
          size: "l",
          align: "center",
          alt: "",
        }),
      ),
    ).toBe("");
  });

  it("still strips bold and italic as before", () => {
    expect(stripFormatting("a **b** *c*")).toBe("a b c");
  });
});
