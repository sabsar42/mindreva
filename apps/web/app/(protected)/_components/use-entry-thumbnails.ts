"use client";

import * as React from "react";
import {
  knownEntryThumbnails,
  rememberEntryThumbnail,
} from "@/lib/photo-url-cache";

/**
 * Cover-photo thumbnail URLs, fetched client-side after the entry list has
 * already painted rather than blocking the server render. Signing a photo's
 * URL is a real Supabase Storage round trip with a genuine data dependency
 * on first looking up which photo an entry has — the list itself doesn't
 * need either step to be useful, so both were moved off the initial page
 * load (see docs/CHANGELOG.md's 2026-08-16 entry for the measured cost this
 * used to add to every journal/notes/archive/trash visit).
 *
 * Thumbnails already seen this session start out filled in (and keep their
 * exact URL, so the browser shows the cached image instead of downloading it
 * again — see lib/photo-url-cache.ts). Only ids still missing are fetched.
 */
export function useEntryThumbnails(
  visibleIds: string[],
): Record<string, string> {
  const idsKey = visibleIds.join(",");
  const [thumbnails, setThumbnails] = React.useState<Record<string, string>>(
    () => knownEntryThumbnails(visibleIds),
  );

  React.useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    const known = knownEntryThumbnails(ids);
    const missing = ids.filter((id) => !(id in known));
    if (Object.keys(known).length > 0) {
      setThumbnails((prev) => ({ ...prev, ...known }));
    }
    if (missing.length === 0) return;
    void fetch("/api/entries/thumbnails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryIds: missing }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { thumbnails: Record<string, string> } | null) => {
        if (!data) return;
        const stable = Object.fromEntries(
          Object.entries(data.thumbnails).map(([id, url]) => [
            id,
            rememberEntryThumbnail(id, url),
          ]),
        );
        setThumbnails((prev) => ({ ...prev, ...stable }));
      })
      .catch(() => {
        // Non-fatal — rows just render without a cover photo.
      });
  }, [idsKey]);

  return thumbnails;
}
