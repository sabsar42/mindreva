import Link from "next/link";
import { LeafMark } from "@mindreva/ui";
import { SupportFooterLink } from "../_components/support-link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="motion-safe:animate-page-in mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-6 py-12">
      {/* Brand tile: the leaf on Mindreva's green, as the app icon would show it. */}
      <div className="flex flex-col items-center gap-4">
        <div className="bg-gradient-primary shadow-elevated flex size-16 items-center justify-center rounded-[1.35rem]">
          <LeafMark className="text-primary-foreground size-8" />
        </div>
      </div>

      {children}

      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-muted-foreground text-balance text-sm leading-relaxed">
          Tap the leaf, Mindreva listens, and the conversation is kept as a
          readable note, in English, বাংলা, اردو, and more.
        </p>
        <nav className="flex items-center gap-4 text-xs">
          <Link
            href="/privacy"
            className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Terms
          </Link>
          <SupportFooterLink className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline" />
        </nav>
        <p className="text-muted-foreground text-xs">
          Recording works best in the Mindreva mobile app. The web can&apos;t
          record with the screen locked.
        </p>
      </div>
    </main>
  );
}
