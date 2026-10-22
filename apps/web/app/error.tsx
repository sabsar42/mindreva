"use client";

import * as React from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { cn } from "@mindreva/ui";
import { buttonVariants } from "@mindreva/ui/button-variants";

/**
 * The error boundary for every route below the root layout (global-error.tsx
 * only covers the root layout itself). A screen that throws while rendering
 * shows this card instead of a blank page; the app shell around it stays.
 * Reports to Sentry with the digest that matches the server log.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="min-h-app mx-auto flex flex-col justify-center px-6 py-12 text-center">
      <div
        role="alert"
        className="border-border bg-card shadow-subtle flex flex-col items-center rounded-2xl border px-6 py-10"
      >
        <span className="bg-secondary text-muted-foreground flex size-14 items-center justify-center rounded-xl">
          <TriangleAlert className="size-6" aria-hidden />
        </span>
        <h1 className="text-foreground text-title-3 mt-5 font-bold tracking-tight">
          Something went wrong
        </h1>
        <p className="text-muted-foreground text-subhead mt-1.5 max-w-xs leading-relaxed">
          This screen couldn&apos;t load. Your entries are safe; trying again
          usually fixes it.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className={buttonVariants({ variant: "primary" })}
          >
            <RotateCcw aria-hidden />
            Try again
          </button>
          <Link
            href="/journal"
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            Go to your journal
          </Link>
        </div>
        {error.digest && (
          <p className="text-muted-foreground text-caption mt-4">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
