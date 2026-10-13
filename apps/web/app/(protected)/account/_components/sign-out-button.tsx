"use client";

import * as React from "react";
import { Button } from "@mindreva/ui";
import { signOutAction } from "../actions";

export function SignOutButton() {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      type="button"
      variant="destructive"
      size="default"
      disabled={pending}
      className="w-full"
      onClick={() => startTransition(() => signOutAction())}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
