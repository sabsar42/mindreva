import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/brand-mark";

/**
 * Only the public pages may be crawled. Everything behind sign-in, the API,
 * and shared entries (/s/…, personal writing reached by link) stay out.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/sign-in", "/sign-up", "/privacy", "/terms"],
        disallow: [
          "/api/",
          "/s/",
          "/journal",
          "/entries/",
          "/chat",
          "/account",
          "/archive",
          "/trash",
          "/mindmap",
          "/integrations",
          "/onboarding",
          "/monitoring",
          "/dev/",
        ],
      },
    ],
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}
