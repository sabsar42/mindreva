import Link from "next/link";
import { LeafMark } from "@mindreva/ui";

export default function Home() {
  return (
    <main className="min-h-app flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-8">
        {/* Wordmark */}
        <span className="text-primary font-serif text-2xl font-bold tracking-tight">
          Mindreva
        </span>

        {/* Brand illustration */}
        <div className="bg-secondary flex size-48 items-center justify-center rounded-full">
          <LeafMark className="text-primary size-28" />
        </div>

        {/* Value proposition */}
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-foreground text-balance font-serif text-3xl font-bold leading-tight tracking-tight">
            Say it once, keep it forever
          </h1>
          <p className="text-muted-foreground text-balance text-sm leading-relaxed">
            Talk it out and Mindreva turns it into a readable journal entry, in
            English, বাংলা, اردو, and more.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex w-full flex-col gap-3">
          <Link
            href="/sign-up"
            className="bg-primary text-primary-foreground flex w-full items-center justify-center rounded-full px-6 py-4 text-base font-semibold transition-transform active:scale-95"
          >
            Get started
          </Link>
          <Link
            href="/sign-in"
            className="text-muted-foreground hover:text-foreground py-2 text-sm font-medium transition-colors"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </main>
  );
}
