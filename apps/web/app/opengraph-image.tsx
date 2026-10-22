import { ImageResponse } from "next/og";
import { BRAND, LEAF_PATH } from "@/lib/brand-mark";

// The preview shown when a Mindreva link is shared (iMessage, Slack, …).
// Shared entries (/s/…) are private and not indexed; this is the app's own.
export const alt = "Mindreva — voice journaling";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 56,
        padding: "0 110px",
        background: BRAND.background,
        color: BRAND.foreground,
      }}
    >
      <div
        style={{
          width: 220,
          height: 220,
          borderRadius: 52,
          background: BRAND.tint,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width={81} height={124} viewBox="0 0 496 757" fill={BRAND.onTint}>
          <path fillRule="evenodd" d={LEAF_PATH} />
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -2 }}>
          Mindreva
        </div>
        <div style={{ fontSize: 40, color: "#55555b", maxWidth: 700 }}>
          Talk, and keep a readable journal. Ask your past self what you wrote.
        </div>
      </div>
    </div>,
    size,
  );
}
