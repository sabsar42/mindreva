"use client";

import * as React from "react";
import { signOutAction } from "../actions";

export function SignOutButton() {
  const [pending, startTransition] = React.useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => signOutAction())}
      className="text-destructive text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
