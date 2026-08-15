"use client";

import * as React from "react";

/**
 * Cover-photo thumbnail URLs, fetched client-side after the entry list has
 * already painted rather than blocking the server render. Signing a photo's
 * URL is a real Supabase Storage round trip with a genuine data dependency
 * on first looking up which photo an entry has — the list itself doesn't
 * need either step to be useful, so both were moved off the initial page
 * load (see docs/CHANGELOG.md's 2026-08-16 entry for the measured cost this
 * used to add to every journal/notes/archive/trash visit).
 *
 * Only fetches ids it doesn't already have a thumbnail for, so switching
 * filters or re-rendering with the same visible entries doesn't re-fetch.
 */
export function useEntryThumbnails(
  visibleIds: string[],
): Record<string, string> {
  const [thumbnails, setThumbnails] = React.useState<Record<string, string>>(
    {},
  );
  const idsKey = visibleIds.join(",");

  React.useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    const missing = ids.filter((id) => !(id in thumbnails));
    if (missing.length === 0) return;
    void fetch("/api/entries/thumbnails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryIds: missing }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { thumbnails: Record<string, string> } | null) => {
        if (!data) return;
        setThumbnails((prev) => ({ ...prev, ...data.thumbnails }));
      })
      .catch(() => {
        // Non-fatal — rows just render without a cover photo.
      });
    // thumbnails intentionally excluded: it's what this effect writes to,
    // and including it would refire on every partial result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return thumbnails;
}
