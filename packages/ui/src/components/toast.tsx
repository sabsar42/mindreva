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
      // Sonner v2 reads these CSS vars for all toast types — setting them
      // here is the only reliable way to override its built-in shadow, color,
      // and radius, since inline styles beat className !important on the host
      // element. classNames still handle typography and button shapes.
      style={
        {
          "--normal-bg": "var(--color-card)",
          "--normal-text": "var(--color-card-foreground)",
          "--normal-border": "var(--color-border)",
          "--border-radius": "0.75rem",
          "--box-shadow": "none",
          "--toast-shadow": "none",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "!border !border-border !bg-card !text-card-foreground !font-sans !shadow-none",
          title: "!font-medium",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground !rounded-full",
          cancelButton:
            "!bg-secondary !text-secondary-foreground !rounded-full",
          error: "!border-destructive/30",
          success: "!border-border",
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
