# @mindreva/ui

The shared Mindreva design system: design tokens + owned, editable components.
Theme is **dark mint / white / minimal / premium**. Every screen imports from
here and never redefines styles locally.

## Usage

```tsx
import { Button, NoteCard, RecordButton } from "@mindreva/ui";
```

Styles are wired up once in `apps/web`:

- `apps/web/app/globals.css` imports Tailwind, then `@mindreva/ui/styles/tokens.css`,
  then `@source`s this package so its class names are scanned.
- `apps/web/app/layout.tsx` loads the fonts (see below) and mounts `<Toaster />`.

## Design tokens

Tailwind v4, CSS-first. Tokens live in
[`src/styles/tokens.css`](./src/styles/tokens.css) — **not** a `tailwind.config`.
A rebrand or dark mode is a change to these vars, never a component rewrite.

### The one rule that matters

**Dark mint (`mint-600`/`mint-700`) is for ACTIONS** — primary buttons, the
record button, the filled radio, active dots. **The lightest tint
(`mint-50`/`mint-100`) is for SELECTED backgrounds only** — never a primary
button, never body text. Collapsing these two makes the UI harder to scan.

### Raw palette (generates `bg-*`, `text-*`, `border-*` utilities)

| Scale        | Tokens                                                   | Use                                                           |
| ------------ | -------------------------------------------------------- | ------------------------------------------------------------- |
| Dark mint    | `mint-50…900`                                            | `mint-600` = primary action; `mint-50/100` = selected surface |
| Warm neutral | `warm-50…900`                                            | `warm-50` page bg, `warm-900` text, `warm-600` muted text     |
| Status       | `success`, `warning`, `danger`, `info` (+ `-foreground`) | badges, alerts, destructive                                   |

### Semantic aliases (override in `.dark` to theme dark mode)

`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`,
`accent` (selected tint), `destructive`, `border`, `input`, `ring` — each with a
matching `-foreground` where text sits on top. Use as `bg-background`,
`text-muted-foreground`, `border-border`, `ring-ring`, `bg-accent`, etc.

### Radius · shadow · fonts · motion

- Radius: `rounded-sm` (6px) · `rounded-md` (10px) · `rounded-lg` (14px, cards) ·
  `rounded-xl` (20px) · `rounded-2xl` (28px). Pills use `rounded-full`.
- Shadow: `shadow-subtle` (resting cards) · `shadow-elevated` (dialogs, sheets,
  the record button).
- Fonts: `font-serif` is the **logotype only** (Fraunces); `font-sans` (Geist) is
  all UI text; `font-mono` (Geist Mono) is metadata like "Wed 22 Jul · 37 s".
  The `--font-*` CSS vars are supplied by `next/font` in `apps/web/app/layout.tsx`.
- Motion: `animate-fade-in`, `animate-scale-in`, `animate-slide-up`,
  `animate-mic-pulse` (record ring), `animate-waveform` (bars). Spacing uses
  Tailwind's default scale (not overridden).

Contrast: the dark mint primary is **7.24:1** for white text on it — clears
WCAG AA (4.5:1) and AAA (7:1). Muted body text uses `warm-600` (≥6.2:1), not
`warm-500` (which only clears the 3:1 large-text bar).

## Components

Base: `Button` (primary/secondary/outline/ghost/destructive) · `Input` ·
`Textarea` · `Card` · `Avatar` (+ `initialsFromName`) · `Dialog` · `BottomSheet`
· `Tabs` · `Badge` · `Skeleton` · `Switch` · `Toaster`/`toast` · `ProgressBar`
(labeled usage bar) · `SettingsRow`.

App-specific: `FilterPills` (All/Today/This week/Date) · `CalendarPicker` (month
grid with entry dots, Clear/Today) · `NoteCard` · `OptionCard` (selectable radio
row) · `RecordButton` (idle/preparing/recording/paused/processing) +
`TransportButton` · `WaveformVisualizer` · `Logo`/`LeafMark`.

See every component and variant live at `/dev/components` (dev-only route).
