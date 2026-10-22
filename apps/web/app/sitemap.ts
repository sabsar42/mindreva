import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/brand-mark";

/** The public pages, for search engines. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return ["/sign-in", "/privacy", "/terms"].map((path) => ({
    url: new URL(path, base).toString(),
    changeFrequency: "monthly",
  }));
}
