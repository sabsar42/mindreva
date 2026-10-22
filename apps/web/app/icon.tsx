import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/brand-mark";

// The browser-tab and Android icon, generated at build time from the leaf.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<AppIcon size={512} />, size);
}
