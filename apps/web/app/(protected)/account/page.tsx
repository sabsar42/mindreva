import Link from "next/link";
import { Archive, Trash2, RefreshCw } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  ProgressBar,
  SettingsRow,
  initialsFromName,
} from "@mindreva/ui";
import { getUser } from "@mindreva/auth/server";
import { getMyProfile, type UseCase } from "@/lib/services/profile.service";
import { countMyEntries } from "@/lib/services/entries.service";
import { PrefetchLink } from "../_components/prefetch-link";
import { SwipeNav } from "../_components/swipe-nav";
import {
  LanguagesCard,
  PreferenceToggles,
  SummaryStyleCard,
} from "./_components/account-settings";
import { SignOutButton } from "./_components/sign-out-button";

export default async function AccountPage() {
  const [user, profile, noteCount] = await Promise.all([
    getUser(),
    getMyProfile(),
    countMyEntries().catch(() => 0),
  ]);

  const email = user?.email ?? "";
  const displayName = profile?.displayName || email.split("@")[0] || "You";
  const languages = profile?.languages
    ? profile.languages.split(",").filter(Boolean)
    : ["en"];
  const summaryStyle = (profile?.summaryStyle as UseCase) ?? "general";

  return (
    <SwipeNav>
      <main className="mx-auto min-h-screen px-5 pb-24 pt-6 md:max-w-2xl md:pb-10">
        <h1 className="text-foreground mb-6 text-xl font-bold tracking-tight">
          Account
        </h1>

        <div className="space-y-4">
          {/* Profile */}
          <Card className="flex items-center gap-4 p-4">
            <Avatar className="size-12">
              <AvatarFallback>{initialsFromName(displayName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate font-semibold">
                {displayName}
              </p>
              <p className="text-muted-foreground truncate text-sm">{email}</p>
            </div>
            <Badge variant="neutral" className="capitalize">
              {profile?.plan ?? "free"}
            </Badge>
          </Card>

          {/* Usage — TODO(Phase 9): real period reset + quota enforcement. The
            counters below are groundwork columns and read 0 until wired up. */}
          <Card className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-foreground text-sm font-semibold">
                This month
              </h2>
              <span className="text-muted-foreground text-sm">Free plan</span>
            </div>
            <ProgressBar
              label="Note taking"
              valueLabel={`${profile?.minutesUsedThisPeriod ?? 0}m of 60m`}
              current={profile?.minutesUsedThisPeriod ?? 0}
              max={60}
            />
            <ProgressBar
              label="Notes"
              valueLabel={`${profile?.notesUsedThisPeriod ?? 0} of 10`}
              current={profile?.notesUsedThisPeriod ?? 0}
              max={10}
            />
          </Card>

          <Card className="divide-border divide-y p-0">
            <SettingsRow
              icon={<RefreshCw />}
              title="Cloud sync"
              description={`${noteCount} ${noteCount === 1 ? "note" : "notes"} kept · Free`}
            />
            <PrefetchLink href="/archive">
              <SettingsRow
                icon={<Archive />}
                title="Archived"
                description="Notes you archive are kept here"
                chevron
              />
            </PrefetchLink>
            <PrefetchLink href="/trash">
              <SettingsRow
                icon={<Trash2 />}
                title="Trash"
                description="Restore or permanently delete notes"
                chevron
              />
            </PrefetchLink>
          </Card>

          <PreferenceToggles />

          <SummaryStyleCard initial={summaryStyle} />

          <LanguagesCard initial={languages} />

          {/* Sign out + legal */}
          <div className="flex flex-col items-center gap-4 py-4">
            <SignOutButton />
            <nav className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
              <Link href="/privacy" className="hover:underline">
                Privacy
              </Link>
              <span aria-hidden>·</span>
              <Link href="/terms" className="hover:underline">
                Terms
              </Link>
              <span aria-hidden>·</span>
              <Link href="/support" className="hover:underline">
                Support
              </Link>
              <span aria-hidden>·</span>
              <Link href="/support" className="hover:underline">
                Delete account
              </Link>
            </nav>
          </div>
        </div>
      </main>
    </SwipeNav>
  );
}
