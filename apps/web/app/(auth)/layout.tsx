import Link from "next/link";
import { Logo } from "@mindreva/ui";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo size="lg" />
        <p className="text-muted-foreground text-balance text-sm leading-relaxed">
          Tap the leaf, Mindreva listens, and the conversation is kept as a
          readable note, in English, বাংলা, اردু, and more.
        </p>
      </div>

      {children}

      <div className="flex flex-col items-center gap-3 text-center">
        <nav className="flex items-center gap-4 text-xs">
          <Link
            href="/privacy"
            className="text-muted-foreground hover:underline"
          >
            Privacy
          </Link>
          <Link href="/terms" className="text-muted-foreground hover:underline">
            Terms
          </Link>
          <Link
            href="/support"
            className="text-muted-foreground hover:underline"
          >
            Support
          </Link>
        </nav>
        <p className="text-muted-foreground text-xs">
          Recording works best in the Mindreva mobile app. The web can&apos;t
          record with the screen locked.
        </p>
      </div>
    </main>
  );
}
