import Link from "next/link";
import { Settings } from "lucide-react";
import { Logo } from "@mindreva/ui";
import { getMyProfile } from "@/lib/services/profile.service";
import { countMyEntries } from "@/lib/services/entries.service";
import { RecordEntryButton } from "./record-entry-button";

// Placeholder journal home. The real list (NoteCard + FilterPills + calendar)
// arrives in Phase 5. This exists now so there's a valid authenticated landing
// page after sign-in and onboarding, and a working entry point to recording.
export default async function JournalPage() {
  const [profile, count] = await Promise.all([
    getMyProfile(),
    countMyEntries().catch(() => 0),
  ]);
  const name = profile?.displayName?.split(" ")[0];

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-6">
      <header className="flex items-center justify-between">
        <Logo size="sm" />
        <Link
          href="/account"
          aria-label="Account"
          className="text-muted-foreground hover:bg-warm-100 hover:text-foreground rounded-full p-2 transition-colors"
        >
          <Settings className="size-5" />
        </Link>
      </header>

      <div className="mt-8">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          {name ? `Welcome, ${name}` : "Welcome to Mindreva"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {count === 1 ? "1 note kept." : `${count} notes kept.`}
        </p>
      </div>

      <div className="mt-16 flex flex-col items-center gap-4 text-center">
        <RecordEntryButton />
        <p className="text-muted-foreground max-w-xs text-sm">
          Tap to record. Your notes list arrives in Phase 5.
        </p>
        <Link
          href="/account"
          className="text-primary text-sm font-semibold hover:underline"
        >
          Go to Account
        </Link>
      </div>
    </main>
  );
}
