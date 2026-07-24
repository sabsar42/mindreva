"use client";

import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * App-wide toast host. Mount once near the root (apps/web layout). Trigger
 * with the exported `toast(...)` helper from anywhere. Styled to match the
 * design tokens rather than sonner's defaults.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border !border-border !bg-card !text-card-foreground !shadow-elevated !font-sans",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground !rounded-full",
          cancelButton: "!bg-warm-100 !text-foreground !rounded-full",
          error: "!text-destructive",
          success: "!text-success",
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
