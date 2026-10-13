"use client";

import * as React from "react";

/** What the avatar menu and greeting need, resolved once by the layout. */
export interface AccountSummary {
  name: string;
  email: string;
  plan: string;
  minutesUsed: number;
}

/**
 * The layout hands down an UNAWAITED promise, not the data. Awaiting it in the
 * layout would hold every page back until the profile query finished; passing
 * the promise lets pages render in parallel and only the small avatar/greeting
 * pieces wait, each inside its own Suspense boundary.
 */
const AccountContext = React.createContext<Promise<AccountSummary | null>>(
  Promise.resolve(null),
);

export function AccountProvider({
  account,
  children,
}: {
  account: Promise<AccountSummary | null>;
  children: React.ReactNode;
}) {
  return <AccountContext value={account}>{children}</AccountContext>;
}

/** Suspends until the account resolves: call inside a <Suspense> boundary. */
export function useAccount(): AccountSummary | null {
  return React.use(React.useContext(AccountContext));
}
