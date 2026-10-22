import Link from "next/link";
import { Compass } from "lucide-react";
import { cn } from "@mindreva/ui";
import { buttonVariants } from "@mindreva/ui/button-variants";

export const metadata = { title: "Not found" };

/** Any URL that matches nothing. Same card language as /s/'s not-found. */
export default function NotFound() {
  return (
    <main className="min-h-app mx-auto flex flex-col justify-center px-6 py-12 text-center">
      <div className="border-border bg-card shadow-subtle flex flex-col items-center rounded-3xl border px-6 py-10">
        <span className="bg-secondary text-muted-foreground flex size-14 items-center justify-center rounded-xl">
          <Compass className="size-6" aria-hidden />
        </span>
        <h1 className="text-foreground text-title-3 mt-5 font-bold tracking-tight">
          This page doesn&apos;t exist
        </h1>
        <p className="text-muted-foreground text-subhead mt-1.5 max-w-xs leading-relaxed">
          The link may be old or mistyped. Your entries are safe.
        </p>
        <Link
          href="/journal"
          className={cn(buttonVariants({ variant: "primary" }), "mt-5")}
        >
          Go to your journal
        </Link>
      </div>
    </main>
  );
}
