"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@mindreva/ui";
import { RiverExplorer } from "./river-explorer";
import type { RiverData } from "@/lib/services/mindmap.service";

/**
 * The full river, as a popup over Re-live Me. It is a modal, not a
 * navigation, so closing it returns to exactly where you were: the page
 * underneath keeps its scroll position and state, and focus goes back to the
 * button that opened it (which is why that button is passed in as `trigger`
 * and rendered as the dialog's own trigger, not wired up separately).
 */
export function RiverModal({
  trigger,
  data,
}: {
  /** The Expand button. Must be a single element that accepts a ref and onClick. */
  trigger: React.ReactElement;
  data: RiverData;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[88dvh] w-[calc(100%-1rem)] max-w-2xl gap-0 overflow-hidden rounded-3xl p-0">
        <div className="px-6 pb-4 pt-6">
          <DialogTitle className="text-xl font-bold tracking-tight">
            Your river of memories
          </DialogTitle>
          <DialogDescription className="text-muted-foreground mt-1 pr-6 text-sm leading-relaxed">
            Recurring themes from what you&apos;ve written, flowing across time.
            Tap a path, a dot, or a crossing point to see the entries behind it.
          </DialogDescription>
        </div>
        <div className="border-border min-h-0 overflow-y-auto border-t">
          <RiverExplorer data={data} compact={false} showControls />
        </div>
      </DialogContent>
    </Dialog>
  );
}
