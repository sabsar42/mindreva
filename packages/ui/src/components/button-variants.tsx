import { cva } from "class-variance-authority";

// Separate from button.tsx (a client component) so server components, e.g. a
// Link styled as a button, can call it without crossing the client boundary.
export const buttonVariants = cva(
  "press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-primary text-primary-foreground shadow-subtle hover:brightness-105 active:bg-gradient-primary-pressed",
        // Dark ink pill: the Apple "Continue with…" treatment. Reads as the
        // strongest button on a screen, so it is for the single top action.
        ink: "bg-gradient-ink text-white shadow-subtle hover:brightness-110",
        secondary:
          "bg-card text-foreground border border-border shadow-subtle hover:bg-secondary",
        ghost: "text-foreground hover:bg-secondary",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-secondary",
        destructive:
          "bg-gradient-danger text-destructive-foreground shadow-subtle hover:brightness-105",
      },
      size: {
        sm: "h-9 px-4 text-xs",
        default: "h-11 px-6",
        lg: "h-14 px-8 text-base",
        icon: "size-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);
