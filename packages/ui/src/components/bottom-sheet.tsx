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
      "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out fixed inset-0 z-50 bg-black/30 backdrop-blur-sm",
      className,
    )}
    {...props}
  />
));
BottomSheetOverlay.displayName = "BottomSheetOverlay";

/**
 * The date-picker modal pattern from the reference: a surface that slides up
 * from the bottom with a drag handle, anchored to the bottom of the viewport.
 */
const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <BottomSheetPortal>
    <BottomSheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // A slide-up drawer anchored to the bottom, at every width: the app is
        // one phone-width column, so sheets stay sheets on desktop too.
        "border-border bg-popover text-popover-foreground shadow-elevated fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-3xl border border-b-0 px-5 pb-8 pt-3",
        "data-[state=open]:animate-slide-up data-[state=closed]:animate-slide-down",
        className,
      )}
      {...props}
    >
      {/* Drag handle */}
      <div
        aria-hidden
        className="bg-border mx-auto mb-4 h-1.5 w-10 rounded-full"
      />
      {children}
    </DialogPrimitive.Content>
  </BottomSheetPortal>
));
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
