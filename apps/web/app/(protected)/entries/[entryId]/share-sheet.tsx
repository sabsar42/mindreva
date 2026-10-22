"use client";

import * as React from "react";
import { Check, Copy, Globe, Link2, Loader2, Lock, X } from "lucide-react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetTitle,
  Badge,
  Button,
  IconTile,
  Input,
  Skeleton,
  buttonVariants,
  cn,
  toast,
} from "@mindreva/ui";

type Visibility = "public" | "private";

interface ShareState {
  enabled: boolean;
  visibility: Visibility | null;
  token: string | null;
  recipients: string[];
}

const OPTIONS: {
  value: Visibility;
  title: string;
  description: string;
  Icon: typeof Lock;
}[] = [
  {
    value: "private",
    title: "Private",
    description:
      "Only people you add. They sign in with their email to read it.",
    Icon: Lock,
  },
  {
    value: "public",
    title: "Public",
    description: "Anyone who has the link can read it. No sign-in needed.",
    Icon: Globe,
  },
];

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API unavailable (insecure context / permissions): fall back to
    // selecting a temporary field.
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(field);
    return ok;
  }
}

/**
 * Sharing for one journal. Everything shown here comes from the server and
 * every change goes through it: the link, who may open it and whether it is on
 * are enforced by the API, never by this component.
 */
export function ShareSheet({
  entryId,
  open,
  onOpenChange,
  onStatusChange,
}: {
  entryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lets the header show whether this journal is currently shared. */
  onStatusChange?: (shared: boolean) => void;
}) {
  const [share, setShare] = React.useState<ShareState | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const apply = React.useCallback(
    (next: ShareState) => {
      setShare(next);
      onStatusChange?.(next.enabled);
    },
    [onStatusChange],
  );

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadError(false);
    void (async () => {
      try {
        const res = await fetch(`/api/entries/${entryId}/share`);
        if (!res.ok) throw new Error("load failed");
        const data = (await res.json()) as ShareState;
        if (!cancelled) apply(data);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, entryId, apply]);

  async function choose(visibility: Visibility) {
    if (busy || (share?.enabled && share.visibility === visibility)) return;
    setBusy(visibility);
    try {
      const res = await fetch(`/api/entries/${entryId}/share`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      });
      if (!res.ok) throw new Error("update failed");
      apply((await res.json()) as ShareState);
    } catch {
      toast.error("Couldn't update sharing. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function stopSharing() {
    setBusy("revoke");
    try {
      const res = await fetch(`/api/entries/${entryId}/share`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("revoke failed");
      apply((await res.json()) as ShareState);
      toast.success("Sharing is off. The old link no longer works.");
    } catch {
      toast.error("Couldn't turn sharing off. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function addRecipient(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy("recipient");
    setEmailError(null);
    try {
      const res = await fetch(`/api/entries/${entryId}/share/recipients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 400) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setEmailError(data?.error ?? "Enter a valid email address.");
        return;
      }
      if (!res.ok) throw new Error("add failed");
      apply((await res.json()) as ShareState);
      setEmail("");
    } catch {
      toast.error("Couldn't add that person. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function removeRecipient(target: string) {
    setBusy(`remove:${target}`);
    try {
      const res = await fetch(`/api/entries/${entryId}/share/recipients`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      if (!res.ok) throw new Error("remove failed");
      apply((await res.json()) as ShareState);
    } catch {
      toast.error("Couldn't remove that person. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const link = share?.token && origin ? `${origin}/s/${share.token}` : "";

  async function copyLink() {
    if (!link) return;
    const ok = await copyText(link);
    if (ok) {
      setCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  }

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent className="max-h-[88dvh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <IconTile>
            <Link2 />
          </IconTile>
          <div className="min-w-0 flex-1">
            <BottomSheetTitle>Share this journal</BottomSheetTitle>
            <BottomSheetDescription className="text-muted-foreground text-sm">
              People you share with can read it, never change it.
            </BottomSheetDescription>
          </div>
          {share && (
            <Badge variant={share.enabled ? "success" : "neutral"}>
              {share.enabled
                ? share.visibility === "public"
                  ? "Shared · Public"
                  : "Shared · Private"
                : "Not shared"}
            </Badge>
          )}
        </div>

        {loadError ? (
          <p
            className="text-muted-foreground py-8 text-center text-sm"
            role="alert"
          >
            Couldn&apos;t load sharing settings. Close this and try again.
          </p>
        ) : !share ? (
          <div className="mt-5 space-y-3" aria-busy>
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : (
          <>
            <div
              role="radiogroup"
              aria-label="Who can open the link"
              className="mt-5 space-y-2.5"
            >
              {OPTIONS.map(({ value, title, description, Icon }) => {
                const selected = share.enabled && share.visibility === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={busy !== null}
                    onClick={() => void choose(value)}
                    className={cn(
                      "press focus-visible:ring-ring flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60",
                      selected
                        ? "border-primary bg-accent/35 shadow-subtle"
                        : "border-border bg-card hover:bg-secondary",
                    )}
                  >
                    <IconTile size="sm" tone={selected ? "solid" : "neutral"}>
                      <Icon />
                    </IconTile>
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground block text-sm font-semibold">
                        {title}
                      </span>
                      <span className="text-muted-foreground block text-xs leading-snug">
                        {description}
                      </span>
                    </span>
                    {busy === value ? (
                      <Loader2 className="text-muted-foreground size-4 animate-spin" />
                    ) : (
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                          selected
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/40",
                        )}
                      >
                        {selected && (
                          <span className="size-1.5 rounded-full bg-white" />
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {share.enabled && (
              <div className="motion-safe:animate-page-in mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="share-link"
                    className="text-muted-foreground text-xs font-semibold uppercase tracking-widest"
                  >
                    Link
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      id="share-link"
                      readOnly
                      value={link}
                      onFocus={(e) => e.currentTarget.select()}
                      className="text-callout h-11 flex-1"
                    />
                    <Button
                      type="button"
                      onClick={() => void copyLink()}
                      disabled={!link}
                      aria-label="Copy link"
                      className="shrink-0"
                    >
                      {copied ? <Check /> : <Copy />}
                      {copied ? "Copied" : "Copy link"}
                    </Button>
                  </div>
                </div>

                {share.visibility === "private" && (
                  <div>
                    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
                      People with access
                    </p>
                    {share.recipients.length === 0 ? (
                      <p className="text-muted-foreground mt-2 text-sm">
                        No one yet. Add an email below. Until you do, only you
                        can open this link.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {share.recipients.map((address) => (
                          <li
                            key={address}
                            className="border-border bg-card flex items-center gap-2 rounded-full border py-1 pl-4 pr-1.5"
                          >
                            <span className="text-foreground min-w-0 flex-1 truncate text-sm">
                              {address}
                            </span>
                            <button
                              type="button"
                              onClick={() => void removeRecipient(address)}
                              disabled={busy !== null}
                              aria-label={`Remove ${address}`}
                              className={buttonVariants({
                                variant: "quiet",
                                size: "icon-sm",
                              })}
                            >
                              <X />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <form
                      onSubmit={(e) => void addRecipient(e)}
                      className="mt-3 flex items-start gap-2"
                    >
                      <div className="flex-1">
                        <Input
                          type="email"
                          inputMode="email"
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          enterKeyHint="done"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setEmailError(null);
                          }}
                          placeholder="name@example.com"
                          aria-label="Add a person by email"
                          aria-invalid={emailError ? true : undefined}
                          className="h-11 text-sm"
                        />
                        {emailError && (
                          <p
                            className="text-destructive mt-1.5 pl-4 text-xs"
                            role="alert"
                          >
                            {emailError}
                          </p>
                        )}
                      </div>
                      <Button
                        type="submit"
                        variant="secondary"
                        disabled={!email.trim() || busy !== null}
                      >
                        {busy === "recipient" ? (
                          <Loader2 className="animate-spin" />
                        ) : null}
                        Add
                      </Button>
                    </form>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive w-full"
                  onClick={() => void stopSharing()}
                  disabled={busy !== null}
                >
                  {busy === "revoke" ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  Stop sharing
                </Button>
                <p className="text-muted-foreground text-center text-xs leading-snug">
                  Stopping turns the link off for good. If you share again,
                  you&apos;ll get a new link.
                </p>
              </div>
            )}
          </>
        )}
      </BottomSheetContent>
    </BottomSheet>
  );
}
