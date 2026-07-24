"use client";

import * as React from "react";
import { Archive, Trash2, RefreshCw, Mail, Search } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  BottomSheet,
  BottomSheetContent,
  BottomSheetTitle,
  BottomSheetTrigger,
  Button,
  CalendarPicker,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FilterPills,
  Input,
  Logo,
  NoteCard,
  OptionCard,
  ProgressBar,
  RecordButton,
  type RecordButtonState,
  SettingsRow,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
  TransportButton,
  WaveformVisualizer,
} from "@mindreva/ui";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
        {title}
      </h2>
      <div className="border-border bg-card shadow-subtle rounded-lg border p-6">
        {children}
      </div>
    </section>
  );
}

const filterOptions = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "date", label: "Date", icon: <Search className="size-4" /> },
];

const useCases = [
  {
    value: "general",
    title: "General",
    description: "A plain summary of what was said",
  },
  {
    value: "meetings",
    title: "Meetings & standups",
    description: "Outcomes, decisions, and who does what",
  },
  {
    value: "interviews",
    title: "Interviews & research",
    description: "Key answers, insights, and quotes",
  },
];

export function ComponentsGallery() {
  const [filter, setFilter] = React.useState("all");
  const [useCase, setUseCase] = React.useState("meetings");
  const [recState, setRecState] = React.useState<RecordButtonState>("idle");
  const [date, setDate] = React.useState<Date | undefined>(new Date());

  const recStates: RecordButtonState[] = [
    "idle",
    "preparing",
    "recording",
    "paused",
    "processing",
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6 py-12">
      <header className="space-y-2">
        <Logo size="md" />
        <h1 className="text-2xl font-bold tracking-tight">Component gallery</h1>
        <p className="text-muted-foreground text-sm">
          Visual QA for the Mindreva design system. Dev-only route.
        </p>
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input placeholder="Enter your email address" />
          <Input placeholder="Disabled" disabled />
          <Textarea
            placeholder="Edit your transcript…"
            className="sm:col-span-2"
          />
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="neutral">Free</Badge>
          <Badge variant="primary">Pro</Badge>
          <Badge variant="accent">Selected</Badge>
          <Badge variant="success">Done</Badge>
          <Badge variant="warning">Processing</Badge>
          <Badge variant="danger">Failed</Badge>
          <Badge variant="outline">Draft</Badge>
        </div>
      </Section>

      <Section title="Avatar">
        <div className="flex items-center gap-4">
          <Avatar>
            <AvatarFallback>K</AvatarFallback>
          </Avatar>
          <Avatar className="size-14">
            <AvatarFallback>KH</AvatarFallback>
          </Avatar>
        </div>
      </Section>

      <Section title="Progress bars (usage)">
        <div className="space-y-4">
          <ProgressBar
            label="Note taking"
            valueLabel="1m of 1h"
            current={1}
            max={60}
          />
          <ProgressBar
            label="Notes"
            valueLabel="2 of 10"
            current={2}
            max={10}
          />
        </div>
      </Section>

      <Section title="Settings rows">
        <div className="divide-border border-border divide-y overflow-hidden rounded-lg border">
          <SettingsRow
            icon={<Archive />}
            title="Archived"
            description="Notes you archive are kept here"
            chevron
            onClick={() => {}}
          />
          <SettingsRow
            icon={<Trash2 />}
            title="Trash"
            description="Restore or permanently delete notes"
            chevron
            onClick={() => {}}
          />
          <SettingsRow
            icon={<RefreshCw />}
            title="Cloud sync"
            description="2 notes kept · Free"
            trailing={
              <Button variant="ghost" size="sm">
                Refresh
              </Button>
            }
          />
          <SettingsRow
            icon={<Mail />}
            title="Email notifications"
            description="Get an email when a note finishes processing"
            trailing={<Switch defaultChecked />}
          />
        </div>
      </Section>

      <Section title="Filter pills">
        <FilterPills
          options={filterOptions}
          value={filter}
          onValueChange={setFilter}
        />
        <p className="text-muted-foreground mt-3 text-sm">Selected: {filter}</p>
      </Section>

      <Section title="Option cards (single-select)">
        <div role="radiogroup" className="space-y-2.5">
          {useCases.map((u) => (
            <OptionCard
              key={u.value}
              title={u.title}
              description={u.description}
              selected={useCase === u.value}
              onSelect={() => setUseCase(u.value)}
            />
          ))}
        </div>
      </Section>

      <Section title="Note cards">
        <div className="space-y-3">
          <NoteCard
            title="And so I was wondering what happened when I sleep and wake up in the morning."
            dateLabel="Wed 22 Jul"
            durationLabel="37 s"
            snippet="when I sleep and wake up Do you understand what I'm saying about the mornings…"
            onClick={() => {}}
          />
          <NoteCard
            title="Um, hey, what's up?"
            dateLabel="Tue 21 Jul"
            durationLabel="3 s"
            snippet="Um, hey, what's up?"
            onClick={() => {}}
          />
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="transcript">
          <TabsList>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
          <TabsContent
            value="transcript"
            className="text-muted-foreground text-sm"
          >
            Raw transcript content goes here.
          </TabsContent>
          <TabsContent
            value="summary"
            className="text-muted-foreground text-sm"
          >
            Generated summary content goes here.
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Skeleton">
        <div className="space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Section>

      <Section title="Dialog & Bottom sheet">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this note?</DialogTitle>
                <DialogDescription>
                  It will move to Trash. You can restore it later.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive">Delete</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <BottomSheet>
            <BottomSheetTrigger asChild>
              <Button variant="secondary">Open date picker</Button>
            </BottomSheetTrigger>
            <BottomSheetContent>
              <BottomSheetTitle>Pick a date</BottomSheetTitle>
              <div className="mt-3">
                <CalendarPicker
                  selected={date}
                  onSelect={setDate}
                  entryDates={[new Date(new Date().setDate(21))]}
                  onClear={() => setDate(undefined)}
                  onToday={() => setDate(new Date())}
                />
              </div>
            </BottomSheetContent>
          </BottomSheet>
        </div>
      </Section>

      <Section title="Toasts">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => toast("Note saved")}>
            Default
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast.success("Transcript ready")}
          >
            Success
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast.error("Transcription failed")}
          >
            Error
          </Button>
        </div>
      </Section>

      <Section title="Record button (states)">
        <div className="flex flex-wrap items-start gap-8">
          {recStates.map((s) => (
            <RecordButton key={s} state={s} size="md" />
          ))}
        </div>
        <div className="mt-8 flex items-center gap-4">
          <span className="text-muted-foreground text-sm">Interactive:</span>
          <RecordButton
            state={recState}
            onClick={() =>
              setRecState((prev) => (prev === "idle" ? "recording" : "idle"))
            }
          />
          <TransportButton action="pause" />
          <TransportButton action="stop" />
        </div>
      </Section>

      <Section title="Waveform visualizer">
        <div className="space-y-6">
          <WaveformVisualizer active />
          <WaveformVisualizer active={false} />
        </div>
      </Section>

      <Section title="Cards">
        <Card>
          <CardHeader>
            <CardTitle>More time to think out loud</CardTitle>
            <CardDescription>
              Mindreva Pro gives you 30 hours and 30 notes a month.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm">See plans</Button>
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}
