"use client";

import * as React from "react";
import { ChevronRight, Plug, Settings2 } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
  BottomSheetTrigger,
  Button,
  IconTile,
  cn,
  initialsFromName,
} from "@mindreva/ui";
import { signOutAction } from "../account/actions";
import { useAccount } from "./account-context";
import { PrefetchLink } from "./prefetch-link";
import { ThemeSwitchRow } from "./theme-switch-row";

/**
 * The avatar button and the sheet it opens: who you are,
 * and the controls that are about you rather than about your entries.
 * The full settings (summary style, languages, archive, trash) stay on
 * /account; this is the quick version.
 */
function AccountMenuInner({ className }: { className?: string }) {
  const account = useAccount();
  const [open, setOpen] = React.useState(false);
  const [signingOut, startSignOut] = React.useTransition();

  if (!account) return null;

  const close = () => setOpen(false);

  return (
    <BottomSheet open={open} onOpenChange={setOpen}>
      <BottomSheetTrigger asChild>
        {/* Same 40px tap box as the tab icons beside it. The avatar plus its
            ring and offset (32 + 2·4) fills that box exactly, and ml-2.5
            makes the visible gap to the neighbouring icon match the 24px
            between the 20px icon glyphs. */}
        <button
          type="button"
          aria-label="Open account menu"
          className={cn(
            "press focus-visible:ring-ring ml-2.5 flex size-10 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2",
            className,
          )}
        >
          <Avatar className="ring-border size-8 ring-2 ring-offset-2 ring-offset-transparent">
            <AvatarFallback className="text-xs">
              {initialsFromName(account.name)}
            </AvatarFallback>
          </Avatar>
        </button>
      </BottomSheetTrigger>

      <BottomSheetContent>
        <BottomSheetTitle className="sr-only">Account</BottomSheetTitle>
        <BottomSheetDescription className="sr-only">
          Your profile and quick settings.
        </BottomSheetDescription>

        <div className="flex items-center gap-3">
          <Avatar className="size-14">
            <AvatarFallback className="text-lg">
              {initialsFromName(account.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-lg font-bold leading-tight">
              {account.name}
            </p>
            <p className="text-muted-foreground truncate text-sm">
              {account.email}
            </p>
          </div>
        </div>

        <div className="border-border bg-card shadow-subtle mt-3 divide-y overflow-hidden rounded-2xl border">
          <PrefetchLink
            href="/integrations"
            onClick={close}
            className="hover:bg-secondary flex items-center gap-3 p-3.5 transition-colors"
          >
            <IconTile size="sm">
              <Plug />
            </IconTile>
            <span className="min-w-0 flex-1">
              <span className="text-foreground block text-sm font-semibold">
                Integrations
              </span>
              <span className="text-muted-foreground block text-xs">
                Connect Google Calendar and more
              </span>
            </span>
            <ChevronRight className="text-muted-foreground size-4" />
          </PrefetchLink>
          <PrefetchLink
            href="/account"
            onClick={close}
            className="hover:bg-secondary flex items-center gap-3 p-3.5 transition-colors"
          >
            <IconTile size="sm" tone="neutral">
              <Settings2 />
            </IconTile>
            <span className="min-w-0 flex-1">
              <span className="text-foreground block text-sm font-semibold">
                Account &amp; settings
              </span>
              <span className="text-muted-foreground block text-xs">
                Summary style, languages, archive, trash
              </span>
            </span>
            <ChevronRight className="text-muted-foreground size-4" />
          </PrefetchLink>
        </div>

        <div className="mt-3">
          <ThemeSwitchRow />
        </div>

        <Button
          variant="destructive"
          size="lg"
          className="mt-5 w-full"
          disabled={signingOut}
          onClick={() => startSignOut(() => signOutAction())}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </BottomSheetContent>
    </BottomSheet>
  );
}

/** Same footprint as the loaded avatar, so nothing shifts when it resolves. */
function AvatarPlaceholder({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "ml-2.5 flex size-10 items-center justify-center",
        className,
      )}
    >
      <span className="bg-muted block size-8 animate-pulse rounded-full" />
    </span>
  );
}

export function AccountMenu({ className }: { className?: string }) {
  return (
    <React.Suspense fallback={<AvatarPlaceholder className={className} />}>
      <AccountMenuInner className={className} />
    </React.Suspense>
  );
}
