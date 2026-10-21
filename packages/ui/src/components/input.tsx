import * as React from "react";
import { cn } from "../lib/utils";

/**
 * 17px text at every width: iOS Safari zooms the page into any field whose
 * text is under 16px, and 17px is iOS's own body size. The focus ring is a
 * soft tint halo, never the browser outline.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "border-input bg-card text-foreground text-body flex h-12 w-full scroll-my-24 rounded-full border px-5 py-2 transition-[border-color,box-shadow] duration-200",
          "placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:outline-none focus-visible:ring-[3px]",
          "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
