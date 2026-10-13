"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export interface ExpandablePanelProps extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  open: boolean;
  children: React.ReactNode;
}

/**
 * Animates its content open and closed without measuring heights in JS.
 *
 * It transitions a CSS grid row between `0fr` and `1fr`, which lets the
 * browser animate to the content's natural height (a plain `height: auto`
 * can't be transitioned). Collapsed content is `inert`, so it can't be tabbed
 * to or read by assistive tech while hidden. The global reduced-motion rule
 * in tokens.css turns the transition into an instant toggle.
 */
function ExpandablePanel({
  open,
  className,
  children,
  ...props
}: ExpandablePanelProps) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className,
      )}
      {...props}
    >
      <div className="min-h-0 overflow-hidden" inert={!open}>
        {children}
      </div>
    </div>
  );
}

export { ExpandablePanel };
