"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@mindreva/ui";
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

  const backBtnClass =
    "text-foreground hover:bg-secondary -ml-2 rounded-full p-2 transition-colors";

  const backEl =
    typeof back === "string" ? (
      <PrefetchLink href={back} aria-label="Back" className={backBtnClass}>
        <ArrowLeft className="size-5" />
      </PrefetchLink>
    ) : (
      <button
        type="button"
        aria-label="Back"
        onClick={typeof back === "function" ? back : () => router.back()}
        className={backBtnClass}
      >
        <ArrowLeft className="size-5" />
      </button>
    );

  return (
    <header className={cn("flex items-center gap-3", className)}>
      {backEl}
      {title && <h1 className="text-xl font-bold tracking-tight">{title}</h1>}
      {children && (
        <div className="ml-auto flex items-center gap-1">{children}</div>
      )}
    </header>
  );
}
