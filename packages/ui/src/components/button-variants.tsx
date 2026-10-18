import { cva } from "class-variance-authority";

/**
 * The one button scale for the whole app. Every tappable control that is a
 * button (not a card, tab, switch or list row) is one of these, so the same
 * role looks the same on every page and in both themes: all colors come from
 * theme tokens, and every button is a capsule with the same press and focus.
 *
 * Hierarchy, strongest to quietest (use one `primary` per surface):
 *
 *   primary      the main action: Save, Continue, Retry           green fill
 *   ink          a single top action on auth-style screens        dark fill
 *   destructive  stops or deletes: Stop, Delete                   red fill
 *   secondary    an alternative next to a primary                 white + hairline
 *   outline      a quieter alternative on a busy surface          hairline only
 *   glass        a control floating over a photo                  frosted
 *   ghost        navigation: Back                                 ink icon/text
 *   quiet        toolbar icon actions: Search, Archive, Close     grey icon
 *
 * Sizes: text buttons are sm 36 / default 44 / lg 56. Icon-only buttons are
 * icon-sm 32 / icon 40 / icon-lg 44 and size their icon to match (16 / 20 /
 * 24), so an icon never needs its own size class.
 */

// Separate from button.tsx (a client component) so server components, e.g. a
// Link styled as a button, can call it without crossing the client boundary.
export const buttonVariants = cva(
  "press inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-primary text-primary-foreground shadow-button hover:brightness-105 active:bg-gradient-primary-pressed",
        // Dark ink pill: the Apple "Continue with…" treatment. Reads as the
        // strongest button on a screen, so it is for the single top action.
        ink: "bg-gradient-ink text-white shadow-button hover:brightness-110",
        destructive:
          "bg-gradient-danger text-white shadow-button hover:brightness-105",
        secondary:
          "bg-card text-foreground border border-border shadow-subtle hover:bg-secondary",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-secondary",
        glass:
          "bg-glass text-foreground border border-border shadow-subtle hover:bg-card",
        ghost: "text-foreground hover:bg-secondary",
        quiet: "text-muted-foreground hover:bg-secondary hover:text-foreground",
      },
      size: {
        sm: "h-9 px-4 text-xs [&_svg]:size-4",
        default: "h-11 px-6 text-sm [&_svg]:size-4",
        lg: "h-14 px-8 text-base [&_svg]:size-5",
        "icon-sm": "size-8 text-xs [&_svg]:size-4",
        icon: "size-10 text-sm [&_svg]:size-5",
        "icon-lg": "size-11 text-sm [&_svg]:size-6",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);
