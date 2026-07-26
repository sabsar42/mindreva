# Changelog

All notable changes to this project are documented here, most recent first.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
adapted to phase-based entries (this project doesn't use semver releases).

See also: [docs/DECISIONS.md](./DECISIONS.md) for the reasoning behind
unplanned changes, and [docs/KNOWN-ISSUES.md](./KNOWN-ISSUES.md) for open items.

## 2026-07-27 — Phase 6.6 fix: app-wide lag traced to a barrel-export leak

Reported directly against the running app after the previous hydration fix
shipped — that fix was real and necessary but not sufficient, since a
shared-barrel export was quietly undoing its bundle-size benefit for every
other page in the app.

### Fixed

- Root cause of the app-wide lag (slow taps, slow saves, slow uploads,
  navigation showing nothing while loading): `RichTextEditor` was still
  re-exported from `packages/ui/src/index.ts`'s shared barrel, even though
  `entry-detail.tsx` already imported it via a `next/dynamic` + direct-
  subpath call. Every one of the ~19 files across `apps/web` that imports
  anything from `@mindreva/ui` was bundling Lexical's full dependency tree
  as a result — confirmed with a build comparison: `/journal`, `/notes`,
  `/archive`, `/trash`, `/account`, and `/entries/[entryId]` dropped from
  ~275-422kB First Load JS back to their pre-Lexical ~185-189kB baseline
  once the barrel export was removed.
- Added `loading.tsx` for the entry detail page and the journal/notes/
  archive/trash list screens (a shared `EntryListLoading` skeleton), so
  navigating shows instant feedback instead of a frozen-looking screen —
  this is what "tapping a note card doesn't show anything" was describing;
  an `async` Server Component page renders nothing at all until it fully
  resolves, absent a `loading.tsx`.
- Caught the same barrel-import trap a second time in those new loading
  files themselves (they imported `Skeleton` from the shared barrel) before
  it shipped — both now import `@mindreva/ui/skeleton` directly.
- Parallelized `getMyEntryDetail`'s five independent Supabase round trips
  into a single `Promise.all` instead of two sequential stages.
- Fixed `SwipeableRow` triggering a React re-render and a `setPointerCapture`
  call on every `pointerdown`, including a plain tap that never moves —
  both now only fire once real movement crosses the existing drag
  threshold, so a tap costs nothing extra before reaching the underlying
  `Link`.
- Cleared dozens of orphaned `node.exe` processes accumulated from repeated
  dev-server restarts across the session, which were compounding the
  perceived lag on top of the bundle issue.

### Verified

- `pnpm build`'s route-by-route First Load JS table confirms every
  previously-inflated route is back to baseline.
- `pnpm lint` and `pnpm build` pass across the monorepo.
- Real `curl` timings against a freshly started, single dev server show
  only the expected one-time-per-route Turbopack compile cost, not a
  persistent slowdown.

### Not fixed (inherent to the stack, not a bug)

- Next.js middleware calls `supabase.auth.getUser()` (a real network round
  trip) on every request per Supabase's documented pattern, and each
  Server Component's own `getUser()` call is a second, separate round trip
  for the same check. Removing the duplication needs request-scoped
  plumbing between middleware and Server Components — out of scope for
  this fix pass, tracked as a possible future optimization.
- `addPhotoToEntry`'s three round trips (upload, DB insert, sign) are
  genuinely sequential — a signed URL can't be created before the object
  is uploaded. The client's existing `uploading` spinner already covers
  this correctly; there's no unnecessary latency to remove here.

## 2026-07-26 — Phase 6.6 fix: Lexical hydration error and slow navigation

Reported directly against the running app right after the Lexical follow-up
shipped — exactly the gap flagged as "not independently verified" in that
entry.

### Fixed

- Hydration error on the entry detail page: Lexical's `ContentEditable`
  renders different DOM server-side (a non-interactive `aria-hidden` shim)
  than once hydrated client-side, a known Lexical/Next.js SSR mismatch.
  `RichTextEditor` is now loaded via `next/dynamic(..., { ssr: false })` in
  `entry-detail.tsx`, imported through `@mindreva/ui`'s existing `./*`
  subpath export (`@mindreva/ui/rich-text-editor`, the same pattern already
  used for `@mindreva/ui/toast`) rather than the shared barrel, with a
  skeleton loading placeholder shown until it mounts on the client.
- Slow-feeling navigation when tapping a NoteCard: the same `ssr: false`
  dynamic import code-splits Lexical's bundle into its own chunk, fetched
  only once the entry detail page actually mounts, instead of shipping as
  part of that page's initial JS.

### Verified

- `pnpm lint` and `pnpm build` pass.
- Live check against a real authenticated request: the server-rendered HTML
  for `/entries/[entryId]` now contains no `contenteditable` element and no
  Lexical DOM at all, only the dynamic import's loading placeholder —
  confirming there's nothing left for the client to mismatch against.

## 2026-07-26 — Phase 6.6 follow-up: swipe actions, sharper radius, Lexical editor, clearer persona icon

Direct feedback on the running app after the initial Phase 6.6 build. Colors
and layout iterated live on localhost; the RichTextEditor's internals were
swapped for Lexical per explicit request.

### Changed

- `NoteCard`: fill changed from the pale mint tint to the page background
  (`bg-background`), with a dimmed `border-mint-100` outline instead of a
  color fill for definition — iterated twice on localhost (first pass used a
  stronger `border-mint-200`/`p-3`/`h-24`, settled on `border-mint-100`/
  `p-4`/`h-28` after review).
- List spacing on the journal/notes list, Archive, and Trash screens went
  `space-y-4` → `space-y-5` → back to `space-y-4` after comparing both on
  localhost.
- Sharpened the app-wide radius scale from a pill/14px mix to a single 10px
  rectangle for every card, chip, badge, tab, and button (`--radius-lg`
  lowered to match `--radius-md`; `Badge`, `FilterPills`, `Tabs`, `Button`,
  and the toast buttons switched off `rounded-full`). Genuinely circular
  elements (`Avatar`, `RecordButton`, `Switch`, round icon-only buttons, the
  NoteCard date-badge circle) were deliberately left alone.
- `RichTextEditor` rebuilt on real Lexical (`lexical` + `@lexical/react` +
  `@lexical/markdown`) instead of the hand-rolled textarea-plus-toolbar —
  bold/italic now render styled while typing rather than showing literal
  `**`/`*` markers. The public `value`/`onChange` contract and the Markdown
  storage format are unchanged, so every call site and `stripFormatting()`
  needed zero changes.
- Swapped the generic `MessageCircle` icon for `History` everywhere the
  "chat with your past self" entry point appears (journal header link,
  past-conversations list rows) — a plain chat bubble didn't communicate the
  time-travel framing that's this feature's identity.

### Added

- `SwipeableRow` in `packages/ui`: a reusable swipe-left-to-reveal-actions
  wrapper built on native Pointer Events (no new gesture-library
  dependency). Wired into every list screen: Archive (muted orange) + Trash
  (muted red) on the journal/notes list, Unarchive + Trash on the Archive
  screen, Restore on the Trash screen — replacing the old single leading
  icon-button pattern on Archive/Trash.
- A confirmation `Dialog` before any swipe-triggered Trash action ("Move to
  Trash?" / Cancel / destructive confirm) on every screen that has it.
  Archive and Restore stay single-tap since they're non-destructive and
  already reversible.

### Verified

- `pnpm lint` and `pnpm build` pass across the monorepo.
- A live check against the real running app and real LLM confirmed the
  Markdown produced by Lexical's `BOLD_STAR`/`ITALIC_STAR` transformers
  round-trips through storage and strips cleanly before reaching both the
  summary and the embedding text — the data pipeline is unaffected by the
  editor swap.
- Not independently verified: the Lexical editor's actual in-browser
  behavior (does bold/italic render styled while typing, do toolbar clicks
  work correctly) — no browser automation tool was available in this
  environment. Flagged directly rather than assumed; needs a manual check.

## 2026-07-26 — Phase 6.6: Rich Text Editing & Task Extraction

### Added

- `RichTextEditor` in `packages/ui`: a plain textarea plus a Bold/Italic
  toolbar wrapping the current selection with `**`/`*` Markdown markers —
  no other formatting, no WYSIWYG rendering, Markdown syntax stays visible
  in the editing surface. Wired into the entry detail page's transcript/body
  editing area, replacing the plain `Textarea` that was there.
- `stripFormatting()` in `packages/types`: converts RichTextEditor's
  bold/italic Markdown to plain text. Wired into every place formatted text
  reaches an LLM (`summarization.service.ts`'s `complete()` and `embed()`
  calls) or a plain-text display context (list/search snippet text).
- `entry_tasks` table (`id`, `entry_id` FK -> `entries.id` cascade delete,
  `text`, `is_done`, `created_at`), RLS-scoped via a join through `entries`
  on `user_id`, same shape as `entry_photos`.
- `TASK_EXTRACTION_RULE` appended to every summary style's prompt in
  `packages/llm/src/prompts/summarize/`: after the summary, the model emits
  a `===TASKS===` marker followed by any genuine action items, or omits the
  block entirely when there are none. Parsed out of the same `complete()`
  response via `parseTaskBlock()` — no second LLM call. The `meetings` style
  no longer inlines an "Action items:" section in the summary body; those
  now go through the task block instead.
- `EntryTasksRepository.replaceForEntry`: every summarize/regenerate deletes
  and re-inserts the entry's task list, so tasks always reflect the current
  confirmed text — the same semantics as `summary_text` itself. Confirmed
  directly: a user's checked-off tasks are not preserved across a
  regenerate.
- `TaskChecklist` in `packages/ui`: a toggleable action-item list,
  presentation-only, rendering nothing when there are no tasks. Wired into
  the entry detail page directly below the summary section, with optimistic
  toggle via `PATCH /api/entries/[entryId]/tasks/[taskId]`.

### Fixed

- The dev component gallery's Note cards demo (`apps/web/app/dev/components/gallery.tsx`)
  still used the pre-fix-pass `space-y-3` spacing — bumped to `space-y-4` to
  match the real journal/notes/archive/trash screens, which were already
  correct.

### Verified

- Confirmed `CalendarPicker` already fully matched `new-date-picker.png`'s
  requirements (photo-thumbnail day cells, plain neutral fallback, dark-mint
  dot fallback, `bg-primary`/`ring-primary` selection, unchanged Clear/Today)
  from the prior Phase 6.5 fix pass — no changes needed.
- Live two-user RLS check against the real Supabase project for
  `entry_tasks`: read/list/toggle/insert all correctly denied for a second
  user, all correctly allowed for the owning user.
- Live end-to-end check against the running app and the real LLM provider: a
  meeting-style entry with Markdown-formatted text produced real extracted
  tasks with no raw Markdown leaking into the stored summary or the
  embedding text; a plain non-actionable personal entry correctly produced
  zero invented tasks; the toggle route persisted `is_done` correctly.
- `pnpm lint` and `pnpm build` pass across the monorepo.

## 2026-07-26 — Phase 6.5 fix pass: exact layout match for list and entry detail

A follow-up review against `docs/design-reference/new-journal-list.png` and
`new-journal-overview-page.png` found the prior redesign pass close but not
exact. This pass fixes those gaps; colors remain our own dark mint, only
layout/structure changed.

### Fixed

- `NoteCard`'s date badge wasn't visibly showing — the markup was correct,
  but a pale-mint badge on a white card was too low-contrast to read.
  Rebuilt as a plain white circle sitting on the card's mint fill (weekday
  small on top, day-of-month large below), matching the reference exactly.
- `NoteCard` rows are now a fixed height (`h-24`) regardless of whether the
  entry has a cover photo, so every card in a list is the same size —
  previously a photo-less entry's row was visibly shorter.
- List spacing increased from `space-y-3` to `space-y-4` on the journal/notes
  list, Archive, and Trash screens; cards were reading as too tight together.

### Changed

- `entry-detail.tsx` reworked into one seamless, undivided page matching
  `new-journal-overview-page.png`: removed the bordered transcript box and
  the `Card`-wrapped Summary section. Content now reads top to bottom as
  plain page flow — title, summary text, the photo, then the transcript —
  with no visible section dividers. The transcript is still a real, editable
  text field, just restyled with no border/background/shadow so it reads as
  flowing body text rather than a boxed form control.

### Verified

- `pnpm lint` and `pnpm build` pass across the monorepo with the fix pass in
  place.
- Confirmed via the running dev server that `NoteCard`'s new accent
  background and fixed-height class render as expected in the HTML output.

## 2026-07-26 — Phase 6.5 redesign: photo-forward journal list, calendar, and entry detail

Reworked the journal list, calendar picker, and entry detail layouts to
match `docs/design-reference/new-journal-list.png`,
`new-date-picker.png`, and `new-journal-overview-page.png` — matching their
layout patterns and information hierarchy, not their palette, imagery, or
page chrome (no photo hero banner, no Media/Map tabs; this app keeps its own
dark mint identity and header).

### Changed

- `NoteCard` (`packages/ui`): replaced the old "title + mono date/duration
  line + snippet" stack with a leading date badge (weekday abbreviation over
  day-of-month, in the accent-mint token), a bold single-line title, a
  two-line snippet, and a trailing square cover-photo thumbnail — the
  entry's first photo by `position`, simply omitted (not a blank gray box)
  when the entry has none.
- `CalendarPicker` (`packages/ui`): the month grid's `DayButton` is now a
  custom `react-day-picker` v9 component override that renders each date's
  cover photo as the cell's own `background-image` when one exists; days
  without a photo stay a plain neutral `bg-warm-100` cell. Selected/today
  styling switched to `bg-primary`/`ring-primary` (dark mint) instead of the
  previous outline treatment, to read clearly against a photo background.
  The dot indicator for "has an entry" now only shows on dates without a
  thumbnail, to avoid stacking a dot on top of a photo. Clear/Today actions
  and the tap-a-date interaction are unchanged.
- `entry-detail.tsx`: reordered to date → bold headline (from the entry's
  title) → hero photo → body/transcript text → the existing Summary card
  below. The Summary card was kept, not removed — the reference app is a
  plain photo journal with no AI summaries, this one still has them.
- `PhotoUploader` (`packages/ui`): rebuilt from a flat row of equal
  thumbnails into a photo-forward layout — the first photo renders as a
  large `aspect-[4/3]` hero (or a dashed-border "Add a photo" empty state),
  with additional photos and an "add another" tile in a small strip
  underneath.

### Added

- `EntryPhotosRepository.getFirstPhotosForEntries` and `getFirstPhotosByDate`:
  batched (`DISTINCT ON`) queries so a whole list screen or calendar month
  resolves its cover photos in one query each, not one per row/cell.
- `listMyDayThumbnails` in `entries.service.ts`, and cover-photo
  `thumbnailUrl` attachment to `listMyEntries`, `listMyArchivedEntries`,
  `listMyTrashedEntries`, and `searchMyEntries` — each batch-signs every
  cover photo for a screen in a single Storage `createSignedUrls` call.

### Verified

- `pnpm lint` and `pnpm build` pass across the monorepo with the redesigned
  components in place.
- Manual check against the running dev server (`/dev/components` and the
  protected list/detail routes) confirmed no rendering or type errors.

## 2026-07-26 — Phase 6.5: Photo Attachments for Entries

### Added

- `entry_photos` table (`id`, `entry_id` FK -> `entries.id` cascade delete,
  `storage_path`, `position`, `created_at`), RLS-scoped via a join through
  `entries` on `user_id`, same shape as the existing `recordings` policy.
- A private `photos` Storage bucket, per-user-folder path scoping
  (`{userId}/{entryId}/...`), mirroring the `recordings` bucket's RLS
  policies (select/insert/delete, all folder-scoped to `auth.uid()`).
- `EntryPhotosRepository`: `create` (asserts entry ownership, computes
  `position` server-side as the current photo count — never client-supplied)
  and `listByEntry` (ordered by `position`).
- `PhotoUploader` in `packages/ui`: presentation-only thumbnail row + "add
  photo" tile, used both on the transcript review screen (attach right after
  recording) and the entry detail screen (add more photos later).
- `POST /api/entries/[entryId]/photos` and `addPhotoToEntry` in
  `entries.service.ts`: uploads via the session-scoped Supabase client (same
  RLS defense-in-depth pattern as voice recording uploads), then creates the
  `entry_photos` row and returns a signed URL.
- `getMyEntryDetail` now also returns the entry's ordered photos with signed
  URLs (batch-signed via `createSignedUrls` to avoid a round trip per photo).

### Verified

- Live two-user RLS check against the real Supabase project: user A can
  upload a photo, insert its `entry_photos` row, and resolve a signed URL for
  it; user B cannot read the row, list it, download the Storage object, sign
  a URL for it, or insert an `entry_photos` row against user A's entry.
- `pnpm lint` and `pnpm build` pass across the monorepo with the new table,
  repository, component, service functions, and API route in place.

## 2026-07-26 — Phase 6: Chat with Past Self

### Added

- `packages/llm/src/prompts/persona-chat.prompt.ts`: the grounded persona
  prompt (hard rules against inventing facts, an explicit "I don't have a
  journal entry from this period about that" instruction, first-person voice,
  no diagnosis or therapy-style advice).
- `persona-chat.service.ts`: embeds the question, retrieves top-k excerpts
  hard-filtered to the session's date range (filtered **before** ranking by
  similarity), builds the grounded prompt, and stores citations.
- Automatic embedding generation after every summarize (initial, edit, or
  regenerate) — `title + confirmed text`, upserted so repeated summarization
  never leaves duplicate embedding rows per entry.
- Chat UI: a session start screen (pick a year or custom range), and the
  conversation screen with the year/range shown large in the serif logotype
  typeface, past-self replies also set in serif, and citations rendered as
  tappable pill chips linking to the source entry.
- A 40-message-per-session cap to bound LLM usage per conversation.

### Fixed

- `matchEntries` wasn't casting the query vector to `::halfvec(2048)`, so it
  silently ignored the halfvec HNSW index added in Phase 5 and fell back to a
  full sequential scan on every chat message.
- `EmbeddingsRepository` had no upsert semantics — repeated summarization
  would have left duplicate embedding rows per entry, skewing retrieval
  toward whichever entries were re-summarized most.

### Verified

- Live 4-fixture manual eval across two years with deliberately similar
  topics but different facts: the date-range hard filter never let a fact
  from one year leak into an answer scoped to the other, in either direction.
  The model honestly declined to answer a question about a topic never
  journaled about instead of inventing one. A genuinely empty date range
  correctly returned zero citations.

## 2026-07-26 — Phase 5: Journaling, Notes & Summarization Pipeline

### Added

- `packages/llm`: `LLMProvider` interface, `GeminiLLMProvider` (long-term
  default), `GroqLLMProvider` (fast fallback, no embeddings),
  `ClaudeLLMProvider` (premium, explicit opt-in), and `OpenRouterLLMProvider`
  (temporary default — see Decisions log).
- Five versioned summary prompt templates (general, meetings, interviews,
  lectures, personal), resolved by the user's onboarding `summary_style`.
- `summarization.service.ts`: summarizes confirmed text (never raw ASR
  output), auto-derives `entries.title` from the first line/sentence when
  unset.
- Real journal and notes list screens (FilterPills, CalendarPicker, live
  search across title/transcript/summary).
- A typed-note compose screen (`/notes/new`).
- The shared entry detail screen: transcript edit, summary, regenerate,
  archive/trash actions.
- Archive and Trash screens, wired into the account page's Phase-3 rows.
- Full CRUD API routes for summarize/archive/trash/restore (all soft-delete
  only).

### Changed

- `embeddings.embedding` migrated from `vector(768)` to `vector(2048)` to
  match the active embedding model's native output dimension (see Decisions
  log). Its HNSW index was rebuilt as a `halfvec` expression index, since
  pgvector's HNSW index caps out at 2000 dimensions.
- `LLM_PROVIDER` default set to `openrouter` (temporary — see Decisions log).

### Fixed

- `SummariesRepository.getByEntry` had no `ORDER BY`, so it could return a
  non-deterministic row once "regenerate summary" could create more than one
  summary row per entry.
- The transcript review screen's "Skip for now" never actually triggered
  summarization, despite the intent documented in code comments.
- A stale `vector(768)` reference in `OpenRouterLLMProvider`'s
  dimension-mismatch error message (the constant had been updated to 2048,
  the message text hadn't).

## 2026-07-24 — Phase 4: Voice Capture & ASR Abstraction Layer

### Added

- `packages/asr`: `ASRProvider` interface, `GroqASRProvider` (default,
  Whisper large-v3-turbo), `HuggingFaceASRProvider` (documented fallback),
  `SelfHostedNemotronProvider` (stub for Phase 9).
- The recording screen: real `MediaRecorder` capture with a live waveform
  driven by a Web Audio `AnalyserNode`, accurate pause/resume timing, a
  5-minute soft warning and 10-minute hard stop (enforced client- and
  server-side), a `beforeunload` guard, and cancel-discards-everything.
- A private, RLS-scoped Supabase Storage bucket for recordings.
- Entry + recording + transcript created transactionally in one Postgres
  transaction.
- The transcript review/edit screen (saves to `edited_text`, `raw_text`
  never touched).

### Fixed

- `status`/`type`/`source`/`role` columns in the schema were typed as bare
  `string` instead of their proper literal unions — patched with Drizzle's
  `.$type<T>()` across all four.
- `turbo.json` didn't declare the Supabase/provider environment variables
  used at build time, which Vercel flagged as an unknown-env-var cache-key
  warning.

## 2026-07-24 — Phase 2 & 3: Design System, Database, Auth & Backend

### Added

- `packages/ui`: the dark mint / warm neutral design token system
  (Tailwind v4 CSS-first `@theme`), Fraunces serif logotype + Geist sans,
  and the full owned component library (Button, Input, Textarea, Card,
  Avatar, Dialog, BottomSheet, Tabs, Badge, Skeleton, Switch, Toast,
  ProgressBar, SettingsRow, FilterPills, CalendarPicker, NoteCard,
  RecordButton, WaveformVisualizer, Logo, OptionCard), built on Radix + CVA.
- A `/dev/components` visual QA gallery and a placeholder landing page.
- `packages/database`: Drizzle schema for all 8 tables (profiles, entries,
  recordings, transcripts, summaries, embeddings, chat_sessions,
  chat_messages), with Row Level Security policies on every table.
- The repository layer — the only code allowed to import Drizzle directly,
  enforced by an ESLint rule.
- Supabase Auth: sign-in/sign-up (Google + email/password), onboarding
  (language selection, use-case/summary-style selection), account settings
  scaffold.
- Session-refreshing middleware with route protection.
- A GitHub Actions workflow pinging Supabase every 3 days to prevent
  free-tier auto-pause.

### Verified

- RLS cross-user isolation proven live with a scripted test creating two
  throwaway users and confirming one cannot read the other's data.

## 2026-07-23 — Phase 1: Monorepo Bootstrap & Dev Environment

### Added

- Turborepo + pnpm workspace monorepo (`apps/web`, `packages/config`,
  `packages/types`).
- `apps/web`: Next.js 15 (App Router, TypeScript, Tailwind) scaffold.
- `packages/config`: shared ESLint flat config, base `tsconfig.json`.
- Husky pre-commit hook (lint-staged) and commitlint (conventional commits).
- A documented `.env.example` covering every provider planned across the
  whole roadmap, not just what Phase 1 uses.
- GitHub repository and Vercel deployment connected.
