import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand-mark";

/** Lets Mindreva be added to a home screen and open like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mindreva",
    short_name: "Mindreva",
    description:
      "Voice journaling and notetaking. Tap to record; keep a readable note.",
    start_url: "/journal",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND.background,
    theme_color: BRAND.background,
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
