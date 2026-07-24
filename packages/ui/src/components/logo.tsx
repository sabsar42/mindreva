import * as React from "react";
import { cn } from "../lib/utils";

export type LeafMarkProps = React.ComponentProps<"svg">;

/**
 * The Mindreva leaf mark. Single-color via `currentColor`, so it renders green
 * on light surfaces (text-primary) and white on the mint record button
 * (text-white).
 */
function LeafMark({ className, ...props }: LeafMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={cn("size-6", className)}
      {...props}
    >
      <path d="M6.05 8.05c-2.73 2.73-2.73 7.15-.02 9.88 1.47-3.4 4.09-6.24 7.36-7.93-2.77 2.34-4.71 5.61-5.39 9.32 2.6 1.23 5.8.78 7.95-1.37C19.43 14.47 20 4 20 4S9.53 4.57 6.05 8.05z" />
    </svg>
  );
}

export interface LogoProps extends React.ComponentProps<"div"> {
  /** Show the "Mindreva" serif wordmark next to the mark. */
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { mark: "size-5", text: "text-lg" },
  md: { mark: "size-7", text: "text-2xl" },
  lg: { mark: "size-9", text: "text-4xl" },
} as const;

/** Leaf mark + serif wordmark. Serif is reserved for the logotype only. */
function Logo({
  className,
  showWordmark = true,
  size = "md",
  ...props
}: LogoProps) {
  const s = sizeMap[size];
  return (
    <div
      className={cn("text-primary flex items-center gap-2", className)}
      {...props}
    >
      <LeafMark className={s.mark} />
      {showWordmark && (
        <span
          className={cn(
            "text-foreground font-serif font-bold leading-none tracking-tight",
            s.text,
          )}
        >
          Mindreva
        </span>
      )}
    </div>
  );
}

export { Logo, LeafMark };
