import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LeafMark } from "@mindreva/ui";

// First-run landing screen. Organic blob-and-mascot layout (see the design
// discussion in docs/CHANGELOG.md's 2026-08-04 entry) rebuilt with
// Mindreva's own brand mark and dark-mint/warm palette instead of borrowing
// another app's colors or characters.
export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden px-6 py-12 text-center">
      <div
        aria-hidden
        className="bg-mint-100 absolute -left-24 -top-24 size-72 rounded-full blur-2xl"
      />
      <div
        aria-hidden
        className="bg-mint-100 absolute -bottom-32 -right-20 size-80 rounded-full blur-2xl"
      />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-10">
        <span className="text-foreground font-serif text-2xl font-bold tracking-tight">
          Mindreva
        </span>

        <div className="bg-mint-50 flex size-56 items-center justify-center rounded-full">
          <LeafMark className="text-primary size-32" />
        </div>

        <div className="flex flex-col items-center gap-3">
          <h1 className="text-foreground text-balance font-serif text-3xl font-bold leading-tight tracking-tight">
            Say it once, keep it forever
          </h1>
          <p className="text-muted-foreground text-balance leading-relaxed">
            Talk it out and Mindreva turns it into a readable journal entry — in
            English, বাংলা, اردو, and more.
          </p>
        </div>
      </div>

      <div className="relative flex w-full max-w-md flex-col gap-3">
        <Link
          href="/sign-up"
          className="bg-primary text-primary-foreground shadow-elevated flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-base font-semibold transition-transform active:scale-95"
        >
          Continue
          <ArrowRight className="size-5" />
        </Link>
        <Link
          href="/sign-in"
          className="text-foreground py-2 text-sm font-medium"
        >
          I already have an account
        </Link>
      </div>
    </main>
  );
}
