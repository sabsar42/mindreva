import Link from "next/link";
import { Link2Off } from "lucide-react";
import { cn } from "@mindreva/ui";
import { buttonVariants } from "@mindreva/ui/button-variants";

// One answer for every unusable link (never existed, malformed, turned off, or
// the journal was deleted), so a visitor can't tell which it was.
export default function SharedEntryNotFound() {
  return (
    <main className="min-h-app mx-auto flex flex-col justify-center px-6 py-12 text-center">
      <div className="border-border bg-card shadow-subtle flex flex-col items-center rounded-2xl border px-6 py-10">
        <span className="bg-secondary text-muted-foreground flex size-14 items-center justify-center rounded-[1.25rem]">
          <Link2Off className="size-6" />
        </span>
        <h1 className="text-foreground mt-5 text-xl font-bold tracking-tight">
          This link isn&apos;t available
        </h1>
        <p className="text-muted-foreground mt-1.5 max-w-xs text-sm leading-relaxed">
          It may have been turned off by the person who shared it, or it may
          never have existed.
        </p>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "secondary" }), "mt-5")}
        >
          Go to Mindreva
        </Link>
      </div>
    </main>
  );
}
