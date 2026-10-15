"use client";

import * as React from "react";
import {
  isKnownWithoutCover,
  knownEntryThumbnails,
  rememberEntryThumbnail,
  rememberNoCover,
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
 *
 * `resolved` holds every id whose answer is known (a photo, or none), so a
 * card can show a neutral tile until then instead of default artwork that
 * gets swapped for the real photo a moment later.
 */
export function useEntryThumbnails(visibleIds: string[]): {
  thumbnails: Record<string, string>;
  resolved: (id: string) => boolean;
} {
  const idsKey = visibleIds.join(",");
  const [thumbnails, setThumbnails] = React.useState<Record<string, string>>(
    () => knownEntryThumbnails(visibleIds),
  );
  const [settled, setSettled] = React.useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  React.useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    const known = knownEntryThumbnails(ids);
    const missing = ids.filter(
      (id) => !(id in known) && !isKnownWithoutCover(id),
    );
    if (Object.keys(known).length > 0) {
      setThumbnails((prev) => ({ ...prev, ...known }));
    }
    if (missing.length === 0) return;
    let alive = true;
    const markSettled = () =>
      alive &&
      setSettled((prev) => {
        const next = new Set(prev);
        for (const id of missing) next.add(id);
        return next;
      });
    void fetch("/api/entries/thumbnails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryIds: missing }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { thumbnails: Record<string, string> } | null) => {
        if (!data) return;
        const stable: Record<string, string> = {};
        for (const id of missing) {
          const url = data.thumbnails[id];
          if (url) stable[id] = rememberEntryThumbnail(id, url);
          else rememberNoCover(id);
        }
        if (alive) setThumbnails((prev) => ({ ...prev, ...stable }));
      })
      .catch(() => {
        // Non-fatal — rows fall back to default artwork.
      })
      .finally(markSettled);
    return () => {
      alive = false;
    };
  }, [idsKey]);

  const resolved = React.useCallback(
    (id: string) =>
      id in thumbnails || isKnownWithoutCover(id) || settled.has(id),
    [thumbnails, settled],
  );

  return { thumbnails, resolved };
}
