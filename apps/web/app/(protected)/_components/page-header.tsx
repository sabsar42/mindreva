"use client";

import * as React from "react";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { buttonVariants, cn } from "@mindreva/ui";
import { PrefetchLink } from "./prefetch-link";

interface PageHeaderProps {
  /** h1 title rendered beside the back button. Omit when the title lives outside the header. */
  title?: string;
  /** href string → PrefetchLink; callback → button; omit → router.back(). */
  back?: string | (() => void);
  /** Extra classes on the <header> element (e.g. "mb-6"). */
  className?: string;
  /** Right-side slot for action buttons. */
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  back,
  className,
  children,
}: PageHeaderProps) {
  const router = useRouter();

  const backBtnClass = cn(
    buttonVariants({ variant: "ghost", size: "icon" }),
    // iOS back: a large chevron, optically aligned to the screen edge.
    "-ml-3 [&_svg]:size-7",
  );

  const backEl =
    typeof back === "string" ? (
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

  // A nav bar: it stays put while the page scrolls under it (the back button
  // is always reachable), transparent at rest, translucent material with a
  // hairline once content passes beneath. Only the boolean is state, so
  // scrolling re-renders the header twice at most, not on every frame.
  const [scrolled, setScrolled] = React.useState(false);
  React.useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header
      data-scrolled={scrolled || undefined}
      className={cn(
        // Negative margins cancel the padding, so at rest the layout is the
        // same as an unstuck header; the top padding also covers the status
        // bar area in standalone mode.
        "sticky top-0 z-30 -mx-5 -mb-2 -mt-[calc(var(--safe-top)+0.5rem)] flex items-center gap-3 border-b-[0.5px] border-transparent px-5 pb-2 pt-[calc(var(--safe-top)+0.5rem)] transition-[background-color,border-color] duration-200",
        "data-[scrolled]:bg-material data-[scrolled]:border-separator",
        className,
      )}
    >
      {backEl}
      {title && <h1 className="text-title-3 font-bold">{title}</h1>}
      {children && (
        <div className="ml-auto flex items-center gap-1">{children}</div>
      )}
    </header>
  );
}
