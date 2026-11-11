/* eslint-disable -- satori renders these <img> elements, not the browser */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getUser } from "@mindreva/auth/server";
import { titleFromWords } from "@mindreva/types";
import { getMyEntryDetail } from "@/lib/services/entries.service";
import { getDefaultArtwork } from "@/lib/default-artwork";
import { cardBlurb } from "@/lib/share/card-text";

export const runtime = "nodejs";

const SIZES = {
  story: { width: 1080, height: 1920, image: 940 },
  square: { width: 1080, height: 1080, image: 470 },
} as const;

async function pictureFor(entryId: string, photoUrl: string | undefined) {
  if (photoUrl) {
    try {
      const res = await fetch(photoUrl);
      if (res.ok) {
        const type = res.headers.get("content-type") ?? "image/jpeg";
        // satori reads PNG and JPEG; anything else falls back to artwork.
        if (/image\/(png|jpe?g)/.test(type)) {
          const buf = Buffer.from(await res.arrayBuffer());
          return `data:${type};base64,${buf.toString("base64")}`;
        }
      }
    } catch {
      /* fall through to the artwork */
    }
  }
  const file = path.join(process.cwd(), "public", getDefaultArtwork(entryId));
  const svg = await readFile(file);
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

/**
 * A share card for one entry: a picture, a short title and a short summary,
 * nothing else. `?format=story` (1080x1920, for Stories) or `square`. Only the
 * owner can render it, and it is built from what they can already see.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const user = await getUser();
  if (!user) return new Response("Not authenticated", { status: 401 });

  const { entryId } = await params;
  const detail = await getMyEntryDetail(entryId).catch(() => null);
  if (!detail) return new Response("Not found", { status: 404 });

  const format =
    new URL(request.url).searchParams.get("format") === "square"
      ? "square"
      : "story";
  const { width, height, image } = SIZES[format];
  const story = format === "story";

  const cover =
    detail.photos.find((p) => p.kind === "cover") ?? detail.photos[0];
  const picture = await pictureFor(entryId, cover?.url);
  const body =
    detail.transcript?.editedText ?? detail.transcript?.rawText ?? "";
  const title =
    detail.entry.title?.trim() ||
    titleFromWords(body) ||
    "A moment worth keeping";
  const blurb = cardBlurb(detail.summary?.summaryText ?? body);

  const pad = 72;
  return new ImageResponse(
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: story ? "column" : "row",
        background: "#FAF8F3",
        padding: pad,
        gap: 56,
        fontFamily: "sans-serif",
      }}
    >
      <img
        src={picture}
        width={story ? width - pad * 2 : image}
        height={story ? image : height - pad * 2}
        style={{ objectFit: "cover", borderRadius: 56 }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: story ? "flex-start" : "center",
        }}
      >
        <div
          style={{
            fontSize: story ? 76 : 60,
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: -2,
            color: "#1C1C1E",
          }}
        >
          {title}
        </div>
        {blurb ? (
          <div
            style={{
              marginTop: 28,
              fontSize: story ? 40 : 32,
              lineHeight: 1.4,
              color: "#6B6B70",
            }}
          >
            {blurb}
          </div>
        ) : null}
        <div style={{ display: "flex", flex: 1 }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 24,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              background: "#26623F",
            }}
          />
          <div style={{ fontSize: 30, fontWeight: 600, color: "#1C1C1E" }}>
            Mindreva
          </div>
        </div>
      </div>
    </div>,
    {
      width,
      height,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
