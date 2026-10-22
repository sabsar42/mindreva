import * as React from "react";

export const LEGAL_UPDATED = "23 October 2026";

export function LegalTitle({
  title,
  intro,
}: {
  title: string;
  intro: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-foreground text-3xl font-bold tracking-tight">
        {title}
      </h1>
      <p className="text-muted-foreground mt-1.5 text-xs">
        Last updated {LEGAL_UPDATED}
      </p>
      <p className="text-foreground mt-4 text-base leading-relaxed">{intro}</p>
    </header>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <h2 className="text-foreground text-lg font-bold tracking-tight">
        {title}
      </h2>
      <div className="text-muted-foreground [&_strong]:text-foreground mt-2 space-y-3 text-base leading-relaxed [&_strong]:font-semibold">
        {children}
      </div>
    </section>
  );
}

export function Bullets({ children }: { children: React.ReactNode }) {
  return (
    <ul className="marker:text-primary list-disc space-y-1.5 pl-5">
      {children}
    </ul>
  );
}
