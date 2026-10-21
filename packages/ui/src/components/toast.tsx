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
      // Below the notch / Dynamic Island once the page is edge-to-edge. Sonner
      // already announces toasts politely and dismisses them with a swipe.
      offset={{ top: "calc(var(--safe-top) + 12px)" }}
      mobileOffset={{
        top: "calc(var(--safe-top) + 8px)",
        left: "16px",
        right: "16px",
      }}
      duration={3200}
      // Sonner v2 reads these CSS vars for all toast types — setting them
      // here is the only reliable way to override its built-in shadow, color,
      // and radius, since inline styles beat className !important on the host
      // element. classNames still handle typography and button shapes.
      style={
        {
          "--normal-bg": "var(--color-card)",
          "--normal-text": "var(--color-card-foreground)",
          "--normal-border": "var(--color-border)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          // Default text/border colors come from globals.css; setting them here
          // too would compete with the error/success colors below.
          toast: "!border !bg-card !font-sans",
          title: "!font-medium",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground !rounded-full",
          cancelButton:
            "!bg-secondary !text-secondary-foreground !rounded-full",
          error: "!text-destructive !border-destructive/30",
          success: "!text-success",
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
