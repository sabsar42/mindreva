import * as React from "react";
import { cn } from "../lib/utils";

export interface NoteCardProps extends React.ComponentProps<"div"> {
  title: string;
  /** Short weekday abbreviation, e.g. "THU" — stacked above dayOfMonth in the
   * leading date badge. */
  weekdayLabel: string;
  /** Day-of-month number, e.g. "24" — the large numeral in the date badge. */
  dayOfMonth: string;
  /** e.g. "37 s" or "3 s". Shown after a dot separator when present. */
  durationLabel?: string;
  snippet?: string;
  /** First photo (by position) on the entry, if any. Omit rather than pass
   * a broken/empty src — the trailing thumbnail simply doesn't render. */
  thumbnailUrl?: string;
}

/**
 * Journal / note list item: a leading round date badge (weekday over
 * day-of-month, floating outside the card fill, not boxed), bold title,
 * ellipsized snippet, and a trailing square cover-photo thumbnail — every
 * card the same fixed height whether or not it has a photo. Matches
 * new-journal-list.png's structure and sizing exactly (our dark mint tokens,
 * not their gray). Card fill matches the page background, not a tinted
 * surface — a mint border gives it definition instead.
 */
const NoteCard = React.forwardRef<HTMLDivElement, NoteCardProps>(
  (
    {
      className,
      title,
      weekdayLabel,
      dayOfMonth,
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
          "bg-background shadow-subtle border-mint-100 flex h-28 items-center gap-3 rounded-lg border p-4",
          interactive &&
            "hover:shadow-elevated hover:border-mint-200 focus-visible:ring-ring cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2",
          className,
        )}
        {...props}
      >
        <div className="bg-accent text-accent-foreground flex size-12 shrink-0 flex-col items-center justify-center rounded-full">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase leading-none tracking-wide">
            {weekdayLabel || "—"}
          </span>
          <span className="mt-1 text-base font-bold leading-none">
            {dayOfMonth || "–"}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-foreground line-clamp-1 text-base font-semibold leading-snug">
            {title}
          </h3>
          {snippet && (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
              {snippet}
            </p>
          )}
          {durationLabel && (
            <p className="text-muted-foreground mt-1 font-mono text-xs">
              {durationLabel}
            </p>
          )}
        </div>

        {thumbnailUrl && (
          // Plain <img>, deliberately: a short-lived per-request signed URL
          // for a private Storage object, same reasoning as PhotoUploader.
          <img
            src={thumbnailUrl}
            alt=""
            className="size-16 shrink-0 rounded-md object-cover"
          />
        )}
      </div>
    );
  },
);
NoteCard.displayName = "NoteCard";

export { NoteCard };
