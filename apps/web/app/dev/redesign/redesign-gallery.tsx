"use client";

import * as React from "react";
import { FileText, Search } from "lucide-react";
import { Button, IconTile, NoteCard } from "@mindreva/ui";
import { EmptyState } from "../../(protected)/_components/empty-state";
import { ThemeSwitchRow } from "../../(protected)/_components/theme-switch-row";
import { IntegrationCard } from "../../(protected)/integrations/integration-card";
import { RiverPanel } from "../../(protected)/river/river-panel";
import type { IntegrationView } from "@/lib/integrations/types";
import type { RiverData } from "@/lib/services/mindmap.service";

function sampleMilestone(
  overrides: Partial<RiverData["themes"][number]["milestones"][number]> & {
    entryId: string;
    month: string;
  },
) {
  return {
    clusterId: `${overrides.entryId}-cluster`,
    entryDate: `${overrides.month}-10`,
    title: "Sample entry",
    snippet: "A short excerpt from the entry, in the user's own words.",
    isFirstAppearance: false,
    isReturnAfterGap: false,
    previousMonth: null,
    ...overrides,
  };
}

const RIVER: RiverData = {
  themes: [
    {
      id: "work",
      label: "Work",
      colorIndex: 0,
      firstSeenAt: "2026-01-01T00:00:00Z",
      months: [
        { month: "2026-01", clusterId: "work-1", entryCount: 4 },
        { month: "2026-02", clusterId: "work-2", entryCount: 6 },
        { month: "2026-03", clusterId: "work-3", entryCount: 3 },
      ],
      milestones: [
        sampleMilestone({
          entryId: "work-e1",
          month: "2026-01",
          isFirstAppearance: true,
        }),
        sampleMilestone({ entryId: "work-e2", month: "2026-02" }),
        sampleMilestone({ entryId: "work-e3", month: "2026-03" }),
      ],
    },
    {
      id: "home",
      label: "Home",
      colorIndex: 2,
      firstSeenAt: "2026-01-01T00:00:00Z",
      months: [
        { month: "2026-01", clusterId: "home-1", entryCount: 2 },
        { month: "2026-06", clusterId: "home-6", entryCount: 3 },
      ],
      milestones: [
        sampleMilestone({
          entryId: "home-e1",
          month: "2026-01",
          isFirstAppearance: true,
        }),
        sampleMilestone({
          entryId: "home-e2",
          month: "2026-06",
          isReturnAfterGap: true,
          previousMonth: "2026-01",
        }),
      ],
    },
    {
      id: "gratitude",
      label: "Gratitude",
      colorIndex: 4,
      firstSeenAt: "2026-06-01T00:00:00Z",
      months: [{ month: "2026-06", clusterId: "gratitude-6", entryCount: 2 }],
      milestones: [
        sampleMilestone({
          entryId: "home-e2",
          month: "2026-06",
          isFirstAppearance: true,
        }),
      ],
    },
  ],
  intersections: [
    {
      month: "2026-06",
      themeA: "Gratitude",
      themeB: "Home",
      sharedEntryIds: ["home-e2"],
    },
  ],
  insight: {
    kind: "returned_after_gap",
    themeId: "home",
    label: "Home",
    returnedMonth: "2026-06",
    previousMonth: "2026-01",
    gapMonths: 5,
    entryId: "home-e2",
    entryDate: "2026-06-10",
  },
  monthsCovered: ["2026-01", "2026-02", "2026-03", "2026-06"],
  computedAt: "2026-06-10T00:00:00Z",
};

const EMPTY_RIVER: RiverData = {
  themes: [],
  intersections: [],
  insight: null,
  monthsCovered: [],
  computedAt: null,
};

const GCAL: IntegrationView = {
  id: "google-calendar",
  name: "Google Calendar",
  description:
    "Add dates and deadlines from your entries to your Google Calendar.",
  available: false,
  connection: { status: "disconnected", accountLabel: null, connectedAt: null },
};

const noop = () => {};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-widest">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function RedesignGallery() {
  return (
    <div className="mx-auto max-w-md space-y-10 px-5 py-10">
      <header className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Redesign</h1>
        <ThemeSwitchRow />
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="ink">Ink</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button>
        </div>
        <Button size="lg" className="w-full">
          Large primary
        </Button>
      </Section>

      <Section title="Icon tiles">
        <div className="flex gap-3">
          <IconTile>
            <FileText />
          </IconTile>
          <IconTile tone="neutral">
            <FileText />
          </IconTile>
          <IconTile tone="solid">
            <FileText />
          </IconTile>
          <IconTile tone="danger">
            <FileText />
          </IconTile>
        </div>
      </Section>

      <Section title="River panel (open, then collapsed, then empty)">
        <RiverPanel data={RIVER} storageKey="mindreva:dev-open" defaultOpen />
        <RiverPanel
          data={RIVER}
          storageKey="mindreva:dev-closed"
          defaultOpen={false}
        />
        <RiverPanel
          data={EMPTY_RIVER}
          storageKey="mindreva:dev-empty"
          defaultOpen
        />
      </Section>

      <Section title="Integration card: every state">
        <IntegrationCard
          integration={GCAL}
          onConnect={noop}
          onDisconnect={noop}
        />
        <IntegrationCard
          integration={{ ...GCAL, available: true }}
          onConnect={noop}
          onDisconnect={noop}
        />
        <IntegrationCard
          integration={GCAL}
          phase="connecting"
          onConnect={noop}
          onDisconnect={noop}
        />
        <IntegrationCard
          integration={GCAL}
          message={{
            tone: "info",
            text: "Google Calendar isn't available yet. We'll turn it on soon.",
          }}
          onConnect={noop}
          onDisconnect={noop}
        />
        <IntegrationCard
          integration={GCAL}
          message={{
            tone: "error",
            text: "Couldn't connect Google Calendar. Please try again.",
          }}
          onConnect={noop}
          onDisconnect={noop}
        />
        <IntegrationCard
          integration={{
            ...GCAL,
            available: true,
            connection: {
              status: "connected",
              accountLabel: "you@example.com",
              connectedAt: "2026-10-13T10:00:00Z",
            },
          }}
          message={{ tone: "success", text: "Google Calendar is connected." }}
          onConnect={noop}
          onDisconnect={noop}
        />
      </Section>

      <Section title="Empty states">
        <EmptyState
          icon={<FileText />}
          title="No journal entries yet"
          message="Tap record to capture your first entry."
        />
        <EmptyState
          icon={<Search />}
          title="No matches"
          message="Try a different word or phrase."
        />
      </Section>

      <Section title="Cards">
        <NoteCard
          title="Morning run and the Q3 pitch"
          dateLabel="Oct 13, 9:42 AM"
          durationLabel="2 min"
          onClick={noop}
        />
      </Section>
    </div>
  );
}
