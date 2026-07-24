"use client";

import * as React from "react";
import { Button, OptionCard, toast } from "@mindreva/ui";
import type { UseCase } from "@/lib/services/profile.service";
import { USE_CASE_OPTIONS } from "../_data";
import { saveUseCaseAction } from "../actions";

export function UseCaseForm({ initial }: { initial: UseCase }) {
  const [selected, setSelected] = React.useState<UseCase>(initial);
  const [pending, startTransition] = React.useTransition();

  function onStart() {
    startTransition(async () => {
      try {
        await saveUseCaseAction(selected);
      } catch {
        toast.error("Couldn't save that. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-foreground text-2xl font-bold tracking-tight">
        What will you use Mindreva for?
      </h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        This sets how your notes are written. You can change it any time in
        Account.
      </p>

      <div className="mt-6 space-y-2.5" role="radiogroup">
        {USE_CASE_OPTIONS.map((uc) => (
          <OptionCard
            key={uc.value}
            title={uc.title}
            description={uc.description}
            selected={selected === uc.value}
            onSelect={() => setSelected(uc.value)}
          />
        ))}
      </div>

      <div className="mt-auto pt-8">
        <Button className="w-full" onClick={onStart} disabled={pending}>
          {pending ? "Saving…" : "Start using Mindreva"}
        </Button>
      </div>
    </div>
  );
}
