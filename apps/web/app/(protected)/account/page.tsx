import Link from "next/link";
import {
  Archive,
  FileText,
  Plug,
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
  PreferenceToggles,
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
  const integrationsLabel =
    calendar?.status === "connected"
      ? `Google Calendar connected${calendar.email ? ` as ${calendar.email}` : ""}`
      : calendar?.status === "needs_reconnect"
        ? "Google Calendar needs reconnecting"
        : calendarOn
          ? "Connect Google Calendar and more"
          : "Connect apps";

  const email = user?.email ?? "";
  const displayName = profile?.displayName || email.split("@")[0] || "You";
  const languages = profile?.languages
    ? profile.languages.split(",").filter(Boolean)
    : ["en"];
  const summaryStyle = (profile?.summaryStyle as UseCase) ?? "general";

  return (
    <>
      <main className="min-h-app mx-auto px-5 pb-24 pt-6">
        <PageHeader back="/journal" title="Account" className="mb-4" />

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
          </Card>

          <Card className="grouped-list overflow-hidden p-0">
            <SettingsRow
              icon={<RefreshCw />}
              title="Cloud sync"
              description={`${noteCount} ${noteCount === 1 ? "note" : "notes"} kept`}
            />
            <PrefetchLink href="/integrations">
              <SettingsRow
                icon={<Plug />}
                title="Integrations"
                description={integrationsLabel}
                chevron
              />
            </PrefetchLink>
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

          <PreferenceToggles />

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
