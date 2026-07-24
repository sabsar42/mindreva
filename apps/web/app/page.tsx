import Link from "next/link";
import { Button, Logo } from "@mindreva/ui";

// Placeholder landing page (Phase 2). Intentionally minimal — to be redesigned
// once the real app is live. See docs/roadmap.md, Phase 2.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <Logo size="lg" />

      <p className="text-muted-foreground text-balance text-lg leading-relaxed">
        Tap the leaf, Mindreva listens, and the conversation is kept as a
        readable note — in English, বাংলা, اردو, and more.
      </p>

      <div className="flex w-full flex-col gap-3">
        <Button asChild size="lg" className="w-full">
          <Link href="/sign-up">Get started</Link>
        </Button>
        <Button asChild variant="ghost" size="lg" className="w-full">
          <Link href="/sign-in">I already have an account</Link>
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Recording works best in the Mindreva mobile app — the web can&apos;t
        record with the screen locked.
      </p>
    </main>
  );
}
