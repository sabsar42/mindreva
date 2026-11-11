"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import { PrefetchLink } from "../../_components/prefetch-link";

export interface CitationInfo {
  date: string | null;
  title: string | null;
}

/** Chips shown before "+N" — enough to read at a glance on a phone. */
const VISIBLE = 3;
const TITLE_LENGTH = 26;

function shortDate(dateKey: string | null | undefined): string {
  if (!dateKey) return "Undated";
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function shortTitle(title: string | null | undefined): string | null {
  const t = title?.trim();
  if (!t) return null;
  return t.length > TITLE_LENGTH
    ? `${t.slice(0, TITLE_LENGTH - 1).trimEnd()}…`
    : t;
}

/**
 * One chip per cited entry (the server already collapses chunks to entries
 * and orders them by relevance). Scrolls sideways when there are many; past
 * three, a "+N" chip reveals the rest. Each chip opens its entry.
 */
export function CitationChips({
  entryIds,
  info,
}: {
  entryIds: string[];
  info: Record<string, CitationInfo>;
}) {
  const [expanded, setExpanded] = React.useState(false);
  if (entryIds.length === 0) return null;
  const shown = expanded ? entryIds : entryIds.slice(0, VISIBLE);
  const hidden = entryIds.length - shown.length;

  return (
    // Full width, bleeding to the screen edges, so a long row scrolls
    // instead of being clipped at the bubble's width.
    <div className="mt-1.5 w-full self-stretch">
      <p className="text-muted-foreground text-caption mb-1 px-1">
        Based on {entryIds.length === 1 ? "this entry" : "these entries"}
      </p>
      <div className="-mx-4 flex snap-x scroll-px-4 gap-1.5 overflow-x-auto px-4 py-1.5 [scrollbar-width:none]">
        {shown.map((id) => {
          const title = shortTitle(info[id]?.title);
          return (
            <PrefetchLink
              key={id}
              href={`/entries/${id}`}
              className="border-separator bg-card text-foreground text-footnote focus-visible:ring-ring press hit-44 inline-flex h-8 shrink-0 snap-start items-center gap-1 rounded-full border-[0.5px] px-3 font-medium focus-visible:outline-none focus-visible:ring-2"
            >
              <FileText className="text-primary size-3.5" aria-hidden />
              <span>{shortDate(info[id]?.date)}</span>
              {title && (
                <span className="text-muted-foreground font-normal">
                  · {title}
                </span>
              )}
            </PrefetchLink>
          );
        })}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="border-separator text-primary text-footnote focus-visible:ring-ring press hit-44 inline-flex h-8 shrink-0 items-center rounded-full border-[0.5px] px-3 font-semibold focus-visible:outline-none focus-visible:ring-2"
            aria-label={`Show ${hidden} more ${hidden === 1 ? "entry" : "entries"}`}
          >
            +{hidden}
          </button>
        )}
      </div>
    </div>
  );
}
