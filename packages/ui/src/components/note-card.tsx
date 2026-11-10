"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { LeafMark } from "./logo";

export interface NoteCardProps extends React.ComponentProps<"div"> {
  title: string;
  /** Formatted date+time string, e.g. "Sep 23, 9:55 PM". */
  dateLabel?: string;
  /** e.g. "37 s" or "3 min". Shown in small bold uppercase below date. */
  durationLabel?: string;
  /** First photo (by position) on the entry, if any. Omit rather than pass
   * a broken/empty src — the trailing thumbnail simply doesn't render. */
  thumbnailUrl?: string;
  /** Cover not known yet: reserve the slot with a neutral tile rather than
   * showing artwork that's about to be replaced. */
  thumbnailPending?: boolean;
  /** The memory is still being made. The card takes the green treatment and
   * shows what has really happened so far: lines of text that are still to
   * come as shimmering bars, and the transcript as it arrives. */
  forming?: {
    stage: "transcribing" | "writing" | "finishing";
    /** The transcript, once it exists. Revealed progressively. */
    text?: string;
  };
  /** Processing didn't finish. Neutral, never green, with a short reason. */
  failed?: string;
  /** Just finished forming: the green treatment drains out over ~1s. */
  settling?: boolean;
}

/** Reveals `text` a few characters at a time, so a transcript that arrives in
 * one piece still reads as being written. Shows everything at once for
 * viewers who prefer reduced motion. */
function useRevealedText(text: string | undefined, enabled: boolean): string {
  const full = text ?? "";
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!enabled || !full) {
      setCount(0);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(full.length);
      return;
    }
    setCount(0);
    const id = setInterval(() => {
      setCount((c) => {
        if (c >= full.length) {
          clearInterval(id);
          return c;
        }
        return Math.min(full.length, c + 3);
      });
    }, 30);
    return () => clearInterval(id);
  }, [full, enabled]);

  return enabled ? full.slice(0, count) : full;
}

const STAGE_LABEL = {
  transcribing: "Transcribing",
  writing: "Shaping your memory",
  finishing: "Finishing up",
} as const;

const STAGE_PROGRESS = {
  transcribing: 38,
  writing: 78,
  finishing: 100,
} as const;

const NoteCard = React.forwardRef<HTMLDivElement, NoteCardProps>(
  (
    {
      className,
      title,
      dateLabel,
      durationLabel,
      thumbnailUrl,
      thumbnailPending,
      forming,
      failed,
      settling,
      onClick,
      style,
      ...props
    },
    ref,
  ) => {
    const interactive = Boolean(onClick);
    const revealed = useRevealedText(forming?.text, Boolean(forming));

    return (
      <div
        ref={ref}
        onClick={onClick}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-busy={forming ? true : undefined}
        style={
          forming
            ? {
                // Emerge once, then breathe a green glow while it develops.
                animation:
                  "form-in 460ms cubic-bezier(0.34, 1.3, 0.64, 1) backwards, form-glow 2.4s ease-in-out 460ms infinite",
                ...style,
              }
            : style
        }
        className={cn(
          // Every ready card is exactly the same size (the cover is 84px, the
          // padding 12px); a card still forming may be taller until it settles.
          // iOS-style surface: a hairline edge and a soft layered shadow (flat
          // in dark mode), slightly translucent so the app's background wash
          // shows through faintly.
          "bg-card/92 border-card-edge shadow-card group/card rounded-card relative flex items-center gap-3.5 overflow-hidden border-[0.5px] p-3",
          forming ? "min-h-[108px]" : "h-[108px]",
          // Ready cards respond to a hover or a tap: a hair of lift, a press
          // that sinks a little, and the thumbnail leaning in. Cards still
          // forming don't (there is nothing to open yet).
          !forming &&
            "transition-transform duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.985]",
          interactive &&
            "focus-visible:ring-ring cursor-pointer focus-visible:outline-none focus-visible:ring-2",
          forming && "border-primary/60 from-primary/10 to-card bg-linear-to-b",
          settling && "animate-settle",
          className,
        )}
        {...props}
      >
        <div className="min-w-0 flex-1">
          {/* Metadata row: timestamp + duration inline */}
          {(dateLabel || durationLabel) && (
            <div className="flex items-center gap-1.5">
              {dateLabel && (
                <p className="text-muted-foreground truncate text-[0.6875rem] font-medium uppercase tracking-[0.06em]">
                  {dateLabel}
                </p>
              )}
              {durationLabel && (
                <span className="bg-secondary text-muted-foreground inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.06em]">
                  {durationLabel}
                </span>
              )}
            </div>
          )}

          {forming ? (
            <>
              <div
                aria-hidden
                className="forming-line animate-shimmer mt-3 h-5 w-3/5 rounded-md"
              />
              {revealed ? (
                <p className="text-muted-foreground mt-2.5 line-clamp-2 text-sm leading-relaxed">
                  {revealed}
                  <span
                    aria-hidden
                    className="bg-primary ml-0.5 inline-block h-3.5 w-0.5 translate-y-0.5 animate-pulse rounded-full"
                  />
                </p>
              ) : (
                <div aria-hidden className="mt-2.5 space-y-2">
                  <div className="forming-line animate-shimmer h-3.5 w-full rounded-md" />
                  <div className="forming-line animate-shimmer h-3.5 w-4/5 rounded-md [animation-delay:-0.6s]" />
                </div>
              )}
              <p
                role="status"
                className="text-primary mt-3 flex items-center gap-1.5 text-xs font-semibold"
              >
                <span className="relative flex size-2 shrink-0">
                  <span className="bg-primary/40 absolute inset-0 animate-ping rounded-full" />
                  <span className="bg-primary relative size-2 rounded-full" />
                </span>
                {STAGE_LABEL[forming.stage]}…
              </p>
            </>
          ) : (
            <>
              <h3 className="text-foreground mt-1 line-clamp-2 text-[1.1875rem] font-semibold leading-snug tracking-[-0.02em]">
                {title}
              </h3>
              {failed && (
                <p
                  role="status"
                  className="text-destructive mt-2 text-xs font-medium"
                >
                  {failed}
                </p>
              )}
            </>
          )}
        </div>

        {forming ? (
          // A seed in the thumbnail slot: the logo, breathing, until the
          // memory has a real cover.
          <div
            aria-hidden
            className="bg-gradient-primary flex size-[5.25rem] shrink-0 items-center justify-center rounded-md"
          >
            <LeafMark className="text-primary-foreground size-9 animate-pulse" />
          </div>
        ) : thumbnailPending ? (
          <div
            aria-hidden
            className="bg-secondary size-[5.25rem] shrink-0 rounded-md"
          />
        ) : (
          thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt=""
              width={84}
              height={84}
              loading="lazy"
              decoding="async"
              className="bg-secondary ring-card-edge size-[5.25rem] shrink-0 rounded-md object-cover ring-1 ring-inset transition-transform duration-300 group-hover/card:scale-105"
            />
          )
        )}

        {forming && (
          <div
            aria-hidden
            className="bg-primary/10 absolute inset-x-0 bottom-0 h-1"
          >
            <div
              className="bg-primary h-full rounded-r-full transition-[width] duration-[1400ms] ease-out"
              style={{ width: `${STAGE_PROGRESS[forming.stage]}%` }}
            />
          </div>
        )}
      </div>
    );
  },
);
NoteCard.displayName = "NoteCard";

export { NoteCard };
