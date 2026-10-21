"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../lib/utils";

const BottomSheet = DialogPrimitive.Root;
const BottomSheetTrigger = DialogPrimitive.Trigger;
const BottomSheetClose = DialogPrimitive.Close;
const BottomSheetPortal = DialogPrimitive.Portal;

const BottomSheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out fixed inset-0 z-50 bg-black/30",
      className,
    )}
    {...props}
  />
));
BottomSheetOverlay.displayName = "BottomSheetOverlay";

// Drag-to-dismiss: past this distance, or flicked faster than this, the
// sheet closes; otherwise it springs back.
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.5; // px per ms

/**
 * Drag handling for the grabber strip. Only the strip at the top drags the
 * sheet, so scrolling inside the sheet and horizontal gestures in its content
 * (the activity graph's weeks) keep working. Pulling up rubber-bands; pulling
 * down follows the finger and decides on release by distance or velocity.
 */
function useSheetDrag(
  contentRef: React.RefObject<HTMLDivElement | null>,
  closeRef: React.RefObject<HTMLButtonElement | null>,
) {
  const drag = React.useRef<{
    id: number;
    startY: number;
    lastY: number;
    lastT: number;
    velocity: number;
  } | null>(null);

  const setOffset = (y: number, animate: boolean) => {
    const el = contentRef.current;
    if (!el) return;
    el.style.transition = animate
      ? "transform var(--duration-base) var(--ease-sheet)"
      : "none";
    el.style.transform = y ? `translateY(${y}px)` : "";
    // The exit animation starts from wherever the finger let go.
    el.style.setProperty("--sheet-drag", `${Math.max(0, y)}px`);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      lastT: e.timeStamp,
      velocity: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.velocity = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const dy = e.clientY - d.startY;
    // Upward: resistance that grows with distance, like iOS.
    setOffset(dy < 0 ? -Math.sqrt(-dy) * 2 : dy, false);
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const dy = e.clientY - d.startY;
    if (
      e.type === "pointerup" &&
      (dy > DISMISS_DISTANCE || (dy > 16 && d.velocity > DISMISS_VELOCITY))
    ) {
      const el = contentRef.current;
      if (el) {
        el.style.transition = "none";
        el.style.transform = "";
      }
      closeRef.current?.click();
    } else {
      setOffset(0, true);
    }
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
  };
}

/**
 * A surface that slides up from the bottom with a grabber, anchored to the
 * bottom of the viewport at every width (the app is one phone-width column,
 * so sheets stay sheets on desktop too). Radix provides the focus trap, scroll
 * lock, Escape and focus restore; the grabber strip adds drag-to-dismiss.
 */
const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  const dragHandlers = useSheetDrag(contentRef, closeRef);
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  return (
    <BottomSheetPortal>
      <BottomSheetOverlay />
      <DialogPrimitive.Content
        ref={setRefs}
        className={cn(
          "border-border bg-popover text-popover-foreground shadow-elevated rounded-t-sheet max-w-120 fixed inset-x-0 bottom-0 z-50 mx-auto w-full overscroll-contain border border-b-0 px-4 pb-[calc(1.5rem+var(--safe-bottom))] pt-2.5",
          "data-[state=open]:animate-slide-up data-[state=closed]:animate-slide-down",
          className,
        )}
        {...props}
      >
        {/* Grabber: a wide, invisible strip around the visible pill so it is
            easy to catch with a thumb. */}
        <div
          aria-hidden
          {...dragHandlers}
          className="-mx-4 -mt-2.5 mb-1 flex h-7 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        >
          <div className="bg-input h-1.25 w-9 rounded-full" />
        </div>
        <DialogPrimitive.Close
          ref={closeRef}
          tabIndex={-1}
          aria-hidden
          className="hidden"
        />
        {children}
      </DialogPrimitive.Content>
    </BottomSheetPortal>
  );
});
BottomSheetContent.displayName = "BottomSheetContent";

const BottomSheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-muted-foreground text-xs font-semibold uppercase tracking-wider",
      className,
    )}
    {...props}
  />
));
BottomSheetTitle.displayName = "BottomSheetTitle";

const BottomSheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
));
BottomSheetDescription.displayName = "BottomSheetDescription";

export {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetPortal,
  BottomSheetOverlay,
  BottomSheetContent,
  BottomSheetTitle,
  BottomSheetDescription,
};
