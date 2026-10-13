import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const iconTileVariants = cva(
  "flex shrink-0 items-center justify-center [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        // Soft mint wash: the default "this is a feature" tile.
        mint: "bg-accent/60 text-primary",
        // Quiet neutral: secondary or settings rows.
        neutral: "bg-secondary text-muted-foreground",
        // Solid brand green: the one tile that should draw the eye.
        solid: "bg-gradient-primary text-primary-foreground shadow-subtle",
        danger: "bg-destructive/10 text-destructive",
      },
      size: {
        sm: "size-9 rounded-xl [&_svg]:size-4",
        md: "size-11 rounded-2xl [&_svg]:size-5",
        lg: "size-14 rounded-[1.25rem] [&_svg]:size-6",
      },
    },
    defaultVariants: { tone: "mint", size: "md" },
  },
);

export interface IconTileProps
  extends React.ComponentProps<"div">, VariantProps<typeof iconTileVariants> {}

/**
 * A rounded-square tile holding a single icon. Used for empty states,
 * integration cards and settings rows so icons share one visual rhythm.
 */
function IconTile({ className, tone, size, ...props }: IconTileProps) {
  return (
    <div
      aria-hidden
      className={cn(iconTileVariants({ tone, size }), className)}
      {...props}
    />
  );
}

export { IconTile, iconTileVariants };
