import * as React from "react";
import { cn } from "../lib/utils";

export interface NoteCardProps extends React.ComponentProps<"div"> {
  title: string;
  /** Formatted date+time string, e.g. "Sep 23, 9:55 PM". */
  dateLabel?: string;
  /** e.g. "37 s" or "3 min". Shown in small bold uppercase below date. */
  durationLabel?: string;
  snippet?: string;
  /** First photo (by position) on the entry, if any. Omit rather than pass
   * a broken/empty src — the trailing thumbnail simply doesn't render. */
  thumbnailUrl?: string;
}

const NoteCard = React.forwardRef<HTMLDivElement, NoteCardProps>(
  (
    {
      className,
      title,
      dateLabel,
      durationLabel,
      snippet,
      thumbnailUrl,
      onClick,
      ...props
    },
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
          "bg-card border-border flex items-center gap-3 rounded-xl border p-5",
          interactive &&
            "hover:bg-accent focus-visible:ring-ring cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2",
          className,
        )}
        {...props}
      >
        <div className="min-w-0 flex-1">
          {/* Metadata row: timestamp + duration inline */}
          {(dateLabel || durationLabel) && (
            <div className="flex items-center gap-1.5">
              {dateLabel && (
                <p className="text-muted-foreground truncate text-xs">
                  {dateLabel}
                </p>
              )}
              {durationLabel && (
                <span className="border-border text-muted-foreground inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  {durationLabel}
                </span>
              )}
            </div>
          )}
          <h3 className="text-foreground mt-2 line-clamp-1 text-lg font-bold leading-snug">
            {title}
          </h3>
          {snippet && (
            <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm leading-relaxed">
              {snippet}
            </p>
          )}
        </div>

        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt=""
            className="size-20 shrink-0 rounded-lg object-cover"
          />
        )}
      </div>
    );
  },
);
NoteCard.displayName = "NoteCard";

export { NoteCard };
