"use client";

import * as React from "react";
import { ChevronDown, Droplets, Maximize2 } from "lucide-react";
import { ExpandablePanel, IconTile, buttonVariants, cn } from "@mindreva/ui";
import { RiverExplorer } from "./river-explorer";
import { RiverModal } from "./river-modal";
import type { RiverData } from "@/lib/services/mindmap.service";

/**
 * The river as a compact card at the top of Re-live Me — an invitation to
 * explore, not a dense analytics dashboard. Default is a small, always-visible
 * preview. The Expand button opens it large in a popup (RiverModal) without
 * leaving the page. `collapsible` adds a toggle to fold the preview away
 * entirely: used on the conversation screen, where the chat owns the space.
 * That choice is remembered per `storageKey` on this device.
 */
export function RiverPanel({
  data,
  collapsible = false,
  storageKey,
  defaultOpen = true,
  className,
}: {
  data: RiverData;
  collapsible?: boolean;
  /** Required when `collapsible`: where the open/closed choice is remembered. */
  storageKey?: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(collapsible ? defaultOpen : true);
  const [everOpened, setEverOpened] = React.useState(
    collapsible ? defaultOpen : true,
  );
  // True until the saved preference has been applied, so a returning user who
  // collapsed the panel doesn't watch it animate shut on every page load.
  const [instant, setInstant] = React.useState(true);
  const panelId = React.useId();

  React.useEffect(() => {
    if (!collapsible || !storageKey) {
      setInstant(false);
      return;
    }
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "open" || saved === "closed") {
        const next = saved === "open";
        setOpen(next);
        if (next) setEverOpened(true);
      }
    } catch {
      // Storage blocked: fall back to the default.
    }
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setInstant(false)),
    );
    return () => cancelAnimationFrame(id);
  }, [collapsible, storageKey]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) setEverOpened(true);
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, next ? "open" : "closed");
    } catch {
      // Non-fatal: the choice just isn't remembered.
    }
  }

  const themeCount = data.themes.length;
  const summary =
    themeCount === 0
      ? "Themes appear as you write"
      : `${themeCount} ${themeCount === 1 ? "theme" : "themes"} flowing · tap to explore`;

  const heading = (
    <>
      <IconTile>
        <Droplets />
      </IconTile>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block text-sm font-semibold">
          Your river of memories
        </span>
        <span className="text-muted-foreground block truncate text-xs">
          {summary}
        </span>
      </span>
    </>
  );

  return (
    <section
      aria-label="River of memories"
      className={cn(
        "border-border bg-card shadow-subtle overflow-hidden rounded-3xl border",
        className,
      )}
    >
      <div className="flex items-center gap-1 p-2 pr-3">
        {collapsible ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={panelId}
            className="press hover:bg-secondary focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-2 text-left focus-visible:outline-none focus-visible:ring-2"
          >
            {heading}
            <ChevronDown
              aria-hidden
              className={cn(
                "text-muted-foreground size-5 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                open && "rotate-180",
              )}
            />
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3 p-2">
            {heading}
          </div>
        )}
        <RiverModal
          data={data}
          trigger={
            <button
              type="button"
              aria-label="Expand river of memories"
              className={buttonVariants({ variant: "quiet", size: "icon-sm" })}
            >
              <Maximize2 />
            </button>
          }
        />
      </div>

      {collapsible ? (
        <ExpandablePanel
          id={panelId}
          open={open}
          className={cn(instant && "transition-none!")}
        >
          <div className="border-border border-t">
            {everOpened && <RiverExplorer data={data} compact />}
          </div>
        </ExpandablePanel>
      ) : (
        <div className="border-border border-t">
          <RiverExplorer data={data} compact />
        </div>
      )}
    </section>
  );
}
