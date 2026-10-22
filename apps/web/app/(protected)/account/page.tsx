import Link from "next/link";
import {
  Archive,
  CalendarDays,
  FileText,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Card,
  SettingsRow,
  initialsFromName,
} from "@mindreva/ui";
import { getUser } from "@mindreva/auth/server";
import { getMyProfile, type UseCase } from "@/lib/services/profile.service";
import { countMyEntries } from "@/lib/services/entries.service";
import {
  getMyCalendarStatus,
  isCalendarConfigured,
} from "@/lib/services/calendar.service";
import { PrefetchLink } from "../_components/prefetch-link";
import { PageHeader } from "../_components/page-header";
import { ThemeSwitchRow } from "../_components/theme-switch-row";
import {
  LanguagesCard,
  SummaryStyleCard,
} from "./_components/account-settings";
import { SignOutButton } from "./_components/sign-out-button";
import { DeleteAccountButton } from "./_components/delete-account-button";
import { SupportFooterLink, SupportRow } from "../../_components/support-link";

export default async function AccountPage() {
  const calendarOn = isCalendarConfigured();
  const [user, profile, noteCount, calendar] = await Promise.all([
    getUser(),
    getMyProfile(),
    countMyEntries().catch(() => 0),
    calendarOn ? getMyCalendarStatus().catch(() => null) : null,
  ]);
  const calendarLabel =
    calendar?.status === "connected"
      ? `Connected${calendar.email ? ` as ${calendar.email}` : ""}`
      : calendar?.status === "needs_reconnect"
        ? "Needs reconnecting"
        : "Optional · see your events beside entries";

  const email = user?.email ?? "";
  const displayName = profile?.displayName || email.split("@")[0] || "You";
  const languages = profile?.languages
    ? profile.languages.split(",").filter(Boolean)
    : ["en"];
  const summaryStyle = (profile?.summaryStyle as UseCase) ?? "general";

  return (
    <>
      <main className="min-h-app mx-auto px-4 pb-24 pt-6">
        <PageHeader back={false} title="Account" large />

        <div className="mt-5 space-y-4">
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
          </Card>

          <Card className="grouped-list overflow-hidden p-0">
            <SettingsRow
              icon={<RefreshCw />}
              title="Cloud sync"
              description={`${noteCount} ${noteCount === 1 ? "note" : "notes"} kept`}
            />
            {/* Hidden entirely when this deployment can't connect it. */}
            {calendarOn && (
              <PrefetchLink href="/integrations">
                <SettingsRow
                  icon={<CalendarDays />}
                  title="Google Calendar"
                  description={calendarLabel}
                  chevron
                />
              </PrefetchLink>
            )}
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

          <Card className="grouped-list overflow-hidden p-0">
            <SupportRow />
            <Link href="/privacy" className="hover:bg-secondary block">
              <SettingsRow
                icon={<ShieldCheck />}
                title="Privacy"
                description="What Mindreva keeps and who handles it"
                chevron
              />
            </Link>
            <Link href="/terms" className="hover:bg-secondary block">
              <SettingsRow
                icon={<FileText />}
                title="Terms"
                description="The plain-language rules"
                chevron
              />
            </Link>
          </Card>

          <Card className="p-4">
            <ThemeSwitchRow />
          </Card>

          <SummaryStyleCard initial={summaryStyle} />

          <LanguagesCard initial={languages} />

          {/* Sign out + legal */}
          <div className="flex flex-col items-center gap-4 py-4">
            <SignOutButton />
            <DeleteAccountButton />
            <nav className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
              <Link href="/privacy" className="hit-44 hover:underline">
                Privacy
              </Link>
              <span aria-hidden>·</span>
              <Link href="/terms" className="hit-44 hover:underline">
                Terms
              </Link>
              <SupportFooterLink className="hit-44 before:mr-3 before:content-['·'] hover:underline" />
            </nav>
          </div>
        </div>
      </main>
    </>
  );
}
