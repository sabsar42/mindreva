import * as React from "react";
import { cn } from "../lib/utils";

/** 17px for the same reason as Input: under 16px, iOS zooms on focus. */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "border-input bg-card text-foreground text-body flex min-h-24 w-full scroll-my-24 rounded-xl border px-4 py-3 transition-[border-color,box-shadow] duration-200",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:outline-none focus-visible:ring-[3px]",
        "aria-[invalid=true]:border-destructive",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
