import * as React from "react";
import { cn } from "../lib/utils";

export interface NoteCardProps extends React.ComponentProps<"div"> {
  title: string;
  /** e.g. "Wed 22 Jul". Rendered in the mono metadata line. */
  dateLabel: string;
  /** e.g. "37 s" or "3 s". Shown after a dot separator when present. */
  durationLabel?: string;
  snippet?: string;
}

/**
 * Journal / note list item: title, a "date · duration" metadata line, and a
 * truncated snippet. Matches the journal list reference.
 */
const NoteCard = React.forwardRef<HTMLDivElement, NoteCardProps>(
  (
    { className, title, dateLabel, durationLabel, snippet, onClick, ...props },
    ref,
  ) => {
    const interactive = Boolean(onClick);
    return (
      <div
        ref={ref}
        onClick={onClick}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        className={cn(
          "border-border bg-card shadow-subtle rounded-lg border p-4",
          interactive &&
            "hover:shadow-elevated focus-visible:ring-ring cursor-pointer transition-shadow focus-visible:outline-none focus-visible:ring-2",
          className,
        )}
        {...props}
      >
        <h3 className="text-foreground line-clamp-2 text-base font-semibold leading-snug">
          {title}
        </h3>
        <p className="text-muted-foreground mt-1 font-mono text-xs">
          {dateLabel}
          {durationLabel ? (
            <>
              <span className="text-warm-400 px-1.5">·</span>
              {durationLabel}
            </>
          ) : null}
        </p>
        {snippet && (
          <p className="text-muted-foreground mt-2.5 line-clamp-2 text-sm">
            {snippet}
          </p>
        )}
      </div>
    );
  },
);
NoteCard.displayName = "NoteCard";

export { NoteCard };
