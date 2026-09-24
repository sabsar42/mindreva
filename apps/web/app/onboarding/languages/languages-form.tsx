"use client";

import * as React from "react";
import { Button, OptionCard, toast } from "@mindreva/ui";
import { LANGUAGE_OPTIONS } from "../_data";
import { saveLanguagesAction, skipOnboardingAction } from "../actions";

export function LanguagesForm({ initial }: { initial: string[] }) {
  const [selected, setSelected] = React.useState<string[]>(
    initial.length ? initial : ["en"],
  );
  const [pending, startTransition] = React.useTransition();

  function toggle(code: string) {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function onContinue() {
    startTransition(async () => {
      try {
        await saveLanguagesAction(selected);
      } catch {
        toast.error("Couldn't save your languages. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-foreground text-2xl font-bold tracking-tight">
        Which languages do you speak?
      </h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Pick every language that appears in your recordings. Mindreva listens
        for these, and mixing them in one recording is fine.
      </p>

      <div className="mt-6 space-y-2.5" role="group">
        {LANGUAGE_OPTIONS.map((lang) => (
          <OptionCard
            key={lang.code}
            title={lang.label}
            selected={selected.includes(lang.code)}
            onSelect={() => toggle(lang.code)}
          />
        ))}
      </div>

      <div className="mt-auto space-y-3 pt-8">
        <Button className="w-full" onClick={onContinue} disabled={pending}>
          {pending ? "Saving…" : "Continue"}
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => startTransition(() => skipOnboardingAction())}
          disabled={pending}
        >
          Skip for now
        </Button>
      </div>
    </div>
  );
}
