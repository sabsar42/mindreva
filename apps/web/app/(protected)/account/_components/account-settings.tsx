"use client";

import * as React from "react";
import { Card, OptionCard, SettingsRow, Switch, toast } from "@mindreva/ui";
import { Feather } from "lucide-react";
import type { UseCase } from "@/lib/services/profile.service";
import { LANGUAGE_OPTIONS, USE_CASE_OPTIONS } from "@/app/onboarding/_data";
import { updateLanguagesAction, updateSummaryStyleAction } from "../actions";

export function SummaryStyleCard({ initial }: { initial: UseCase }) {
  const [style, setStyle] = React.useState<UseCase>(initial);
  const [pending, startTransition] = React.useTransition();

  function choose(next: UseCase) {
    const prev = style;
    setStyle(next);
    startTransition(async () => {
      try {
        await updateSummaryStyleAction(next);
      } catch {
        setStyle(prev);
        toast.error("Couldn't update summary style.");
      }
    });
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start gap-3">
        <Feather className="text-muted-foreground mt-0.5 size-5 shrink-0" />
        <div>
          <h2 className="text-foreground text-sm font-semibold">
            Summary style
          </h2>
          <p className="text-muted-foreground text-sm">
            How Mindreva writes new notes, applies to your next recording
          </p>
        </div>
      </div>
      <div className="space-y-2.5" role="radiogroup" aria-busy={pending}>
        {USE_CASE_OPTIONS.map((uc) => (
          <OptionCard
            key={uc.value}
            title={uc.title}
            description={uc.description}
            selected={style === uc.value}
            onSelect={() => choose(uc.value)}
          />
        ))}
      </div>
    </Card>
  );
}

export function LanguagesCard({ initial }: { initial: string[] }) {
  const [selected, setSelected] = React.useState<string[]>(
    initial.length ? initial : ["en"],
  );
  const [pending, startTransition] = React.useTransition();

  function toggle(code: string) {
    const next = selected.includes(code)
      ? selected.filter((c) => c !== code)
      : [...selected, code];
    setSelected(next);
    startTransition(async () => {
      try {
        await updateLanguagesAction(next);
      } catch {
        toast.error("Couldn't update languages.");
      }
    });
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start gap-3">
        <Feather className="text-muted-foreground mt-0.5 size-5 shrink-0" />
        <div>
          <h2 className="text-foreground text-sm font-semibold">
            Languages you speak
          </h2>
          <p className="text-muted-foreground text-sm">
            Steers transcription and live captions. Pick every language that
            appears in your recordings
          </p>
        </div>
      </div>
      <div className="space-y-2.5" role="group" aria-busy={pending}>
        {LANGUAGE_OPTIONS.map((lang) => (
          <OptionCard
            key={lang.code}
            title={lang.label}
            selected={selected.includes(lang.code)}
            onSelect={() => toggle(lang.code)}
          />
        ))}
      </div>
    </Card>
  );
}

/**
 * Preference toggles from the reference. Local-only for now — there are no
 * columns behind these yet; persisting them is future work (a settings table),
 * so they reset on reload by design.
 */
export function PreferenceToggles() {
  return (
    <Card className="divide-border divide-y p-0">
      <SettingsRow
        title="Offline notes on this browser"
        description="Off by default. On trusted devices, notes are encrypted in this browser and erased when you sign out."
        trailing={<Switch aria-label="Offline notes" />}
      />
      <SettingsRow
        title="Email notifications"
        description="Get an email when a note finishes processing or fails."
        trailing={<Switch aria-label="Email notifications" />}
      />
    </Card>
  );
}
