"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export interface SwipeableRowAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  /** Muted color pair for the action's revealed background. Callers pass
   * Tailwind classes directly rather than a fixed enum, since the two
   * actions this app needs (trash, archive) call for different mutes. */
  className: string;
}

export interface SwipeableRowProps {
  children: React.ReactNode;
  /** Rendered right-to-left as the row is swiped left; the rightmost action
   * in this array sits closest to the card's trailing edge. */
  actions: SwipeableRowAction[];
  className?: string;
}

const ACTION_WIDTH = 76;
const OPEN_THRESHOLD = 40;

/**
 * Wraps a card (NoteCard) so swiping it left reveals one or more actions
 * underneath — trash/archive on the journal & notes lists, trash/unarchive
 * on Archive, restore on Trash. Built on plain Pointer Events rather than a
 * gesture library, since a single-axis reveal-and-snap is the only gesture
 * this app needs. A tap that doesn't clear a small drag threshold still
 * reaches the card's own onClick (the entry link) — only a real horizontal
 * drag opens the actions.
 */
function SwipeableRow({ children, actions, className }: SwipeableRowProps) {
  const [offset, setOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const startXRef = React.useRef(0);
  const startOffsetRef = React.useRef(0);
  const draggedRef = React.useRef(false);
  const maxOffset = actions.length * ACTION_WIDTH;

  function clamp(value: number): number {
    return Math.min(0, Math.max(-maxOffset, value));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (actions.length === 0) return;
    startXRef.current = e.clientX;
    startOffsetRef.current = offset;
    draggedRef.current = false;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const delta = e.clientX - startXRef.current;
    if (Math.abs(delta) > 4) draggedRef.current = true;
    setOffset(clamp(startOffsetRef.current + delta));
  }

  function handlePointerUp() {
    if (!dragging) return;
    setDragging(false);
    setOffset((current) => (current <= -OPEN_THRESHOLD ? -maxOffset : 0));
  }

  function close() {
    setOffset(0);
  }

  // A drag that moved the row shouldn't also fire the card's own click (the
  // entry link) — swallow that one click in the capture phase.
  function handleClickCapture(e: React.MouseEvent) {
    if (draggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      draggedRef.current = false;
    }
  }

  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)}>
      <div
        className="absolute inset-y-0 right-0 flex"
        style={{ width: maxOffset }}
      >
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => {
              close();
              action.onClick();
            }}
            style={{ width: ACTION_WIDTH }}
            className={cn(
              "flex h-full flex-col items-center justify-center gap-1 text-xs font-medium transition-opacity",
              action.className,
              offset === 0 && "pointer-events-none opacity-0",
            )}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
        className={cn(!dragging && "transition-transform duration-200")}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  );
}

export { SwipeableRow };
