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
const DRAG_THRESHOLD_PX = 6;
// A flick faster than this (px/ms) opens or closes regardless of distance.
const FLICK_VELOCITY = 0.4;

/** Past an edge the row still follows the finger, but with resistance. */
function rubberBand(value: number, min: number, max: number): number {
  if (value > max) return max + Math.sqrt(value - max) * 2;
  if (value < min) return min - Math.sqrt(min - value) * 2;
  return value;
}

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
  const startYRef = React.useRef(0);
  const startOffsetRef = React.useRef(0);
  const pointerDownRef = React.useRef(false);
  const draggedRef = React.useRef(false);
  const velocityRef = React.useRef({ x: 0, t: 0, v: 0 });
  const maxOffset = actions.length * ACTION_WIDTH;

  // Pointer-down itself stays free of any state update or DOM API call — a
  // plain tap (by far the most common interaction) should cost nothing here
  // beyond recording the start position in refs. Only once real horizontal
  // movement crosses DRAG_THRESHOLD_PX do we commit to "dragging": that's
  // the one point we call setPointerCapture and trigger the re-render that
  // shows the row actually moving.
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (actions.length === 0) return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startOffsetRef.current = offset;
    pointerDownRef.current = true;
    draggedRef.current = false;
    velocityRef.current = { x: e.clientX, t: e.timeStamp, v: 0 };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointerDownRef.current) return;
    const delta = e.clientX - startXRef.current;

    if (!draggedRef.current) {
      const dy = Math.abs(e.clientY - startYRef.current);
      // Mostly vertical: it's a scroll, so let the list have it.
      if (dy > DRAG_THRESHOLD_PX && dy > Math.abs(delta)) {
        pointerDownRef.current = false;
        return;
      }
      if (Math.abs(delta) <= DRAG_THRESHOLD_PX) return;
      draggedRef.current = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    const last = velocityRef.current;
    const dt = Math.max(1, e.timeStamp - last.t);
    velocityRef.current = {
      x: e.clientX,
      t: e.timeStamp,
      v: (e.clientX - last.x) / dt,
    };
    setOffset(rubberBand(startOffsetRef.current + delta, -maxOffset, 0));
  }

  function handlePointerUp() {
    pointerDownRef.current = false;
    if (!dragging) return;
    setDragging(false);
    const v = velocityRef.current.v;
    setOffset((current) => {
      if (v < -FLICK_VELOCITY) return -maxOffset; // flicked left: open
      if (v > FLICK_VELOCITY) return 0; // flicked right: close
      return current <= -OPEN_THRESHOLD ? -maxOffset : 0;
    });
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
    <div
      data-swipeable-row=""
      // Same radius as the card inside, so the revealed actions match it.
      className={cn("relative overflow-hidden rounded-2xl", className)}
    >
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
        // With a mouse, pressing and moving on the card's link (or its cover
        // image) starts the browser's own drag-and-drop, which swallows the
        // pointer after the first move. The row is the drag here.
        onDragStart={(e) => e.preventDefault()}
        // pan-y: vertical scrolling stays native; horizontal moves come to
        // us instead of being claimed (and cancelled) by the browser.
        className={cn(
          "touch-pan-y",
          !dragging &&
            "duration-(--duration-base) ease-sheet transition-transform",
        )}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  );
}

export { SwipeableRow };
