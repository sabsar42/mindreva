"use client";

import * as React from "react";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { buttonVariants, cn } from "@mindreva/ui";
import { PrefetchLink } from "./prefetch-link";

interface PageHeaderProps {
  /** The screen's title. With `large`, a Large Title in the content that
   * collapses into the bar's inline title on scroll; otherwise inline only. */
  title?: string;
  /** href string → PrefetchLink; callback → button; `false` → no back button
   * (a tab root); omit → router.back(). */
  back?: string | (() => void) | false;
  /** iOS large title (34pt) under the bar, collapsing on scroll. */
  large?: boolean;
  /** Extra classes on the <header> element (e.g. "mb-6"). */
  className?: string;
  /** Right-side slot for action buttons. */
  children?: React.ReactNode;
}

/** Scroll distance after which the large title has passed under the bar. */
const LARGE_TITLE_COLLAPSE_PX = 44;

/**
 * An iOS navigation bar. It stays put while the page scrolls under it:
 * transparent at rest, translucent material with a hairline once content
 * passes beneath. With `large`, the screen's Large Title sits in the content
 * and the bar's centred inline title fades in as it scrolls away. Only two
 * booleans are state, so scrolling re-renders the header a couple of times at
 * most, not every frame.
 */
export function PageHeader({
  title,
  back,
  large = false,
  className,
  children,
}: PageHeaderProps) {
  const router = useRouter();
  const [scrolled, setScrolled] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(!large);

  React.useEffect(() => {
    const update = () => {
      setScrolled(window.scrollY > 4);
      if (large) setCollapsed(window.scrollY > LARGE_TITLE_COLLAPSE_PX);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [large]);

  const backBtnClass = cn(
    buttonVariants({ variant: "ghost", size: "icon" }),
    // iOS back: a large chevron, optically aligned to the screen edge.
    "-ml-3 [&_svg]:size-7",
  );

  const backEl =
    back === false ? null : typeof back === "string" ? (
      <PrefetchLink href={back} aria-label="Back" className={backBtnClass}>
        <ChevronLeft />
      </PrefetchLink>
    ) : (
      <button
        type="button"
        aria-label="Back"
        onClick={typeof back === "function" ? back : () => router.back()}
        className={backBtnClass}
      >
        <ChevronLeft />
      </button>
    );

  return (
    <>
      <header
        data-scrolled={scrolled || undefined}
        className={cn(
          // Negative margins cancel the padding, so at rest the layout is the
          // same as an unstuck header; the top padding also covers the status
          // bar area in standalone mode.
          "sticky top-0 z-30 -mx-4 -mb-2 -mt-[calc(var(--safe-top)+0.5rem)] grid min-h-[calc(44px+var(--safe-top)+1rem)] grid-cols-[1fr_auto_1fr] items-center gap-2 border-b-[0.5px] border-transparent px-4 pb-2 pt-[calc(var(--safe-top)+0.5rem)] transition-[background-color,border-color] duration-200",
          "data-[scrolled]:bg-material data-[scrolled]:border-separator",
          className,
        )}
      >
        <div className="flex min-w-0 items-center">{backEl}</div>
        {title ? (
          <p
            aria-hidden={large || undefined}
            className={cn(
              "text-headline truncate text-center font-semibold transition-opacity duration-200",
              collapsed ? "opacity-100" : "opacity-0",
            )}
          >
            {title}
          </p>
        ) : (
          <span />
        )}
        <div className="flex min-w-0 items-center justify-end gap-1">
          {children}
        </div>
      </header>
      {large && title && (
        <h1 className="text-large-title text-foreground mt-1">{title}</h1>
      )}
      {!large && title && <h1 className="sr-only">{title}</h1>}
    </>
  );
}
