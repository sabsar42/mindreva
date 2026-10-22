import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/brand-mark";

// The iOS home-screen icon (apple-touch-icon). iOS rounds the corners itself,
// so this is a full-bleed square.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIcon size={180} />, size);
}
