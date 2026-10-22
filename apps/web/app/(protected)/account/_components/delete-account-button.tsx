"use client";

import * as React from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@mindreva/ui";
import { deleteAccountAction } from "../actions";

/**
 * Permanently deletes the account. Quiet on purpose (a text button under
 * Sign out), behind a dialog that says exactly what is erased and asks the
 * user to type "delete", so it can't happen by accident.
 */
export function DeleteAccountButton() {
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const confirmed = typed.trim().toLowerCase() === "delete";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hit-44 text-destructive text-sm font-semibold hover:underline"
      >
        Delete account
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
          if (!next) {
            setTyped("");
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently erases your account and everything in it: every
              entry, recording, transcript, summary, picture, conversation and
              share link. It can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!confirmed || pending) return;
              setError(null);
              startTransition(async () => {
                const result = await deleteAccountAction(typed);
                // On success the action redirects; only a failure returns.
                if (result?.error) setError(result.error);
              });
            }}
          >
            <label
              htmlFor="delete-confirm"
              className="text-muted-foreground text-sm"
            >
              Type <strong className="text-foreground">delete</strong> to
              confirm.
            </label>
            <Input
              id="delete-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="done"
              disabled={pending}
              className="mt-2"
              aria-describedby={error ? "delete-error" : undefined}
            />
            {error && (
              <p
                id="delete-error"
                role="alert"
                className="text-destructive mt-2 text-sm"
              >
                {error}
              </p>
            )}
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={!confirmed}
                loading={pending}
              >
                Delete forever
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
