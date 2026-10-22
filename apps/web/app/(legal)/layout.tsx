import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LeafMark, buttonVariants, cn } from "@mindreva/ui";

/** Public pages (no sign-in needed): Privacy and Terms. */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="motion-safe:animate-page-in min-h-app mx-auto px-4 pb-16 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          aria-label="Back to Mindreva"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "-ml-3 [&_svg]:size-7",
          )}
        >
          <ChevronLeft />
        </Link>
        <span className="text-primary flex items-center gap-2 text-sm font-semibold">
          <LeafMark className="size-5" />
          Mindreva
        </span>
      </div>

      {children}

      <nav className="border-border text-muted-foreground mt-10 flex items-center justify-center gap-4 border-t pt-5 text-xs">
        <Link href="/privacy" className="hit-44 hover:underline">
          Privacy
        </Link>
        <Link href="/terms" className="hit-44 hover:underline">
          Terms
        </Link>
      </nav>
    </main>
  );
}
