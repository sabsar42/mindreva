import { getUser } from "@mindreva/auth/server";
import { getMyProfile } from "@/lib/services/profile.service";
import { AppShell } from "./_components/app-shell";
import type { AccountSummary } from "./_components/account-context";

async function loadAccount(): Promise<AccountSummary | null> {
  try {
    // getUser() and getMyProfile() are request-cached, so the pages below
    // reuse these results instead of querying again.
    const [user, profile] = await Promise.all([getUser(), getMyProfile()]);
    if (!user) return null;
    const email = user.email ?? "";
    return {
      name: profile?.displayName || email.split("@")[0] || "You",
      email,
      plan: profile?.plan ?? "free",
      minutesUsed: profile?.minutesUsedThisPeriod ?? 0,
    };
  } catch {
    // The avatar menu is a convenience; never let it take a page down.
    return null;
  }
}

// Deliberately NOT async: the account promise is started here but not awaited,
// so the page below renders in parallel with the profile query.
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell account={loadAccount()}>{children}</AppShell>;
}
