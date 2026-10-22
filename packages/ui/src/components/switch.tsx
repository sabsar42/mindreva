"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../lib/utils";
import { haptic } from "../lib/haptics";

/**
 * iOS proportions: a 51 x 31 track with a 27px thumb that springs across.
 * The track fades its color while the thumb moves (both transform/color
 * only, so it stays on the compositor).
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, onCheckedChange, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    onCheckedChange={(checked) => {
      haptic("tap");
      onCheckedChange?.(checked);
    }}
    className={cn(
      "peer inline-flex h-[1.9375rem] w-[3.1875rem] shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200",
      "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "spring pointer-events-none block size-[1.6875rem] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.16)] ring-0 transition-transform",
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
