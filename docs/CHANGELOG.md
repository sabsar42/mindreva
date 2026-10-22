# Changelog

All notable changes to this project are documented here, most recent first.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
adapted to phase-based entries (this project doesn't use semver releases).

See also: [docs/DECISIONS.md](./DECISIONS.md) for the reasoning behind
unplanned changes, and [docs/KNOWN-ISSUES.md](./KNOWN-ISSUES.md) for open items.

## 2026-10-22 — Perf: function region moved to Seoul, one pooled DB connection, timing logs

See DECISIONS.md (2026-10-22, "Function region Seoul, max:1") for the reasoning.

- `vercel.json`: `"regions": ["icn1"]` (Seoul), was `hnd1` (Tokyo). Supabase is
  `ap-northeast-2` (Seoul, from the `aws-1-ap-northeast-2` pooler host), so
  every DB, Auth and Storage round trip used to cross Tokyo→Seoul.
- `packages/database/src/client.ts`: still the transaction pooler (6543) with
  `prepare: false`; now `max: 1` (override with `DATABASE_POOL_MAX`),
  `idle_timeout: 20`, and a warning if `DATABASE_URL` ever points at 5432.
- New `apps/web/lib/timing.ts` (`timed()`), logging
  `[timing] route=<r> step=<s> ms=<n>` (silence with `TIMING_LOGS=0`) on the
  journal page, entry list, entry detail (each query + photo signing),
  thumbnails, photo upload and recording upload.
- Less waiting in a row: the year heatmap reads "today" alongside the year's
  data (`heatmap.service.ts`); a photo's row insert and URL signing run
  together (`addPhotoToEntry`); a recording's upload and the "today" lookup run
  together (`createVoiceEntry`).
- Measured on a production build from this machine (Bangladesh → Seoul DB,
  ~120ms per round trip, pool 10 to isolate the code changes), medians: Journal
  543→312-416ms, photo upload 1297→1169ms, recording upload 1513→1299ms; entry
  detail, entry list and thumbnails unchanged (already parallel). Confirmed in
  the logs that `prepare: false` makes every parameterised query two round
  trips, and that with `max: 1` a request's queries queue one after another.
- Throwaway user + seeded entries/photos deleted afterwards (cascade checked:
  0 entries, 0 profiles, Storage objects removed). lint, test (134), build green.
- Not verified: live Vercel logs (CLI not logged in) and the deployed timings
  in `icn1` (needs a deploy).

## 2026-10-22 — Fix pass: safe defaults, atomic summary write, browser-verified limits

- Missing env vars are no longer a production risk: `OPENROUTER_FALLBACK_MODELS` has built-in defaults when unset (empty = none), and Groq becomes the completion fallback automatically when `GROQ_API_KEY` is present and `LLM_FALLBACK_PROVIDER` is unset (empty = off).
- Bug found in the browser run and fixed: writing a summary and clearing the entry's `summary_retry_at` were two statements, so a crash between them would summarise the entry again. `SummariesRepository.create` now does both in one transaction.
- Entry detail says "Your summary is on its way" for a pending summary instead of inviting a refresh that would hit the limit again.
- CI now runs on pushes to `master` (the trigger watched `main`, which doesn't exist).
- Verified on a production build in headless Edge at 390px with a throwaway user (deleted): sign-in; an overdue pending summary written in the background on page load via the real OpenRouter primary with the mark cleared; Regenerate at the daily limit shows the calm toast, marks the entry pending and writes nothing; chat at its limit shows the inline note, keeps the question in the box and stores no message; no page exceptions or console errors. 140 tests, lint, typecheck, build green.

## 2026-10-22 — AI calls survive free-tier limits and model rotation

See DECISIONS.md (2026-10-22, "Free-tier AI quotas") for the measurements behind this.

- `@mindreva/llm`: `complete()` now returns `{text, model, provider}`. OpenRouter sends `OPENROUTER_MODEL` + `OPENROUTER_FALLBACK_MODELS` + `openrouter/free` (batched 3 per request). New `FallbackLLMProvider` + `LLM_FALLBACK_PROVIDER` for completions only. Groq's model is `GROQ_LLM_MODEL` (default `openai/gpt-oss-120b`; the old llama model was retired).
- Migration 0017: `summaries.model`, `entries.summary_retry_at` (+ partial index). Usage columns on `profiles` renamed in TypeScript only (`summariesUsedToday`, `chatMessagesUsedToday`, `usageResetsAt`).
- Per-user daily limits (15 summaries, 20 chat messages), atomic reserve/refund (`ProfilesRepository.consumeDailyUsage`), reset at the user's midnight (`nextMidnightInZone`).
- Summaries never block a save: failure or limit marks the entry pending retry; the summarize route answers 200 with `pending` instead of an error; the memory card, entry detail and chat show a calm note.
- Config: the previous primary model was dead (404) for this account, so `OPENROUTER_MODEL` is now `nvidia/nemotron-3-ultra-550b-a55b:free` with minimax and poolside as fallbacks.
- Verified live: normal path, dead primary, three dead models in a row (second batch), bad key then Groq; usage counters (limit, refund, 5 concurrent requests at the limit -> 0 extra wins, midnight reset) and retry claims (3 concurrent claims over 2 due entries -> 2 distinct) on the real database with a throwaway user (deleted). 134 tests.

## 2026-10-22 — iOS-native polish pass (tokens, components, gestures, safe areas)

A refinement pass toward an iOS feel, on top of the 2026-10-19 Apple-style theme. No business logic, API, schema, auth or routing changed. Branch `feat/ios-polish`.

### Tokens (`packages/ui/src/styles/tokens.css`)

- **System font.** Sans is the San Francisco system stack (`-apple-system, BlinkMacSystemFont, "SF Pro Text", …`); Geist and Geist Mono are no longer downloaded (mono was unused). Fraunces stays for the serif, now `display: swap`. Webfont files in the build: 14 (248 KB) to 3 (84 KB).
- **iOS type names** alongside the existing compact scale, which already lined up with it: `text-large-title`, `title-1..3`, `headline`, `body`, `callout`, `subhead`, `footnote`, `caption` (rem, so system text size scales them). `cn()` knows they are font sizes, so `tailwind-merge` doesn't drop a text colour next to them.
- New tokens: `--separator` (0.5px hairline), `--label-tertiary`, `--material` / `--material-solid`, `--row-pressed`, `--duration-fast/base/slow`, `--ease-standard/-exit/-sheet`, `--radius-sheet` (28px), `--safe-top/bottom/left/right`. Dark-mode success / warning / info colours lifted to at least 4.5:1 on dark surfaces.
- **Materials:** `bg-material` / `bg-glass` use `saturate(180%) blur(20px)` and fall back to solid surfaces without `backdrop-filter` or under `prefers-reduced-transparency`.
- **Accessibility media:** `prefers-contrast: more` firms up hairlines and secondary text; `forced-colors` keeps a real focus outline.
- **Mobile basics:** no tap highlight, `touch-action: manipulation` on controls (no double-tap-zoom delay), no text selection or callout on buttons, `text-size-adjust: 100%`.
- **Press timing:** presses land in 80ms (scale 0.97) and release over 220ms with an ease-out, instead of 100ms both ways.
- Utilities: `grouped-list` (Settings-style inset separators and row highlight), `hit-44` (44 × 44 hit area for links), `pb-safe`, `pb-safe-*`, `pt-safe`, `h-app` / `min-h-app` (visible height minus the top inset).

### Layout and safe areas

- `viewport-fit=cover`; `.app-frame` pads for the notch and landscape sides; every `min-h-screen` (100vh) is now `min-h-app` (dvh), so iOS Safari's toolbars never hide the bottom of a screen. The Journal list, the chat composer, bottom sheets and toasts clear the home indicator or notch.
- `theme-color` follows the app's own theme switch (light by default, dark when chosen), set in the head script and in `applyTheme`.

### Components (`packages/ui`)

- **Button:** labels 13 / 15 / 17px for sm / default / lg; new optional `loading` prop (spinner, same width, `aria-busy`); link-styled buttons get the 44px hit area.
- **Input / Textarea:** 17px at every width (under 16px iOS zooms the page on focus; two call sites that shrank it again were fixed); softer 3px focus halo; `aria-invalid` styling.
- **Switch:** iOS 51 × 31 track, 27px thumb.
- **BottomSheet:** drag the grabber to dismiss (distance or flick velocity; upward pulls rubber-band; a short drag springs back; the exit starts where the finger let go); 28px top radius; same width as the app column; home-indicator padding; no backdrop blur behind the dim.
- **Dialog:** a compact, centred, inset alert (was full-width on phones): centred text, equal-width side-by-side actions.
- **SwipeableRow:** `touch-action: pan-y`, a vertical-scroll direction lock, flick velocity, rubber-band edges, and the card's radius. Fixed: with a mouse, the card link's native drag-and-drop swallowed the swipe after the first move, so swiping never opened on desktop.
- **SettingsRow / grouped lists:** 44px minimum rows, separators inset to the text, rows highlight while pressed instead of shrinking (Account, preferences, avatar sheet).
- **Toasts:** below the notch, soft elevated card, 3.2s.
- **Back buttons:** iOS chevron (was an arrow). `PageHeader` is now a sticky nav bar: transparent at rest, translucent material plus a hairline once content scrolls under it.

### Screens and data

- **Optimistic removals** (archive, unarchive, trash, restore on Journal, Archive and Trash): the row leaves immediately and slides back into its old place with a specific message if the request fails (`useOptimisticRemove`, `lib/optimistic.ts`, 4 tests).
- **Journal search:** each keystroke aborts the previous request, so an older, slower response can't overwrite newer results; search failures say so instead of failing silently; `enterKeyHint`/`inputMode` set; "Searching…" is a live status.
- **Chat composer:** translucent material bar, `enterKeyHint="send"`, and `readOnly` instead of `disabled` while sending, so the iOS keyboard no longer drops after every message.
- **Transcript "Jump to a time":** the phone keypad has no colon, so `1:15` couldn't be typed; `.` and `,` now work as separators too, with the decimal keypad (2 tests).
- Auth fields: email keyboard, no autocapitalise or spellcheck, Next/Go return keys; submit uses the `loading` button.
- **Skeletons match their screens:** the Journal has its own (header, week strip, record bar, 108px cards); Archive and Trash mirror their lists. Archive and Trash cards now use the Journal's 8px gap.
- `global-error.tsx` uses the current neutral palette and a 44px pill.

### Verified

Production build in headless Edge with a throwaway account (deleted, cascade confirmed): 6 widths (375, 390, 430, 768, 1024, 1440) × light and dark × 8 routes, with no horizontal overflow, no unnamed controls, no field under 16px, no undersized tap targets at 390px, and no console errors or warnings. Interactions: sheet drag-dismiss, spring-back, Escape and focus restore; swipe-open; trash alert layout; optimistic trash (row gone before the server answers); offline archive restores the row in place with an error toast; sticky nav material; reduced motion. Typecheck, lint, 123 tests and build green. First Load JS +1–2 kB per route (journal 194 to 196 kB).

## 2026-10-22 — Consistency data made production-safe (timezone, New Year, archive)

Audit of the contribution graph / streak storage. Saved data: `app_logins` (visits) and `entries.entry_date`; graph colours and streak are derived. Fixed:

- **Timezone.** New `profiles.timezone` (migration 0015, default `UTC`, applied to the live project). A `TimezoneSync` client component posts the browser's IANA zone to `POST /api/profile/timezone` (once per zone per device); that also records today's visit in the right zone. Visits, new voice/text entries and the streak now use the user's own midnight (`lib/day-key.ts`, `getMyToday()`), not the server's UTC clock.
- **New Year.** The streak walk loads earlier years on demand, so a streak survives 1 January.
- **Archive.** `countsByDateForUser` now includes archived entries (deleted ones still excluded), so archiving doesn't lighten a day's cell; the selected-day list includes them too.
- **History re-cut, once.** Migration 0016 adds `profiles.timezone_synced_at`. The first sync (`ProfilesRepository.syncTimezone`, one transaction) moves existing entries whose `entry_date` is still the UTC date of `created_at` to the local date (hand-edited dates untouched) and rebuilds `app_logins` from `created_at`, merging UTC days that share a local day. Later zone changes (travel) never rewrite history.
- **No UTC guess on first load.** The layout's visit write waits until the zone has been synced; the sync records that visit itself.

Verified live against the real Supabase project with a throwaway user (deleted, cascade confirmed): 02:00 Dhaka entry moved to the right day, a hand-moved entry kept its date, two UTC visit days merged into one Dhaka day, a second (travel) sync changed nothing. Caught a real bug there first: a parameterised time zone in GROUP BY failed in Postgres (fixed with positional grouping). 118 tests pass; typecheck and lint green.

## 2026-10-19 — One Apple-style theme: neutral palette, flat dark mode, no cream

Owner feedback: the dashboard and dark mode didn't match the sign-in page; wanted one coherent, compact, techy Apple look with no cream on edges or borders.

- **Diagnosis.** The sign-in page works because it is flat: ink and green gradient pills, pill inputs, soft shadow. The dashboard had warm cream surfaces (page `#f8f6f2`, borders `#e6e3dd`, inputs `#e1ded7`), a bright 1px inner rim on every card, and a paper grain; dark mode had a page and cards only a few shades apart (`#151617` / `#1e2022`) with a glowing rim, which read as outlined and muddy.
- **Light:** neutral Apple grays. Page `#f5f5f7`, cards white, text `#1d1d1f`, secondary text `#6a6a70`, hairline `#e5e5ea`, input edge `#d2d2d7`, fills `#efeff2`. Cards are flat with a soft shadow and no rim. Card radius 28px to 22px.
- **Dark:** Apple-style layers on true black. Page `#000`, cards `#1c1c1e`, raised fills `#2c2c2e`, sheets `#242426`, hairline `#2c2c2e`, text `#f5f5f7`, secondary `#9c9ca3`. No shadows or rim on cards (depth comes from the surface step); inputs `#3a3a3c`.
- **Filled buttons** (primary, ink, destructive) keep a hairline of light along the top edge (new `--shadow-button`), as on the sign-in buttons; cards do not. Ink gradient is neutral (`#3a3a3c` to `#1d1d1f`; dark `#48484a` to `#303032`).
- **Paper grain removed** (it was neither Apple nor techy). The brand green, mint and Mori are unchanged.
- All colors live in `packages/ui/src/styles/tokens.css`; nothing was hard-coded elsewhere, so every screen, including the recording bar, the week strip, sheets and the legal pages, follows from the tokens alone.
- **Contrast re-checked** on the new pairs, both themes: everything meets 4.5:1. Two small adjustments: dark day numbers on the brightest heat shades are pure black (they were 4.26:1), and dark destructive text is `#ff6b66`.

## 2026-10-19 — Tactile and compact polish, and no more plans: a voluntary support link

### Polish (through `packages/ui` tokens and components, so every screen follows)

- **Pressed states everywhere.** Every button and `role="button|tab|switch|menuitem"` scales to 0.975 in about 100ms while its raised shadow gives way to an inset one (`press` utility plus a base-layer rule; no per-screen edits). Verified live: `matrix(0.975…)` and an inset shadow while pressed.
- **Raised and inset.** `--shadow-subtle` / `--shadow-elevated` are now two soft layers plus a faint 1px top highlight (white in light, 6-8% white in dark); new `--shadow-pressed` is the inset look used for pressed and _selected_ states (tabs, pills).
- **Springs.** `--ease-spring` and a `spring` utility drive the Switch thumb and track and tab/pill changes.
- **Haptics.** `haptic()` in `packages/ui/src/lib/haptics.ts`: the Capacitor Haptics plugin in the native app (read from the global `Capacitor`, no new dependency), `navigator.vibrate(10)` on supporting browsers, silent everywhere else (iOS Safari, desktop, server). Wired to record start/stop/discard, every Switch, segmented pills, a successful entry save, and a memory finishing. 7 tests.
- **Reduced motion.** No scale and no spring: `*:active { transform: none }` plus the existing collapse of durations. Verified live.
- ~~Paper grain~~ (added, then removed the same day; see the Apple-style theme entry above).
- **Compact.** Type scale one notch smaller and tighter through the theme tokens (base 15px / 1.45, sm 13px, lg 17px, 4xl 34px); body picks it up. Less padding in Card, SettingsRow and bottom sheets. **Every list card is exactly 108px** (cover 80px, padding 14px) with 8px gaps; a card still forming may be taller until it settles.
- **Tap targets stay 44px.** A base-layer `::after` gives every tappable a hit area of at least 44 x 44 however small it looks. Packed grids of tiny cells (the activity graph's days) opt out with `data-dense` so their hit areas don't overlap. Live check: all 28 real tappables on the Journal are >= 44px.
- **Contrast re-checked** (script of real token pairs, both themes, including the grain as a worst-case background shift): everything meets 4.5:1 except one pair that already failed, the dark-mode destructive button (label 3.33:1 at the top of its gradient). Fixed with a deeper dark red (`#d23b38` to `#b82a28`) and a white label (4.75:1 / 6.18:1). Muted text on the page with grain: 5.14:1 light, 7.06:1 dark.
- Not done: faint ruled lines in the entry body. The editor's paragraph spacing (12px) isn't a multiple of its line height, so the lines would drift out of line with the text; it needs a paragraph-spacing change first.

### Plans removed, voluntary support added (no payments)

- **Removed:** the plan badge (Account screen and avatar sheet), the "This month" usage bars, "Free plan" / "· Free" copy, the "on the free plan" conversation counter in Past Self (now "n of 2 for this period"; constant renamed `MAX_CONVERSATIONS_PER_HALF`), and the Pro / "See plans" demo card in the dev gallery. `AccountSummary` no longer carries `plan` or `minutesUsed`. The `profiles` plan and usage columns stay in the database, unused.
- **Support Mindreva** (`NEXT_PUBLIC_SUPPORT_URL`): a row on the Account screen and a small footer link (Account footer and the sign-in/sign-up footer). Opens in a new tab with `rel="noopener noreferrer"`; only http(s) URLs are accepted; **hidden entirely when the variable is empty**. Copy: "Entirely voluntary. It unlocks nothing: every feature is free for everyone." Nothing is gated behind it.
- **Friendly limits.** A provider limit (HTTP 429/402, quota, rate limit) now returns a calm message, never an upgrade prompt: summaries show "Today's summary limit is reached. Your recording is saved; try again tomorrow." on the card; Past Self shows "We've reached today's limit for this. Nothing is lost, and it will work again tomorrow." `lib/limit-error.ts` (tests assert the copy never mentions plans, upgrades or payment).
- **Privacy and Terms pages** at `/privacy` and `/terms` (public, in a new `(legal)` route group), linked from the Account screen and the sign-in footer. Written from what the code actually does: what is stored, which services see audio and text (Supabase, Groq/Hugging Face, OpenRouter/Gemini/Claude, Vercel, Sentry if enabled with text and media masked), sharing, and soft-deleted Trash. The support section appears only when the link is set; a contact address (`NEXT_PUBLIC_CONTACT_EMAIL`) appears only when set.
- The dead `/support` and "Delete account" links are gone.

## 2026-10-18 — One button hierarchy across every page and theme

`packages/ui/src/components/button-variants.tsx` is now the single scale, with
the hierarchy written at the top of the file.

- **Roles:** `primary` (main action), `ink` (single top action on auth-style
  screens), `destructive` (Stop, Delete), `secondary`, `outline`, `glass` (over
  a photo), `ghost` (navigation such as Back), `quiet` (toolbar icon actions).
  One `primary` per surface. All colors are theme tokens, so light and dark
  follow automatically.
- **Sizes:** text buttons sm 36 / default 44 / lg 56. Icon-only buttons
  icon-sm 32 / icon 40 / icon-lg 44, and the icon sizes itself (16 / 20 / 24),
  so no button needs its own icon size class.
- **Moved onto it** (they were hand-styled in at least eight different sizes
  from 28 to 44px, with icons from 16 to 24px, and two different greys): header
  tab icons, Back (page header, entry detail, chat), Archive/Trash, Journal
  search and its close, the cover "Change cover" button (new `glass` variant),
  river expand, share-sheet remove, show/hide password, the week-graph arrows,
  and the recorder's Stop (`destructive`, lg), Retry (`primary`, lg) and
  Discard/Dismiss (`quiet`, icon).
- Left alone on purpose: tabs, switches, filter pills, the rich-text toolbar,
  list rows, Mori and the avatar (they are not buttons in this hierarchy).

Verified in light and dark: header icons 44, standard icon buttons 40, "Change
cover" 36, Stop 56 tall; no console errors; typecheck and lint pass.

## 2026-10-18 — Mori, week strip, and memories that form on screen

Built on the Journal screen in the real app, from the mockup and brief.

### Added

- **Mori** (`packages/ui/src/components/mori.tsx`), a leaf companion in the
  header's top-left. Seven moods, cross-faded (not swapped): `sleepy`, `calm`,
  `happy`, `thriving` for the week on screen, and live `listening`,
  `thinking`, `celebrating`. Rules live in `lib/mori-mood.ts` (pure, 17 tests):
  what the user is doing right now wins; otherwise the viewed week sets the
  base (active days, recordings); for the current week today adjusts it
  (recorded today lifts Mori, a quiet late night puts it to sleep, a quiet
  evening after a good week reads calm). It follows the clock hourly.
  - **Tap:** a speech bubble says what Mori feels and why.
  - **Hover (mouse):** a small hop, at most every 2.5s. Nothing opens.
  - **Press and hold (600ms):** a bottom sheet with today at a glance and a
    **Quiet mode** switch (Mori keeps its expressions but stays still; stored
    per device).
- **Week strip + full graph** (`activity-graph.tsx`): the contribution graph is
  one week in a rounded rectangle the size of the record bar. Swipe or drag to
  go back through weeks (the month label follows); tap a day for details;
  press and hold (or Enter) opens a bottom sheet with Month and Year views.
  The strip reports the week on screen, which drives Mori.
- **Memory cards that form.** After a recording uploads, a green card emerges on
  top of the list and develops with the real pipeline: _Transcribing_ (shimmering
  placeholder lines) -> _Shaping your memory_ (the transcript appears with a
  caret) -> _Finishing up_, with a progress bar that follows the stage. On
  completion the green drains out (`settle`, ~1.2s) and it becomes a normal,
  tappable card. Driven by `lib/memory-forming.ts`, a module-level store, so the
  work and the card survive switching tabs.
- **Failure handling.** If transcription fails, nothing is heard, it stalls
  (>150s) or summarising fails, the card turns neutral with a short reason and
  the entry stays in the list; nothing stays green.
- **Card hover/tap effect:** ready cards lift 2px with a green edge; the cover
  leans in; a press scales down slightly.

### Changed

- **Voice entries are now summarised automatically** once their transcript is
  done (the client calls the existing `POST /api/entries/:id/summarize`), so a
  recording becomes a titled memory with a summary, tasks and embedding. Before,
  inline recordings stayed "Untitled entry" until opened.
- Header: Mori, then the date and greeting, the tab icons, and the weekday as
  the title beneath (so "Wednesday" always fits). Order below it: week strip,
  then the record bar (76px), then the Journal row.
- The record bar no longer shows a "Saved!" banner (the forming card is the
  feedback) and reports its phase so Mori can react. `useVoiceRecorder`'s
  `onDone` now also passes the duration.

### Removed (dead code)

- `/record` page and `record-flow.tsx`; `/entries/[id]/review` and
  `transcript-review.tsx` (nothing navigated to it: the record flow always
  returned to `/journal`); `TranscriptionWatcher` and `lib/transcription-watch.ts`
  (it only picked up work when it mounted, so it never fired after an inline
  recording); `RecordButton`, `TransportButton`, `WaveformVisualizer`,
  `ProcessingSteps`, and the old card-style `JournalHeatmap`; `use-heatmap-years`
  (now `use-activity`); the `waveform` animation; `/record` in middleware and
  app-shell. "Record your first entry" on Past Self now links to `/journal`.
- The dev galleries show Mori's moods and every memory-card state instead.

### Verified

Real browser (headless Edge, 390px) against the real Supabase, ASR and LLM, on a
throwaway account (deleted with its audio): recorded with a fake microphone and
watched Mori go listening -> thinking -> celebrating while the card went
Transcribing (2s) -> Shaping (7s) -> Finishing (22s) -> settled into a normal
card that opens its entry; with summarising forced to fail, the card became
neutral with its message and no green card remained. Tap and hold on Mori, hold
on the strip, Month/Year views, quiet mode (persisted), hover lift, no page
scroll, no console errors. typecheck, lint, 97 tests pass.

## 2026-10-17 — Journal: everything above the list is fixed, bigger graph and bar

Owner feedback: the top portion must not scroll at all; only the entry cards
scroll. Also more space between graph and bar, and both a little bigger.

### Changed

- **Only the list scrolls.** Journal is now a fixed-height column (`h-dvh`):
  header, graph, record bar and the "Journal" row are fixed; the entry list is
  its own scroll area (`overscroll-contain`, soft fade at its top edge). The
  page itself no longer scrolls. Replaces the earlier sticky block.
- **Bigger:** graph cells 11px -> 13px (3px gap), year 18px; record bar
  56px -> 64px with a 48px logo button and 16px title; Stop/Retry 44px.
- **Gap** between graph and record bar 6px -> 16px.

### Verified

Headless Edge at 390x844 and 390x667: page height equals viewport, wheel over
the list scrolls only the list, wheel over the header does nothing, header and
bar do not move, recording works while the list is scrolled, search opens, no
console errors. Fixed area is about 450px; the list gets 394px at 844 high and
only 217px at 667 high (see KNOWN-ISSUES).

## 2026-10-16 — Journal header redesign: bare graph, pinned, logo record button (iOS styling)

Owner feedback on the running app: the activity card took too much room, and
the record bar had a separate "Record" button.

### Changed

- **Activity graph is bare.** No card, "Your activity" title, streak line or
  Less/More legend. It is the year with arrows above the grid, the month
  labels and the thin scrollbar. Hovering or tapping a day shows its details
  in the year slot (tap details clear after 2.5s), so it costs no height.
  Cells are 11px with 3px gaps.
- **Graph and record bar are pinned.** They sit in one sticky block at the top
  of Journal; the date header scrolls away and entries slide under a soft
  fade. Pinned height at 390px is 218px (26% of an 844px screen), down from
  ~430px for the old card plus bar.
- **The leaf logo is the record button.** The separate "Record" pill is gone.
  The whole bar is one tappable button; the blinking leaf (with a pulsing
  ring) on the right is its call to action. The streak (flame + "N-day
  streak") now lives under the title.
- **iOS feel, not game chrome.** An earlier pass used chunky raised buttons
  and sparks; the owner found it cartoonish, so it is now flat: a hairline
  capsule with a soft shadow, gradient capsule buttons (green Retry, red
  Stop), semibold type, and a quick press-scale (no raised edge). The
  `--primary-edge`/`--danger-edge` tokens and the burst animation were
  removed.
- **Recording state.** The blinking logo is the live indicator (ring while
  recording, dimmed when paused, spinner while busy), then waveform, discard,
  timer chip and a red Stop capsule. Every state is exactly 56px tall.
- **Saved reward.** After a recording uploads, the bar shows "Saved!" with a
  check badge and the flame count for ~2.6s (tap to record again).
  This replaces the "Recording saved" toast for the inline recorder only
  (`useVoiceRecorder` gained `announceSaved`; `/record` still toasts).
- **Header icons** (History, Plug) are 24px in 44px buttons, up from 20px in
  40px, on every tab.

### Verified

Headless Edge at 390px, light and dark, on a throwaway account (deleted with
its photos and audio): pinned block stays at y=0 while the list scrolls,
including during a recording; bar height is 56px idle, recording, saving and
saved; no console errors; no horizontal overflow; typecheck, lint and 80 tests
pass. Not tried on a real phone.

## 2026-10-16 — Performance and flicker pass

Measured on a production build with 4x CPU throttling and a ~9 Mbps / 60 ms
network, before and after.

### Fixed

- **Activity card lag.** Each render formatted 365 dates with
  `toLocaleDateString` and every hover re-rendered the whole grid. Now one
  shared `Intl.DateTimeFormat` builds labels once per year, the grid is
  memoized, and a single delegated listener replaces per-cell handlers.
  Journal long tasks 1,105 ms → ~280 ms; CPU busy on load 1,351 → 654 ms;
  hover 16 ms/frame.
- **Activity card skeleton flash.** The current year is now loaded on the
  server with the entry list (seen in 5/40 first-paint samples before, 0/40
  after).
- **Year switching.** Years are cached for the session (per signed-in user)
  and the previous year is prefetched; a switch is ~100 ms with no skeleton.
  An uncached year keeps the old grid up, dimmed. Navigation now reaches next
  year (e.g. 2027), which renders empty without a request.
- **Thumbnail swap flicker.** Cards showed default artwork, then swapped to
  the real photo ~0.5 s later. Cards now show a neutral tile until the cover
  is known, and remember "no cover" for the session. Images use
  `loading="lazy"` + `decoding="async"` with fixed dimensions.
- **List thumbnails were full-size photos.** Cover uploads now also store a
  240px WebP (JPEG on Safari) at `<photo path>.thumb`; the thumbnails API
  serves it, falling back to the full photo for older uploads (both signed in
  parallel, no extra round trip). No schema change.
- **Swiping the activity card switched tabs** (Journal → Re-live Me). Its
  scroller is now excluded from the swipe-nav gesture.
- **Leaving Journal mid-recording dropped the audio.** Unmounting now stops
  and saves the take; Discard still discards.
- **Stopping while paused overstated duration** by the paused time.

### Verified

Before/after sweep of every screen, a CPU profile of Journal, and targeted
checks for each fix above, on a seeded throwaway account (deleted with its
Storage objects afterwards). typecheck / lint / test (80) / build green.

## 2026-10-16 — Journal hero: activity card + inline record bar

Phase 6.12 (unplanned; see docs/roadmap.md and docs/DECISIONS.md
2026-10-16). Rebuilt from master after an earlier attempt on the same branch
was rejected.

### Changed

- **Hero is now two pieces:** an always-visible "Your activity" card (full
  year, year arrows, month labels, a visible scrollbar, status line + Less/More
  legend) where the big "Start recording" card was, and a pill-shaped record
  bar where the search box was.
- **Inline recording.** Tapping the record bar starts recording in place: the
  pill keeps its exact 72px size and turns into red dot + live waveform (tap
  to pause) + discard + timer + Stop. No navigation to `/record`, no review
  screen. Stop uploads and transcription runs in the background as before; the
  list and heatmap refresh when it lands. Mic-blocked and upload-failed states
  have inline Retry.
- **Heatmap counts showing up.** New `app_logins` table (RLS, one row per user
  per day, migrations 0013/0014) written via `after()` on every protected page
  load. Levels: 0 nothing, 1 opened the app, 2/3/4 = 1/2/3+ recordings.
  Colours are a muted amber `--heat-1..4` ramp (deepens in light mode,
  brightens in dark mode). Status line shows the current streak, or the tapped
  day's activity.
- Filter row (All/Today/Date) and its date sheet removed; search is an icon
  next to the list heading.
- Icons: Re-live Me `Hourglass` → `History`, Integrations `Puzzle` → `Plug`.
- `useVoiceRecorder` hook (`apps/web/lib/use-voice-recorder.ts`) holds the
  MediaRecorder lifecycle; `/record` still works as a deep-link on top of it.
- Light mode is the default again; dark applies only when chosen explicitly
  (the OS setting is ignored). This earlier fix had not reached master.

### Verified

Headless Edge, 390px, light and dark, seeded throwaway account (fake media
stream): all five levels render, streak and day status correct, record →
pause → resume → discard saves nothing, record → stop saves one entry, never
leaves `/journal`, no console errors. Account deleted, cascade confirmed (0
rows left). typecheck / lint / test (80) / build green; `/journal` 186kB.

## 2026-10-14 — UI fix pass: header spacing, dark-mode heatmap digits, bold+italic, photo loading, trash confirmation

Five issues reported against the deployed app.

### Fixed

- **Header icons unevenly spaced** (`account-menu.tsx`). The Re-live and
  Integrations icons are 20px glyphs in 40px tap boxes (24px visible gap),
  but the avatar was a solid 40px circle with a 2px ring + 2px offset, so it
  read as 48px wide and sat ~10px from its neighbour. The avatar is now 32px
  inside the same 40px tap box (ring and offset fill it exactly) with
  `ml-2.5`, giving a measured 24px visible gap on both sides. The loading
  placeholder keeps the same footprint.
- **Heatmap day numbers invisible in dark mode on low-activity days**
  (`journal-heatmap.tsx`). Levels 0-2 used `text-foreground/70`, which turns
  near-white in dark mode, while the mint scale is the same hex in both
  themes, so level 1 was ~1.4:1. The digit colour now follows the cell
  shade: `mint-900` on levels 1-2, `mint-50` on 3-4, theme foreground only
  on level 0 (whose `bg-secondary` also follows the theme). Measured dark-mode
  contrast: 9.75, 4.65, 6.58 and 11.16 for levels 1-4. The selected day's
  ring offset now uses the page background instead of Tailwind's default
  white.
- **Bold and italic couldn't be combined** (`rich-text-editor.tsx`). Lexical
  renders a run's formats through a single tag, and for bold+italic that tag
  is `<strong>`; italic only shows through a theme class, and the editor's
  theme defined none. Added `text: { bold, italic }` theme classes. The stored
  Markdown was already correct: a headless round-trip test confirmed
  `***text***` saves and reloads as bold+italic with the existing
  transformers, so they were left unchanged, and `stripFormatting` already
  strips it.
- **Photos re-downloaded on every visit (1-2s)**. Measured live: the same
  2.4MB PNG cover was downloaded three times in three visits, each under a new
  signed-URL token, and Storage served it with no `cache-control`.
  - New `lib/photo-url-cache.ts`: hands out the first signed URL seen per
    Storage object while its token is valid (swapping 5 minutes before
    expiry), so revisits render the browser's cached image. Browser-only; on
    the server it's a pass-through, so URLs are never shared across users.
  - `use-entry-thumbnails.ts`: list thumbnails already seen this session render
    immediately and skip the `/api/entries/thumbnails` call; only missing ids
    are fetched. Changing an entry's cover updates this memory, so the list
    never shows the old cover.
  - `entry-detail.tsx`: cover and inline pictures go through the same cache.
  - New `lib/prepare-image-upload.ts`: photos are resized in the browser
    before upload (longest edge 1600px, WebP, JPEG where WebP encoding isn't
    available). Falls back to the original for anything it can't decode or
    shrink. Used by entry detail (cover + inline) and transcript review.
  - Photo uploads now set `cacheControl: "31536000"` (paths are fresh UUIDs,
    never overwritten).
- **Trash from an entry had no confirmation** (`entry-detail.tsx`). The
  header trash icon now opens the existing themed `ConfirmTrashDialog` (the
  one the list's swipe-to-trash already uses) instead of trashing on one tap.

### Verified

- Local visual checks at phone width in light and dark mode, using a
  temporary `/dev` harness (deleted before commit): header gaps measured
  24px/24px; heatmap contrast as above; a stored `***bold and italic***` run
  renders bold+italic, and selecting a word then pressing Bold and Italic in
  the real toolbar renders both and saves `***word***`; the confirm dialog
  follows the theme.
- `prepareImageForUpload` in a real browser: 10.4MB 4000×3000 PNG → 746KB
  1600×1200 WebP (305ms); 3.1MB transparent PNG → 751KB WebP; a 358KB JPEG
  left untouched. (Synthetic noise images, the worst case for compression.)
- `photo-url-cache` behaviour checked in the browser: same object reuses its
  first URL; a URL within 5 minutes of expiry is replaced; non-signed URLs
  pass through; a cover change replaces the remembered list thumbnail.
- `pnpm lint` (no warnings), `pnpm typecheck` 7/7, `pnpm test` (73 passed,
  2 skipped), `pnpm build` all pass.

### Not independently verified

- Photo load times on the live deploy (needs this branch deployed).
- Photos uploaded before this change stay full-size; see
  docs/KNOWN-ISSUES.md.

## 2026-10-13 (follow-up) — GitHub-style journal activity heatmap replaces the date-picker calendar

### Added

- **`JournalHeatmap`** (`packages/ui/src/components/journal-heatmap.tsx`): a
  GitHub-contribution-style activity grid, replacing `CalendarPicker` inside
  the Journal screen's "Date" filter sheet (now titled "Your activity"). A
  compact single-month grid by default (weekday rows, rounded cells, month
  prev/next, an Expand button) that expands in place — no navigation, no
  modal — into a full continuous Jan-Dec week-column grid for the whole
  year, with month labels, a year selector, and totals (days written,
  entries, current streak). Selecting a day shows its details **inline,
  directly beneath the grid, in normal document flow** — date, entry count,
  each entry's title/snippet/time, a tap-to-open link, or a quiet "No
  entries for this day" message — never a popup, tooltip, or overlay, per
  explicit instruction. Five intensity levels (0 = no entries, 1-4
  increasing) drawn from the app's own mint scale via plain `bg-mint-*`
  Tailwind utilities (confirmed these are real generated classes, not just
  `var(--color-mint-*)` inline styles the way the river graph uses them).
- **`EntriesRepository.countsByDateForUser`** (new): entry counts grouped by
  `entry_date`, scoped and filtered identically to the existing
  `listEntryDatesForUser` (non-deleted, non-archived, optional `type` and an
  inclusive date range) — no schema change, reuses the already-indexed
  `(user_id, entry_date)` column.
- **`lib/services/heatmap.service.ts`** (new): `getMyMonthHeatmap`,
  `getMyYearHeatmap` (totals + a streak computed purely by walking backward
  day-by-day from today through the same count data, never stored — "today
  has nothing yet" doesn't break a streak that's still alive, one full
  missed day does), and `getMyEntriesForDay` (reuses `listMyEntries`'
  existing date-range filtering and plain-text snippets rather than a new
  query shape). One new route, `GET /api/entries/heatmap`, picks between the
  three shapes via `month=`/`year=`/`date=`.
- 9 new unit tests (`heatmap.service.test.ts`): intensity bucketing, correct
  month boundaries including a leap-year February, streak continuity/break/
  "yesterday still counts" cases, and that a past year never reports a
  "current" streak.
- Removed the now-dead `entryDates` prop from `EntryListScreen` and the
  `entryDatesFrom` helper it was the only caller of, once the heatmap
  replaced the only thing that used them (the old calendar's dot
  indicators).

### Fixed

- **The full-year grid initially rendered as entirely blank**, even though
  the stats footer below it (fed by the same data) was correct — found by
  checking the DOM directly rather than trusting the screenshot: a cell's
  computed background color and class were exactly right, just positioned
  hundreds of pixels to the right of the visible viewport, because the
  52+-column grid defaults to showing January and nothing auto-scrolled it
  into view. Fixed by auto-scrolling to the current month (or December, for
  a past year) when the year view opens — the same lesson as the River of
  Memories work earlier this session: a wide horizontally-scrolling SVG/grid
  needs an explicit initial scroll position, or real data silently reads as
  empty.

### Verified

Live, with a throwaway seeded account (deleted after): a 3-day current
streak, a 3-entry "busy day," and two scattered single-entry days produced
exactly the month/year grid intensities and stats (6 days written, 8
entries, 3-day streak) the fixture was built to produce. Interaction-tested
via real DOM queries, not just screenshots: clicking a day cell opens its
inline detail with the right entries and times; clicking an empty day shows
the quiet "No entries for this day" message after a brief load; month
prev/next and year prev/next both refetch and re-render correctly; a past
year with zero activity shows all-neutral cells and a 0-day streak, never a
manufactured pattern. `pnpm lint`/`typecheck`/`test` (75 pass)/`build`
green; `/journal`'s bundle is 185kB — essentially unchanged (if anything
smaller, since `react-day-picker`'s lazy chunk is no longer loaded there at
all; `JournalHeatmap` has no heavy dependency).

## 2026-10-13 (follow-up) — "River of Memories" replaces the bubble mindmap; "Past Self" renamed "Re-live Me"

### Added

- **River of Memories visualization** (`apps/web/app/(protected)/river/`: `river-graph.tsx`,
  `river-explorer.tsx`, `river-panel.tsx`, `river-modal.tsx`), replacing the old
  circle-and-force-layout mindmap entirely (`mindmap-graph.tsx`,
  `mindmap-explorer.tsx`, `mindmap-panel.tsx`, `mindmap-modal.tsx` deleted). Each
  recurring theme is one smoothly-curved, organic path flowing left to right
  across a real calendar timeline, split into separate visible segments
  wherever the theme actually went quiet for a month or more (never a straight
  line glossing over silence); line thickness scales with how many entries
  that month had; small dots mark individual journal entries, with a larger
  hollow ring for a theme's first-ever appearance or its return after a gap;
  a dashed connector plus a marker shows where two themes' paths crossed
  because a real entry belonged to both in the same month. No clustering or
  labeling changed — this reuses the exact same `mindmap_clusters` /
  `mindmap_cluster_entries` rows and recompute pipeline from Phase 6.7, only
  the read/shape layer and the UI are new.
- **`getMyRiver()`** (`lib/services/mindmap.service.ts`, replacing
  `getMyMindmap()`) groups a user's clusters by **exact label match** into one
  "theme" per distinct label spanning every month it appears in (never a
  fuzzy/semantic merge — a theme named "Home" and one named "Home life" stay
  two separate paths, so a connection is never invented). From that it derives,
  purely from stored dates with no LLM call: each month's point and milestones,
  which milestone is a theme's first appearance, which is a return after a
  real calendar gap (and what the previous active month was), every
  cross-theme intersection in a shared month, and at most one evidence-grounded
  insight (the most recent "returned after a gap" moment, skipping anything
  under a 2-month gap). `MindmapRepository.listClusterEntryDetailsForUser`
  (new) fetches every entry across every cluster for a user in one query.
- **Time-range selector** (3 months / 6 months / 1 year / all time) fetches the
  whole history once and slices it client-side for instant switching, per the
  existing "opening this view is a plain DB read" philosophy. The cutoff is
  anchored on the most recent month the user actually wrote in, not the
  device's current date — otherwise anyone whose last entry isn't from the
  last few real-world months would see "last 3/6 months" come back empty.
- **Detail panel** (BottomSheet) for all three tappable things the brief asked
  for: a theme (first/most-recent appearance plus every entry), a milestone
  (date, excerpt, link to the full entry, and "returned after a gap" context
  when applicable), and an intersection (which two themes, which entries,
  worded as "a connection the data supports, not an interpretation of why").
- **"Past Self" renamed "Re-live Me"** everywhere user-facing (screen heading,
  bottom-nav/top-right label, aria-labels). Internal module/function names
  (`past-self.service.ts`, `lib/past-self/sessions.ts`, the `/chat` route)
  are unchanged — purely a renaming of user-visible text, not the underlying
  session feature.
- Unit tests (`lib/services/mindmap.service.test.ts`, 11 new) covering exact
  grouping, first-appearance/gap-return detection (including "only the
  month's first entry gets the gap-return flag, not every entry that month"),
  intersection detection (including never-self, never-cross-month), insight
  selection (threshold and most-recent-wins), and month collection for the
  time axis.

### Fixed

- A theme's inline label (drawn beside its path) could render partly or
  entirely off the left edge of the SVG canvas, since no space was reserved
  for it. Fixed by reserving a label gutter sized to the longest label
  actually present, rather than drawing labels into whatever space happened
  to be left of month 1.
- A theme active in only one visible month rendered as an invisible
  zero-length path segment. Fixed by drawing a single-point segment as a
  short visible stub instead.
- The time-range cutoff computed "N months ago" from the device's current
  date rather than the most recent real entry, so the compact preview (and
  any range) could render almost empty for a user whose writing isn't recent
  by wall-clock time. Both found and fixed via a live check with seeded data
  spanning January–June, which is "in the past" relative to October 2026.
- An intersection's dashed connector line sat on top of nearby milestone
  dots in z-order and silently absorbed clicks meant for them (confirmed via
  `elementFromPoint` at the dot's exact screen coordinates returning the
  line, not the dot). Fixed by making the connector line and a milestone
  dot's background halo both `pointer-events: none`, so only the actual
  interactive circle underneath is ever hit-tested.

### Verified

Live, with throwaway seeded accounts (deleted after, cascade confirmed on
`entries` and `mindmap_clusters`): a known shape (Work active Jan–Mar; Home
active Jan then June with a 5-month gap; Gratitude appearing only in June,
sharing June's entry with Home) produced the river, insight text, and
cutoff-anchored preview this session expected. Interaction-tested, not just
rendered: a real `elementFromPoint`-verified mouse click that lands on the
path itself (away from any dot) opens the theme sheet with the right three
entries; a click on a milestone dot opens that exact entry's detail; a click
on an intersection marker opens the right two-theme explanation; an account
with zero history shows the gentle empty state, never a manufactured
pattern. `pnpm lint`, `typecheck`, `test` (66 pass) and `build` green;
`/chat` and `/chat/[sessionId]` bundle size unchanged from the old mindmap
(186kB / 183kB).

## 2026-10-13 (follow-up) — Top-right tab icons, chat soft-delete column, OpenRouter model swap

### Fixed

- **Summarization and Chat-with-Past-Self were both broken end to end.**
  `OPENROUTER_MODEL=nvidia/nemotron-nano-9b-v2:free` now 404s on OpenRouter
  ("No endpoints found" — the model has been retired upstream); every call
  through `OpenRouterLLMProvider.complete()` failed, which is both of these
  features (embeddings were unaffected — a different model/endpoint).
  Switched `OPENROUTER_MODEL` to `nvidia/nemotron-3-super-120b-a12b:free` in
  `.env.local` and `.env.example`, after confirming live against OpenRouter
  that it (a) actually completes instead of burning its whole budget on
  hidden reasoning like the other free Nemotron variants do, and (b) produces
  correct output against the real summarize prompt (summary + `===TASKS===`
  block) and the real grounded persona-chat prompt. Verified against the
  live app with a throwaway seeded entry: `/api/entries/[id]/summarize` and
  a `/api/chat/[sessionId]/messages` call both succeeded with correct,
  properly-cited output.

### Changed

- **Bottom nav bar removed.** Past Self and Integrations are now icons at the
  top right of Home/Past Self/Integrations, just left of the account avatar
  (`TabHeaderActions`, shared by all three screens), matching a direct
  screenshot from the user. Icons changed to Hourglass (Past Self) and Puzzle
  (Integrations) to read more clearly as distinct destinations. Swipe-between-
  tabs navigation is unaffected.
- Added `chat_sessions.deleted_at` (migration `0012`, additive) and filtered
  it into every `ChatRepository` read, so conversations can be soft-deleted
  like entries.
- **Past Self no longer lists entries**, only conversations — entries stay on
  /journal. `SessionCard` drops the whole Entries section; a session's
  "empty" state is now judged on conversations for collapsing, but "Ask your
  past self" still only shows when the session actually has entries to
  ground on.
- **Free-tier cap: 2 conversations per half-year session.**
  `MAX_FREE_CONVERSATIONS_PER_HALF` in `persona-chat.service.ts`; starting a
  3rd soft-deletes the oldest live one in that half automatically (never a
  hard delete). Not configurable per plan yet — see docs/DECISIONS.md.
  Conversations can also be removed individually via swipe-to-delete (new
  `DELETE /api/chat/[sessionId]` route, `ChatRepository.softDeleteSession`).
  Verified live: creating a 3rd conversation in the same half auto-dropped
  the oldest, leaving exactly 2; the UI shows "x/2 on the free plan".

## 2026-10-13 (Past Self + journal editor) — Half-year sessions, inline pictures, sharing, transcript view

### Added

- **Bottom nav is only Integrations and Past Self.** Mindmap lives inside Past
  Self (compact panel with an Expand button that opens an animated popup; closing
  it returns to the same scroll position and focus). `/mindmap` redirects to
  `/chat`. Home keeps Today and drops Week.
- **Past Self sessions.** Each year shows exactly two six-month sessions
  (January – June, July – December), each with a descriptive unique name, the
  year and date range, expandable/collapsible, newest year first. Entries are
  assigned by date, empty sessions are shown but not expandable, there is no cap.
  Conversations are grounded on exactly that half-year (`chat_sessions.persona_half`).
- **Fully editable journal.** Inline-editable title, autosaving body with a
  Saved indicator, flush on Back/tab-hide/unmount, and a leave-page guard.
- **Inline pictures** inserted at the cursor (`Add a picture`), sized S/M/L/Full,
  aligned left/centre/right (small left/right pictures let text wrap), moved,
  captioned, removed. The cover stays a separate action (`Change cover`).
  Stored as `![alt](mindreva-photo:<photo id>?size=&align=)` in the Markdown body;
  no URLs are saved, so nothing expires.
- **Sharing.** Share button with an explicit Private/Public choice, copyable link,
  per-person access for private links, Stop sharing, and a status badge.
  `/s/[token]` is a read-only page that shows inline pictures.
- **Transcript view** for audio journals: timestamped, chronological blocks,
  jump-to-time, text only (no audio player). New recordings store ASR segments;
  older ones can be given timestamps by re-running ASR on the stored recording.
- Migrations `0010` (additive: `entry_photos.kind`, `transcripts.segments`,
  `chat_sessions.persona_half`, `entry_shares`, `entry_share_recipients`) and
  `0011` (RLS, owner policies and grants for the two share tables).

### Fixed

- A server component calling `buttonVariants` from the client `button.tsx` crashed
  both `/s/[token]` and its not-found page; the variants now live in
  `button-variants.tsx` (importable from server code).
- Adding a share recipient as a non-owner returned 201 without doing anything;
  it now returns 404.
- Timestamp backfill for an entry with no recording returns 404 instead of 500.
- `@mindreva/types` no longer relies on `URLSearchParams`/`matchAll` (that package
  has no DOM lib, so `pnpm typecheck` failed).

### Verified

Unit tests (55 pass, including session grouping, transcript segments and the share
access rules), and headless-browser runs against the live Supabase project with
throwaway users: Past Self 22/22, editor 17/17, sharing 18/18, transcript 7/7.
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` green. The throwaway
users, their rows and storage objects were deleted afterwards.

## 2026-10-13 (follow-up) — Neutral surfaces, one phone-width column everywhere

Direct feedback on the redesign: it read as "everything green", and the web
version should look like the phone version.

### Changed

- **Colour roles.** Surfaces and text are neutral again: warm off-white page
  (`#f8f6f2`), white cards, near-black ink (`#15181c`), grey secondary text
  (`#5d636d`, 5.3-6.0:1), warm-grey hairlines. Green is reserved for actions and
  accents (primary buttons, active tab, avatar, focus ring, icon tiles, selected
  tint, the logo). Shadows are neutral grey instead of green-tinted. Dark mode
  follows the same rule (neutral near-black surfaces, mint actions).
- Removed the green card washes (record card, mindmap area, empty states),
  mint hover states (now neutral), mint calendar day cells, and the green-tinted
  summary card on the entry screen (now a white card; its label keeps the green).
- **Web = phone.** The app is one phone-width column (30rem) at every screen
  size. On a wide screen it sits centred on a white canvas with hairline sides
  (`.app-frame`, new `--canvas` token). The desktop sidebar and every `md:`/`lg:`
  responsive rule were removed; the floating tab bar and avatar are the same
  everywhere, and bottom sheets stay bottom sheets instead of becoming centred
  dialogs.

### Removed

- `side-nav.tsx` and the `bg-gradient-halo` token/utility.

## 2026-10-13 — Apple-inspired redesign: unified Past Self + Mindmap, Integrations, dark mode

Reference screens in `docs/new-design-reference/` (a purple app) were used for
layout, hierarchy and interaction patterns only; everything is rendered in
Mindreva's green-and-white palette with Mindreva's leaf mark. Not on the
roadmap, so it is recorded here and in DECISIONS.md.

### Added

- **Past Self + Mindmap as one workspace.** New `MindmapExplorer` (graph, theme
  sheet, empty state) and `MindmapPanel` (collapsible card, animated, choice
  remembered per device, graph mounted lazily on first open). `/chat` shows the
  panel above the period picker, open by default; `/chat/[sessionId]` shows it
  above the conversation, collapsed by default. `/mindmap` stays as the full
  view and uses the same explorer. Chat pages load the map in parallel and fall
  back to an empty map if that query fails.
- **Integrations.** `/integrations` screen, `IntegrationCard` (coming soon,
  connecting, connected + settings area, disconnecting, info/success/error
  feedback), `GET /api/integrations`, `POST /api/integrations/[id]/connect`,
  `DELETE /api/integrations/[id]`, `integrations.service.ts`, and an
  `IntegrationProvider` interface + registry in `apps/web/lib/integrations/`.
  Google Calendar is a deliberately inert provider (`isConfigured() === false`):
  no OAuth, no token storage, no sync. `/integrations` added to the middleware's
  protected prefixes.
- **Account menu.** Avatar opens a sheet (profile, recording-time usage,
  Integrations, Account & settings, dark-mode switch, sign out). The layout
  passes the account as an un-awaited promise resolved in Suspense, so pages are
  not held back by the profile query. `getMyProfile` is now request-cached.
- **Dark mode**, real and persisted (`mindreva:theme`, else the OS setting),
  applied by a `<head>` script before first paint so there is no flash.
- **Shared UI:** `IconTile`, `ExpandablePanel`, `ProcessingSteps`; richer
  `EmptyState`; `ink` button variant; brand gradient/halo/glass utilities;
  `press` feedback; soft two-level shadows; `animate-page-in` route entrance via
  `(protected)/template.tsx`; global `prefers-reduced-motion` guard.
- `/dev/redesign` (non-production) shows every new component and state with
  sample data.

### Changed

- **Navigation is now the three core experiences:** Home, Past Self, Mindmap
  (floating frosted tab bar on mobile, sidebar on desktop, one shared config).
  Account moved behind the avatar; swipe order and tab prefetching updated.
- **Home:** date eyebrow, weekday title, time-of-day greeting, Integrations and
  avatar buttons, halo record card, empty state with icon.
- **Recording screen:** live indicator, large elapsed time, red stop button in a
  halo, "Discard recording". **Transcribing** is a stepped card driven by the
  real transcript status (`pending` = Queued, `processing` = Transcribing); the
  failure state uses the same card.
- **Auth screens:** brand tile, large heading, dark Google button, no card chrome.
- **Account page:** back button, Integrations and Appearance rows, red sign out;
  selected option cards use a soft tint instead of a solid mint block.
- Past Self conversation: gradient user bubbles, frosted sticky composer.
- Dark-mode destructive colour lightened (`#b91c1c` was 1.95:1 on the dark
  background, now 4.55:1).

### Fixed

- Mindmap layout produced last-digit float differences between the server's Node
  and the browser (`Math.hypot`), causing a hydration mismatch. Coordinates are
  now rounded to 2dp. The layout is also centred and trimmed, so a handful of
  themes no longer sit under a tall empty canvas.

### Verification

`pnpm lint` (only the pre-existing `<img>` warning), `pnpm typecheck`,
`pnpm test` (2/2) and `pnpm build` pass. UI checked in headless Edge at 390px and
1280px, light and dark, signed in as a temporary test user with seeded entries
and clusters (deleted afterwards, cascade confirmed), with zero console errors.

## 2026-10-12 — Perf: tab navigation served from the Router Cache, Chat no longer wipes it

Reported directly: the deployed app feels slow; question was whether the
database needs moving. Measured on the live deploy with Playwright from the
team's location (Bangladesh), signed in to a real account.

### Found

- **The database is not the bottleneck.** Medians per request: static page
  from the Mumbai edge 62-82ms; reaching the Tokyo (`hnd1`) function with no
  auth and no DB ~230ms; the same with a valid session (auth, no DB)
  ~290-380ms; real pages doing 1-5 parallel queries (journal, mindmap,
  account, entry detail) all ~445-460ms. DB work adds ~70ms regardless of
  query count. The rest is the user → `bom1` edge → `hnd1` function hop,
  which moving only the database cannot change. `getClaims()` was confirmed
  verifying locally (the session's access token is ES256), so auth isn't the
  cost either.
- **Opening Chat emptied the whole client Router Cache.** `ChatHome` called
  `router.refresh()` on every mount. That fetched `/chat` twice per visit
  and, since `refresh()` resets the prefetch cache, made every other tab
  re-fetch afterwards: revisiting Mindmap/Journal took 16-24ms with no
  request before visiting Chat, 360-400ms after.
- **Hover/touchstart prefetch barely helps on phones.** Where a prefetch had
  already landed, a tab opened in ~112ms with no request; a phone's
  touchstart gives only ~100ms of head start on a ~450ms request.
- `/chat` and `/account` had no `loading.tsx`, so a tap froze on the old
  screen until the server answered (account: 511-826ms).

### Fixed

- `chat-home.tsx`: refresh only on the first mount after starting a new
  session (a one-shot `sessionStorage` flag set in `startSession`), not on
  every mount.
- `app-shell.tsx`: on every tab screen, fully prefetch `/chat`, `/mindmap`
  and `/account` (skipping the current one). A full prefetch is cached for
  `staleTimes.static` (Next's default, 5 minutes), so tab taps render from
  memory. `/journal` deliberately excluded, see docs/DECISIONS.md.
- `use-full-prefetch.ts`: the `{ kind: "full" }` cast extracted into a shared
  `prefetchFull()` used by both `usePrefetchOnIntent` and the shell.
- New `chat/loading.tsx` and `account/loading.tsx` skeletons.
- `app-shell.tsx` also re-prefetches after every `router.refresh()`
  (`children` added to the effect's deps). In Next 15.5 a prefetch writes
  into the router's live cache map, and a refresh replaces that map once its
  fetch resolves, so prefetches made just before or during a refresh
  (archive/trash, transcription toast, sign-in) were silently lost.
- `auth-form.tsx`: dropped the `router.refresh()` after sign-in/sign-up.
  Both branches already navigate to a new route rendered with the new
  cookies; the queued refresh rendered `/journal` a second time (three
  `/journal` requests per sign-in were measured live) and emptied the cache.
- `getMyEntryDetail`: photo signing chained onto its own query inside the
  existing `Promise.all`, so the Storage round trip overlaps the other four
  queries instead of running after them. Saves one sequential Storage call
  on entries with photos; not measured, since the test account has none.

### Verified

- `pnpm lint` (only the pre-existing `<img>` warning in `entry-detail.tsx`),
  `pnpm typecheck` 7/7, and `pnpm build` with CI's placeholder env vars all
  pass; route sizes unchanged (176-180kB First Load JS).

### Verified live (2026-10-14)

Re-measured on the production deploy with the same Playwright method (same
location, same account, taps dispatched without hover so prefetch gets no
head start, as on a phone). The build was confirmed live first by checking
for strings only the new code contains. By then the navigation had been
redesigned to Journal (home), Chat and Integrations, and `PREFETCHED_TABS`
updated to `["/chat", "/integrations"]` to match, so the tab tests use
those routes.

| Scenario                                         | Before (2026-10-12)                    | After (2026-10-14)            |
| ------------------------------------------------ | -------------------------------------- | ----------------------------- |
| Tap a tab from Journal, then Back                | 300-830ms each                         | 15-33ms, no server request    |
| Second round of taps, after opening Chat         | 360-400ms (Chat had emptied the cache) | 15-27ms, cache intact         |
| Chat tab after 35s idle                          | ~450ms                                 | 27ms (5-minute full prefetch) |
| Sign-in → Journal content                        | ~2.3s, 3 `/journal` requests           | 1.48s, 1 `/journal` request   |
| Back to Journal after 35s idle                   | ~450ms                                 | 493ms (unchanged by design)   |
| Server time per page (journal, chat, account, …) | ~445-460ms                             | ~440-450ms (not targeted)     |

Opening Chat no longer re-fetches `/chat` twice or invalidates other tabs.
Server time per page is unchanged, as expected: these fixes avoid round
trips rather than make them faster.

### Not independently verified

- The `getMyEntryDetail` photo-signing overlap: the test account has no
  entries with photos.
- A new chat session appearing on return to Chat (the one-shot refresh
  flag): not exercised live, to avoid creating data in a real account.

## 2026-09-27 — Fix pass on the UI redesign (`feature/ui-update`)

A code audit of the 2026-09-24 redesign found one data-loss bug and several
broken mobile interactions. All fixed on the same branch.

### Fixed

- **Recording could be silently discarded.** The new protected layout put the
  bottom nav and side nav on `/record`; tapping a nav item mid-recording
  unmounted the recorder (mic stopped, nothing uploaded, no warning, since
  `beforeunload` doesn't fire for in-app navigation). New
  `_components/app-shell.tsx` now renders both navs only on tab/list pages and
  hides them on focused flows: `/record`, `/notes/new`,
  `/entries/[id]/review`, `/chat/[sessionId]`.
- **Bottom nav covered controls.** Hiding it on the focused flows above frees
  their Save/Stop/Send controls; Archive, Trash and entry detail (plus its
  loading skeleton) now reserve `pb-24` on mobile.
- **Row swipe also switched tabs.** `SwipeNav` now ignores touches that start
  inside a `SwipeableRow` (new `data-swipeable-row` attribute), form fields,
  editable content, or a dialog/bottom sheet. Its scroll-to-top effect was
  removed so returning to a list keeps its scroll position (Next already
  scrolls to top on forward navigation).
- **Hydration mismatch on every list page in production.** Card timestamps
  and the header date were formatted in the server's time zone (UTC on
  Vercel) and again in the viewer's. They now render only after hydration via
  a new `lib/use-hydrated.ts` hook, with a non-breaking-space placeholder so
  card height doesn't shift.
- **Chat back button** restored to `router.back()` with a `/chat` fallback
  (the redesign had reverted the 2026-08-16 back-navigation fix).
- **Corrupted Urdu text** in the auth layout ("اردو" had its last letter
  replaced by the Bengali vowel sign U+09C1).
- **Error/success toasts** were visually identical after the redesign; red and
  green text restored in `packages/ui/src/components/toast.tsx`.

### Changed

- Journal/Notes headers show the section name ("Journal"/"Notes") as the
  heading again, with the weekday and date on the small line above it.
- Card dates include the year for entries from a previous year; durations
  under a minute show seconds again ("37 s").
- `--muted-foreground` darkened `#5a7a68` → `#4d6b5a` (5.2:1 on `--muted`,
  was 4.2:1, below WCAG AA).
- Filter pills fit 320px screens (tighter padding, icons hidden under 360px).
- Replaced off-palette Tailwind grays in `OptionCard` and `TaskChecklist`
  with design tokens.

### Removed

- Unused `showChatLink`/`floatingAction` props on `EntryListScreen` and the
  now-unrendered `journal/record-entry-button.tsx` (the journal screen's
  "Start recording" card replaced it).

## 2026-09-24 — Responsive design: desktop and tablet layout

Added full responsive layout support for tablet and desktop breakpoints, on top of the existing mobile-first design.

### Added

- `apps/web/app/(protected)/layout.tsx` — new Next.js App Router layout for the protected route group; renders `SideNav` (desktop/tablet sidebar) + `BottomNav` (mobile only, now `md:hidden`); both are in one place instead of spread across every screen.
- `apps/web/app/(protected)/_components/side-nav.tsx` — fixed left sidebar: icon-only at `md` (56px, `w-14`), icon + label at `lg` (224px, `w-56`); active state matches BottomNav's pill style; uses `PrefetchLink` for hover-intent prefetching like every other nav element.

### Changed

- `BottomNav` — added `md:hidden` so it is a mobile-only component; no longer rendered by individual screens.
- Removed `<BottomNav />` from all individual screen files that previously rendered it directly (`entry-list-screen.tsx`, `chat-home.tsx`, `mindmap-screen.tsx`, `account/page.tsx`).
- Main content containers across all protected pages — widened from `max-w-md` only to `max-w-md md:max-w-2xl`; bottom padding changed from `pb-24` to `pb-24 md:pb-10` (no bottom nav on desktop) wherever applicable.
- Notes "+" button — the floating button is now mobile-only (`md:hidden`); on tablet/desktop a "New note" button sits next to the search field instead.
- All page `<main>` elements gain `md:ml-14 lg:ml-56` via the layout wrapper div to offset them away from the fixed sidebar.
- Visual redesign across `packages/ui`: new four-colour mint palette with hard-coded hex tokens (replacing the warm scale), all shadows removed, pill-shaped buttons/inputs/tabs/filter pills, card radius raised to 16px. See docs/DECISIONS.md (2026-09-24).
- `NoteCard` redesigned: date+time and a duration chip on top, larger two-line title; the leading weekday/day badge was removed. List screens now show the entry's `createdAt` time rather than only its `entryDate`.
- Journal screen: a large "Start recording" card replaces the floating record button; header back arrows removed from tab screens (navigation is via the nav bars).
- New swipe-left/right between tabs on mobile (`_components/swipe-nav.tsx`).
- Bottom sheets become centred dialogs on tablet/desktop; toasts restyled flat.
- Landing page simplified; signed-in users visiting `/` are redirected to `/journal`.
- Shared components extracted: `ConfirmTrashDialog`, `EmptyState`, `PageHeader`, `trashSwipeAction`, `lib/format-entry.ts`.

## 2026-08-16 — Perf: extended hover/touch prefetching to every remaining nav link

Reported directly: some screens still showed a loading state despite the
region pin and the earlier prefetch work.

### Found

- `PrefetchLink` (added earlier the same day) was only wired into links
  going to `/entries/[id]`. Every other cross-screen navigation — the
  header icons for mindmap/chat/account on journal & notes, account's links
  to archive/trash, and every screen's own back arrow (archive→account,
  trash→account, chat→journal, mindmap→journal) — was still a plain
  `next/link`, meaning it only got `PrefetchKind.AUTO` (static shell only)
  from Next's default. None of those got the hover/touch-intent head start,
  so tapping into any of them still waited for the fetch to start only once
  the tap landed.

### Fixed

- Replaced every remaining plain `<Link>` to a _dynamic_ destination with
  `PrefetchLink` across `entry-list-screen.tsx` (mindmap/chat/account
  header icons), `account/page.tsx` (back-to-journal, archive, trash),
  `archive-list.tsx` and `trash-list.tsx` (back-to-account),
  `chat-home.tsx` (back-to-journal, every past-conversation row), and
  `mindmap-screen.tsx` (back-to-journal).
- Deliberately left as plain `<Link>`: anything pointing at a **static**
  route (`/notes/new`, `/record`, `/privacy`, `/terms`, `/support`) —
  those are prerendered (`○` in the build output), so `next/link`'s default
  prefetch already fetches them fully; wrapping them would add nothing.

### Verified

- `pnpm lint` (0 warnings after removing two now-unused `Link` imports in
  `archive-list.tsx`/`trash-list.tsx`) and `pnpm typecheck` (7/7) pass.
- `pnpm build` succeeds with no meaningful bundle-size change.

### Not independently verified

- The in-browser feel of these specific navigations after the fix — same
  limitation as every prefetch-related change in this file: hover/touch
  timing racing a network request can't be verified with `curl`. Worth a
  manual check across the newly-wired links (journal→mindmap, journal→chat,
  journal→account, account→archive, account→trash, chat home→a past
  conversation).

## 2026-08-16 — Perf: pinned the Vercel function region to Tokyo, closing the real remaining gap

Reported directly: every screen still felt slow on its first visit each
session, even after the prefetch/caching fixes above — those only help
_repeat_ visits and taps into a list you're already on, not the very first
request after signing in.

### Found

- Re-measured the LIVE deploy specifically (prior rounds had only re-verified
  locally, which was the gap) with fresh accounts and repeated hits: `/mindmap`
  (a route doing almost no work) landed flat at 656-681ms across _confirmed
  warm, confirmed reused_ function instances — ruling out cold starts and
  ruling out the connection-reuse question already resolved earlier.
- `x-vercel-id` on every request read `bom1::iad1` — the function was
  running in `iad1` (Washington, D.C., USA East), while Supabase is in
  `ap-northeast-2` (Seoul). That transcontinental hop, paid on every single
  request regardless of what the route actually queries, was the flat ~660ms
  floor. Local testing never showed this because a local machine talks to
  Seoul directly, with no US detour in the path.

### Fixed

- Added `vercel.json` at the repo root with `"regions": ["hnd1"]` (Tokyo) —
  confirmed against the user's own Vercel dashboard (Settings → Functions →
  Function Region) as a real, available option before committing to it,
  rather than guessing the region code from memory. Tokyo is the closest
  available Vercel region to Seoul; direct Seoul (`icn1`) was also listed
  but Tokyo was the one selected. The dashboard setting was changed by the
  user directly (from the default North America region); this file makes
  that choice durable in the repo instead of only living as a
  dashboard setting someone could later revert without realizing why.

### Verified

- `vercel.json` is valid JSON.
- The dashboard's Function Region screenshot confirms `hnd1` — Tokyo,
  Japan — as the now-selected region, matching this file.
- **Re-measured the live deploy after the redeploy rolled out**, same
  methodology as the original diagnosis (fresh account, repeated hits to
  `/mindmap`, checked `x-vercel-id`):
  - `x-vercel-id` now reads `bom1::hnd1` on every request — confirms the
    function is genuinely executing in Tokyo, not Washington, D.C.
  - The flat ~656-681ms floor is gone. Warm requests to `/mindmap` now land
    at **323-486ms**, roughly a **45-50% reduction**, and critically no
    longer _flat_ — meaning the remaining time is real per-route work
    (queries, rendering) that further optimization can actually affect,
    rather than being masked by a fixed geography tax every request paid
    regardless of what it did.
  - Every other route checked (`/journal`, `/notes`, `/account`, `/chat`,
    `/archive`, `/trash`) showed the same `bom1::hnd1` routing and landed in
    the 323-546ms range, down from the prior flat ~660-870ms band measured
    across all of them.

## 2026-08-16 — Perf: prefetch entry data on hover/touch-intent, not just on-visible

Follow-up to the back-navigation fix above — the remaining gap was the
_first_ tap into any entry, not just revisits. Asked directly why other
products feel instant on every tap, not just repeat ones.

### Found

- `next/link` already auto-prefetches when a link scrolls into view
  (confirmed by reading `next/dist/client/link.js` — it uses an
  `IntersectionObserver`), but for a dynamic route like `/entries/[id]`
  (reads cookies/session per request) that default prefetch
  (`PrefetchKind.AUTO`) only warms the route's static shell, not its real
  data — deliberately, so a long list doesn't fire a database query for
  every row merely visible on screen. Confirmed the same in the type
  definitions (`PrefetchKind.AUTO`'s own doc comment: "if the page is
  dynamic, prefetch the page data **partially**").
- Getting the actual entry content prefetched requires opting a specific
  link into `PrefetchKind.FULL`, which isn't exported from the public
  `next/navigation` types (it's an internal enum) but is accepted as its
  literal string value by `router.prefetch()` — confirmed by writing the
  call both ways: the bare string literal fails typecheck (enums aren't
  structurally typed even when string-valued), a cast makes it pass.

### Added

- `usePrefetchOnIntent` hook
  (`apps/web/app/(protected)/_components/use-full-prefetch.ts`) — returns a
  handler that fires `router.prefetch(href, { kind: "full" })` once, on
  first call.
- `PrefetchLink` component
  (`apps/web/app/(protected)/_components/prefetch-link.tsx`) — a
  `next/link` wrapper that wires that handler to `onMouseEnter` and
  `onTouchStart`. On mobile, `touchstart` fires before the tap it's part of
  fully registers, which is enough of a head start for the request to a
  geographically distant pooler to make real progress before the
  navigation commits.
- Wired into every link to `/entries/[id]`: `EntryListScreen`
  (journal/notes — the highest-traffic path), `ArchiveList`,
  `mindmap-screen.tsx`'s cluster-entry list, and `chat-conversation.tsx`'s
  citation chips. `TrashList` deliberately excluded — trashed entries
  already don't link to the detail route at all (it 404s on soft-deleted
  rows, per that file's own existing comment), so there was nothing to fix
  there.

### Verified

- `pnpm lint` and `pnpm typecheck` pass; `pnpm build` succeeds with no
  meaningful bundle growth (`/journal`'s First Load JS 177KB → 178KB).

### Not independently verified

- The actual in-browser feel of tapping into an entry for the first time.
  Like the back-navigation fix above, this is fundamentally a client-side
  browser behavior (hover/touch timing racing a network request) that
  cannot be verified with `curl` — there's no way to script "does this feel
  instant" from this environment. Worth a manual check: from `/journal`,
  tap a NoteCard you haven't visited yet and see if the detail page appears
  noticeably faster than before, especially on a touch device where
  `touchstart` gets a real head start over the completed tap.

## 2026-08-16 — Perf: fixed back-navigation reloading pages from scratch

Reported directly: navigating journal → entry detail → back (via the app's
own back arrow, not the browser's) reloads the journal page from scratch;
the browser's own native back button is instant. That contrast was the key
clue — the browser's back button can use its bfcache (a full page
snapshot), a different, lower-level mechanism than anything Next.js
controls.

### Found

- `entry-detail.tsx`'s and `chat-conversation.tsx`'s back-arrow buttons both
  used `router.push("/journal")` / `router.push("/chat")` instead of
  `router.back()`. Functionally similar (same destination), but
  `router.push()` to a URL is always treated as a fresh navigation;
  `router.back()` is what actually lets Next.js's client Router Cache
  restore the page you came from instead of re-running its server component.
- That alone wasn't sufficient, though: checked the installed
  `next@15.5.21`'s actual default config
  (`node_modules/next/dist/server/config-shared.js`) and confirmed
  `staleTimes.dynamic: 0` — Next 15's own default effectively disables the
  Router Cache for any dynamic route (anything reading cookies/session
  per-request, which is every protected page in this app). Under that
  default, even `router.back()` would still force a fresh server request.

### Fixed

- Both back-arrow buttons now call `router.back()`, falling back to the
  original `router.push()` destination only when `window.history.length`
  indicates there's no in-app history to go back to (e.g. a direct/shared
  link straight to an entry).
- Added `experimental.staleTimes.dynamic: 30` to `next.config.ts` — the
  actual fix that makes the above meaningful. Deliberately not raised
  higher: every mutation that needs fresh data on return (archive, trash,
  restore, transcription-complete) already calls `router.refresh()`
  explicitly at its own call site, which bypasses this cache regardless of
  its duration — confirmed by grepping every `router.refresh()` call site
  before making this change, so the only thing a 30s window actually
  affects is pure back/forward navigation with no mutation involved, which
  is exactly the case that should be instant.

### Verified

- `pnpm lint` and `pnpm typecheck` pass; `pnpm build` accepts the new
  `staleTimes` config with no warnings.
- Confirmed via source inspection (not assumption) that
  `staleTimes.dynamic: 0` is genuinely this Next.js version's shipped
  default, and that every existing mutation path already has its own
  explicit `router.refresh()` unaffected by this change.

### Not independently verified

- The actual in-browser feel of back-navigation after this fix. This is a
  client-side router caching behavior that fundamentally cannot be verified
  with `curl` — every `curl` request is a fresh HTTP request with no
  persistent client router state between calls, so there is no way to
  script-verify this from this environment. Needs a real manual check:
  journal → tap an entry → tap the app's own back arrow (not the browser's)
  → confirm it now feels instant, matching the browser's native back button.

## 2026-08-16 — Perf: found and fixed the real ~700ms-per-page cost (sequential Storage calls, not DB connections)

Follow-up to the 2026-08-15 `CalendarPicker` fix — the deploy still felt
slow afterward. Investigated end to end against the real deployed URL with
real authenticated sessions rather than guessing from first principles.

### Investigated and ruled out

- Confirmed middleware's `getClaims()` auth check is genuinely fast (72-91ms
  warm) — not the cause.
- Measured every authenticated page load at a flat 660-800ms with no
  warm-up curve across 15 rapid repeated hits, which read as a
  connection-reuse problem. Added a temporary diagnostic log to
  `packages/database/src/client.ts`'s `getDb()` (module-instance id +
  whether each call reused the existing connection), deployed it, and read
  Vercel's function logs: **`reusedExistingConnection=true` consistently**,
  with the same module instance persisting across a full minute of real
  navigation. The connection singleton was working correctly the entire
  time — that hypothesis was wrong, and the diagnostic (now removed) is
  what proved it rather than leaving it as an assumption.

### Found

- `listMyEntries` and its archived/trashed/search variants ran three
  genuinely sequential steps on every list-screen load: list entries → look
  up which have a cover photo → call Supabase **Storage's**
  `createSignedUrls` (a separate HTTPS service from Postgres, its own round
  trip to Seoul). None of it could be `Promise.all`'d — each step needs the
  previous step's actual result, not just its own inputs.

### Fixed

- Thumbnail signing removed from the initial server render entirely.
  `listMyEntries`/`listMyArchivedEntries`/`listMyTrashedEntries`/
  `searchMyEntries` (`apps/web/lib/services/entries.service.ts`) now return
  entries with no `thumbnailUrl`, via a new `withPlainSnippets` helper
  replacing the old `attachThumbnails`.
- New `getMyEntryThumbnails` service function + `POST /api/entries/thumbnails`
  batch endpoint. New `useEntryThumbnails` hook
  (`apps/web/app/(protected)/_components/use-entry-thumbnails.ts`) fetches
  thumbnails client-side after the list has already painted, only for ids
  not already resolved — wired into `EntryListScreen` (journal/notes),
  `ArchiveList`, and `TrashList`, replacing the inline effect that used to
  live only in `EntryListScreen` for day-thumbnails. Same "defer to lazy
  client fetch" pattern already established for the calendar's day-cell
  thumbnails.

### Verified

- Re-ran the exact same steady-state latency test (10 requests, 1.5s apart,
  same route) before and after: **723ms avg → 281ms avg locally**, a
  ~442ms reduction matching the removed round trips almost exactly.
- `pnpm lint` (6/6) and `pnpm typecheck` (7/7) pass.
- End-to-end against a real authenticated session: created a fresh entry,
  confirmed `/journal` renders it, and confirmed
  `POST /api/entries/thumbnails` returns a correct empty result for an
  entry with no photo (200, not an error) — the shape a real account with
  photos would also get real signed URLs from, same code path as before,
  just relocated off the critical path.
- Temporary `getDb()` diagnostic removed from `packages/database/src/client.ts`
  now that it answered its question.

### Not independently verified

- The in-browser experience of thumbnails appearing a beat after the list
  itself (the intended lazy-load behavior) — no browser tool available in
  this environment. Worth a manual check that this doesn't read as a
  jarring pop-in rather than a graceful fill-in.

## 2026-08-15 — Perf: deferred `CalendarPicker` off the journal/notes critical path

Prompted by a live smoke test on the deployed URL reporting every screen as
slow/laggy, after the `start`-script fix that should have resolved
dev-mode slowness. Investigated by creating a throwaway account and hitting
the deployed URL with a real authenticated session (not just curl-ing an
unauthenticated redirect, which had misleadingly looked fast) — a real
diagnostic, not a guess.

### Found

- **`next build`'s "First Load JS" figure is not the real payload.** It only
  reports a route's own chunk plus the top-level shared framework chunk, not
  every chunk the browser actually fetches on first visit. Measured the real
  number by downloading every asset referenced in an authenticated
  `/journal` response: **~812KB**, not the ~198KB the build report implied —
  reproduced identically from a fresh local production build, confirming
  this is a real code issue, not a stale or Vercel-specific deploy artifact.
- Of that ~812KB, **~164KB (as unminified `react-day-picker`, ~79KB
  minified) was `CalendarPicker`**, imported eagerly at the top of
  `entry-list-screen.tsx` and `dev/components/gallery.tsx` even though the
  calendar lives inside a `BottomSheet` closed by default — most page visits
  never open it. Same category of bug as the `RichTextEditor`/Lexical
  barrel-leak documented in this file's 2026-07-27 entry.

### Fixed

- `CalendarPicker` removed from `packages/ui/src/index.ts`'s barrel (its
  type stays exported — types are erased at compile time and cost nothing at
  runtime, only the value/component export needed isolating). Both
  consumers now import it via `@mindreva/ui/calendar-picker` behind
  `next/dynamic({ ssr: false })`, the same isolation pattern already
  established for `@mindreva/ui/rich-text-editor`.

### Verified

- Confirmed the DayPicker chunk is genuinely absent from `/journal`'s own
  build manifest and from the authenticated page's rendered HTML afterward
  (grepped for its content hash in both) — it now only loads once the date
  picker is actually opened, not on every list-screen visit.
- Real measured payload for `/journal`: **812KB → 738KB (-74KB)**. Smaller
  than the full 164KB estimate, because `react-day-picker` minifies to
  ~79KB in production — still a real, verified reduction, and more
  importantly it's now conditional rather than paid on every visit.
- `pnpm lint` (6/6) and `pnpm typecheck` (7/7) pass; `pnpm build` succeeds
  with `/journal`'s reported First Load JS dropping 198KB → 177KB (a
  correlated, not equivalent, number — see the "Found" note above on why
  that figure understates the true payload either way).
- The deferred chunk was fetched directly from a local production server and
  confirmed to serve correctly (200, not a broken dynamic-import 404); the
  package's `exports` wildcard (`"./*": "./src/components/*.tsx"`) was
  confirmed to resolve `@mindreva/ui/calendar-picker` to the real file.

### Not independently verified

- The calendar's actual in-browser behavior after this change (opening the
  sheet, seeing the loading skeleton, the calendar rendering correctly) —
  no browser tool available in this environment. Build/typecheck/manifest
  checks pass, but a manual check of the real interaction is still worth
  doing.
- Whether this fully explains the "every screen felt slow" report from the
  live smoke test, or whether other routes/interactions have a similar
  eager-import issue not yet found. Recommend re-running the smoke test
  after this ships to see if the perceived slowness is resolved or only
  partially improved.

## 2026-08-07 — Phase 7 (continued): Sentry error tracking wired in

### Added

- `@sentry/nextjs`, hand-configured rather than via the interactive
  `@sentry/wizard` CLI (which needs a browser OAuth login unavailable in
  this environment): `apps/web/sentry.client.config.ts`,
  `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`
  (Next.js's `register()`/`onRequestError` hooks, the SDK's current
  recommended entry point), `app/global-error.tsx` (root-layout crash
  boundary — deliberately styled with plain inline CSS, since it replaces
  the entire `<html>` document and can't rely on `globals.css` or
  `@mindreva/ui` having loaded), and a `withSentryConfig` wrapper around
  `next.config.ts` for source-map upload.
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
  `SENTRY_PROJECT` documented in `.env.example` and `DEPLOYMENT.md`.
- `@sentry/cli` added to `onlyBuiltDependencies` in the root `package.json`
  so its postinstall script (fetches the sentry-cli binary used for
  source-map uploads) runs without pnpm's build-script prompt blocking CI.

### Verified

- **Sentry is a true no-op with no DSN configured** — the state this repo is
  in right now, since no Sentry project has been created yet. Confirmed
  directly: `pnpm build` succeeds with every Sentry var unset, including
  under CI's exact placeholder-Supabase-var build command; `next start`
  afterward serves `/` (200) and an authenticated redirect on `/journal`
  (307) correctly.
- Caught and fixed a real deprecation warning during verification —
  `disableLogger` is deprecated in the installed SDK version in favor of
  `webpack.treeshake.removeDebugLogging`; the build log was clean of it
  after the fix.
- Found two real costs during the same verification pass, not fixed (not
  worth trading away Sentry's actual value):
  - Middleware bundle size roughly doubled (94.6kB → 192kB) once the edge
    config was wired in, confirmed to happen even with no DSN set — the
    config module bundles regardless of runtime activity.
  - The build now emits ~10 Turbopack warnings about
    `import-in-the-middle`/`@opentelemetry/instrumentation` not being
    externalizable — a known Sentry/Turbopack interaction, confirmed
    non-fatal by testing the resulting build actually serves correctly.
    Both documented in `DEPLOYMENT.md` rather than silently accepted.

### Not done here

- No Sentry project exists yet — that's dashboard/account work outside this
  environment's access, same as the other Phase 7 items. `DEPLOYMENT.md`
  has the exact steps to finish activating it once a project is created.

## 2026-08-07 — Phase 7 (continued): DEPLOYMENT.md

Added `DEPLOYMENT.md` at the repo root, closing that checklist item.
References `.env.example` for what each variable is rather than duplicating
its descriptions (avoids drift between the two files); adds the operational
detail `.env.example` doesn't cover — which values are secret, what happens
if each is missing, and where to obtain each one. Also documents: rotating
`SUPABASE_SERVICE_ROLE_KEY` (including verifying the old key is actually
dead afterward, not just assuming), rolling back a Vercel deployment (and
the explicit warning that database migrations do not roll back with it), and
a 10-step production smoke test covering sign-up through onboarding,
recording, transcription, summarization, photos, notes, mindmap, and
persona chat.

Verified the two most load-bearing factual claims in it rather than assuming
them from memory: `packages/asr/src/factory.ts` exists at the path
referenced, and `embeddings.embedding` is genuinely `vector(2048)`
(`packages/database/src/schema.ts:179`), matching the warning that
`OPENROUTER_EMBEDDING_MODEL` must stay a different, fixed-dimension model
from `OPENROUTER_MODEL`.

Explicitly flags two things a deployer needs to know before trusting a
deploy: Preview and Production still share one Supabase project (a
data-safety concern the smoke-test / rollback sections both point back to
docs/KNOWN-ISSUES.md for), and CI's test step is close to vacuous today.

The remaining Phase 7 checklist items (Vercel preview-deploy confirmation,
Preview/Production env separation, branch protection, Sentry, Vercel
Analytics, the live smoke test itself) are dashboard actions or decisions
requiring account access this environment doesn't have — not done here,
tracked as open in docs/roadmap.md's checklist.

## 2026-08-07 — Phase 7 (partial): root `start` script and CI pipeline

Prompted by a slow deployed preview environment. A DevTools capture on
`/journal` showed `turbopack_browser_dev_hmr_client`, a pending `webpack-hmr`
WebSocket, and unminified per-file chunks (`apps_web_app_layout_tsx_*.js`) —
all signatures `next build && next start` cannot produce. Diagnosis first, in
a separate report; this entry is the fix for the two low-risk, deploy-target-
independent items.

### Fixed

- **The repo had no root `start` script**, and `turbo.json` defined no `start`
  task — so a host running `pnpm start` at the root found nothing to run and
  fell back to `pnpm dev`, serving `next dev` in staging. Added
  `"start": "pnpm --filter @mindreva/web start"` ([package.json](../package.json)),
  delegating to `apps/web`'s existing `next start`. Deliberately bypasses Turbo:
  there is no `start` task to run, and adding one would buy nothing.
- **Three packages declared `"types": ["node"]` in tsconfig without depending
  on `@types/node`** (`packages/asr`, `packages/database`, `packages/llm`).
  This never surfaced because those files were only ever typechecked
  transitively through `apps/web`'s program, which does have it. Standalone
  typechecking is new here, so the gap is newly visible — added `@types/node`
  to all three. Found by running the new task before wiring CI around it,
  which is exactly why that ordering matters.

### Added

- **`typecheck` task**, which the Phase 7 checklist assumed existed but didn't:
  `"typecheck": "tsc --noEmit"` in all seven packages that have a tsconfig
  (everything except `packages/config`), a matching `turbo.json` task, and a
  root passthrough.
- **`.github/workflows/ci.yml`** — on every PR and push to `main`: install →
  lint → typecheck → test → build, failing fast. pnpm store cached via
  `setup-node`'s `cache: pnpm`; Turborepo's local cache via `actions/cache` on
  `.turbo` with SHA-keyed entries and branch-then-global restore keys. Node
  pinned from `.nvmrc` (24.16.0), pnpm from `packageManager` (10.33.0), so
  neither can drift from local development. `concurrency` cancels superseded
  runs on the same ref.

### Verified

- **The root `start` script actually serves a production build.** Ran
  `pnpm build && pnpm start` against a clean `.next`: `next start` came up in
  1010ms and returned 200 in 124ms. The served HTML contains **zero**
  dev-mode signatures (grepped for `hmr`, `turbopack_browser_dev`,
  `webpack-hmr`, `_devtools`) and references content-hashed minified chunks
  (`465c474e50ed7950.js`) rather than the `apps_web_app_layout_tsx_*.js`
  pattern from the DevTools capture. That is the reported symptom, directly
  disproven.
- **The CI build works with no env file and only placeholder public vars** —
  temporarily moved `apps/web/.env.local` aside (backed up and restored
  byte-identical, verified with `cmp`) and rebuilt from scratch: exit 0. This
  confirms the claim that `getDb()`'s laziness
  ([packages/database/src/client.ts](../packages/database/src/client.ts)) means
  a build that never opens a connection doesn't need `DATABASE_URL` — worth
  proving rather than assuming, since it's the difference between CI passing
  and failing on first push.
- Every CI step run locally in order: lint 6/6, typecheck 7/7, test 6/6,
  build clean. `pnpm install --frozen-lockfile` succeeds, so the added
  dependencies are in the lockfile and CI won't fail on step one.

### Deliberately not done

- The remaining Phase 7 items are dashboard work (Vercel preview deploys,
  Preview vs Production env vars, branch protection, Sentry, Analytics), the
  live smoke test, and `DEPLOYMENT.md`. Left open pending the Supabase
  project-separation decision below.
- **Preview and Production still share one Supabase project**
  (`mvzjqlddkkdwjphcrjsk` is the only project ref anywhere in the repo, and
  there is no staging-specific env file or naming convention). The roadmap's
  own guidance — _"never point Preview at the same Supabase project as
  Production"_ — is unresolved and intentionally untouched here, since both
  changes in this entry are independent of it.

### Note on CI's test step

`pnpm test` currently proves very little: five of seven packages are
`echo "no tests yet"`, and the one real suite
(`transcription.service.test.ts`) self-skips without real Supabase
credentials. It's wired up so it starts protecting the repo the moment real
tests land, but a green check today is close to vacuous. Logged in
docs/KNOWN-ISSUES.md.

## 2026-08-06 — Phase 6.7: Mindmap view, and a redesigned chat home

### Added

- **Mindmap view** (`/mindmap`), a new phase added to docs/roadmap.md as
  Phase 6.7. Clusters the embeddings already generated in Phase 6 by theme and
  by month, renders them as an SVG node graph, and opens the entries inside a
  node when it's tapped.
  - `mindmap_clusters` and `mindmap_cluster_entries` tables (migration 0008)
    with RLS on both (migration 0009). Two different scoping shapes:
    `mindmap_clusters` owns `user_id` so it scopes directly like
    `chat_sessions`; `mindmap_cluster_entries` scopes through a join to its
    parent cluster, the same pattern as `entry_photos`/`entry_tasks`. Both get
    an explicit Data API grant since auto-exposure is off.
  - `packages/database/src/lib/cluster.ts` — cosine similarity and k-means,
    kept free of Drizzle and LLM imports so it's directly testable. Seeding is
    deterministic (fixed first pick, then furthest-point) rather than random:
    the map recomputes on every new entry, and random seeding would reshuffle a
    user's themes on each refresh even when nothing changed.
  - `theme-label.prompt.ts`, versioned like the other prompts. Constrained to
    1-3 words naming the subject matter rather than the emotion ("Job hunting",
    not "Anxiety about work"), and explicitly never diagnostic — the label is a
    node on a map, not a claim about the person.
  - `recomputeMindmapForUser` runs in the background after `summarizeEntry`,
    gated on the embedding write actually succeeding. Opening `/mindmap` is a
    plain DB read — no clustering or LLM calls on page load.
- **`/api/mindmap`** and **`/api/mindmap/clusters/[clusterId]`**.
- **`--animate-node-emerge`** token (1.4s ease-out) for new nodes.

### Changed

- **Chat home (`/chat`) redesigned.** Years were previously stacked as
  full-width option cards, which pushed the start button past the fold once a
  user had a few years of entries, and gave no sense of how much was in each
  one. Now a compact 3-column grid where each year shows its entry count — the
  thing that actually informs the choice. Past conversations gained a relative
  timestamp and a clearer affordance, the empty state suggests recording a
  first entry instead of dead-ending, and a low-entry-count warning appears
  before starting rather than only after.
- **Journal header** gained a mindmap entry point alongside the existing
  past-self chat link.
- **`/mindmap` added to the middleware's protected prefixes.**

### Verified

- **RLS on both new tables proven with a two-user script** (11 checks, all
  pass): user B cannot read A's clusters by id or in a list, cannot read A's
  membership rows, cannot insert into A's cluster, cannot create a cluster
  owned by A, and cannot update or delete A's cluster — while A retains full
  access to its own rows. Postgres rejected the write attempts with explicit
  `new row violates row-level security policy` errors.
- **Clustering math checked against inputs with a known-correct answer** (19
  checks, all pass): cosine similarity identities and magnitude-invariance,
  the zero-vector guard, cluster-count bounds, correct separation of two
  obviously-distinct vector groups, determinism across repeated runs, and the
  edge cases (empty input, single item, k larger than the item count, every
  item assigned exactly once).
- **Membership-key logic checked** (5 checks, all pass) — the key that decides
  whether a label is reused is order-independent, month-sensitive, and changes
  when a cluster gains a member.
- **End-to-end against the real server, real Supabase and the real LLM**:
  six entries on two clearly distinct topics (running, cooking) were clustered
  into exactly those two groups with correct membership (4 and 2), real
  generated labels ("Running", "Persistence"), tint indices inside the
  palette, working cluster-detail responses, and a 404 when a second user
  requested the same cluster.
- `pnpm lint`, `tsc --noEmit`, and `next build --turbopack` pass. `/mindmap` is
  190kB First Load JS, in line with the other routes.

### Fixed during development

- **Labels were being regenerated for every cluster on every recompute**, which
  exhausted the OpenRouter free tier's 50-requests-per-day cap partway through
  testing (a real `429 free-models-per-day`). Labels are now reused whenever a
  cluster's exact entry membership is unchanged, so only genuinely-new or
  changed clusters cost an LLM call. The failure fallback (`"Other"`) is
  deliberately never reused, so one transient rate-limit doesn't leave a node
  permanently misnamed.

### Known limitation at time of writing

- The final end-to-end re-run could not regenerate labels because the
  OpenRouter free-tier daily quota was fully exhausted by that point —
  summarization itself was returning 429, so no embeddings were produced and
  the map was empty. This is an account quota limit, not a code defect:
  confirmed by tracing every failure to `summarizeEntry`, upstream of
  clustering, and the earlier run (before the quota ran out) had already
  demonstrated correct clustering and real labels. Graceful degradation
  behaved as designed throughout — failures logged, map left intact, no crash.

### Not independently verified

- The mindmap's actual in-browser appearance: node layout and sizing, the mint
  tints, the fade-in on new nodes, and the cluster bottom sheet. No browser
  screenshot tool was available; verified through the API responses, the
  clustering checks, and build output only.

## 2026-08-06 — Phase 6 follow-up: persona chat character, real-pipeline loading states, grounded empty state and opening line

The Phase 6 retrieval and grounding logic (`matchEntries`, the date-range hard
filter) was already correct and is untouched here. This pass is entirely about
how the conversation feels.

### Changed

- Persona prompt bumped to `persona-chat-v2`
  (`packages/llm/src/prompts/persona-chat.prompt.ts`), restructured into
  explicit VOICE and GROUNDING sections. Grounding rules are unchanged in
  substance. The voice spec is new: speak in first person as the person
  themselves rather than an assistant describing them; let tone, vocabulary
  and mood be shaped by the actual excerpts (anxious excerpts should sound
  anxious, hopeful ones hopeful) instead of flattening into one generic warm
  voice; short human sentences, no bullet points or preamble; plain prose with
  no Markdown, since replies render as plain text.
- `NO_RECORD_REPLY` exported as a shared constant. The prompt instructs the
  model to use exactly that sentence, and the chat UI matches on the same
  constant to give those replies a softer visual treatment
  (`text-muted-foreground italic` rather than normal `text-foreground` serif)
  — an honest, gentle answer, not an error state. Sharing the constant means
  prompt and UI can't drift out of sync.
- Loading states are now tied to what's genuinely happening.
  `sendPersonaChatMessage` accepts an `onStage` callback fired as each real
  pipeline step begins, and `POST /api/chat/[sessionId]/messages` streams
  those as newline-delimited JSON before the final reply. The UI shows
  "Listening for what you're asking…" (embedding), "Flipping back through the
  pages…" (retrieving), "Finding the words you used back then…" (generating).
  Not a timed fake sequence — measured gaps in a live run were 1.7s / 0.4s /
  generation.
- Empty state for sparse ranges rebuilt as `RangeContextPanel`: a 12-dot
  monthly timeline for single-year sessions (a dot per month, filled where
  that month has an entry) and a progress bar toward a suggested minimum of 5
  entries. Deliberately encouragement rather than a gate — the composer stays
  enabled at any entry count. Replaces the previous plain warning banner.
- Sessions with at least one in-range entry now open with a real, grounded
  first line instead of a blank input box. `getSessionRangeContext` pulls the
  earliest in-range entry's actual first line (Markdown stripped via
  `stripFormatting`, cut at a sentence boundary, capped at 180 chars) and
  renders it as the past self's opening message with a citation chip to its
  source entry. Returns null rather than fabricating an opening when there's
  no real text.

### Added

- `EntriesRepository.listEntryDatesInRange` and
  `EntriesRepository.getEarliestInRange` — the timeline dots and the opening
  line respectively. Both match `listEntryDatesForUser`'s existing active-only
  filters so "has an entry" means the same thing everywhere.
- `@mindreva/llm/persona-chat-prompt` subpath export.

### Removed

- `countEntriesInSessionRange` — superseded by `getSessionRangeContext`, which
  returns the count alongside the timeline and opening-line data in one pass.
  Confirmed unused before deleting.

### Verified

- Ran the real provider (OpenRouter) against fixture excerpts in two
  deliberately different emotional registers. Two genuine voice failures were
  caught and fixed **in the prompt**, not worked around downstream: the model
  was addressing the user in second person ("your brother's wedding") and
  narrating its own source material ("The entries I have reference…"), then
  following an honest "I don't have…" with an inventory of what it did have.
  Both now explicitly forbidden; the no-record reply is specified as the bare
  sentence alone. After the fix, eight checks pass: no cross-year fact
  leakage, bare `NO_RECORD_REPLY` for uncovered/cross-year/empty-range
  questions, no second-person address, no meta-references to excerpts as
  documents, no clinical or therapy-advice language, first person throughout.
- Qualitatively confirmed the voice does shape to the source rather than
  flattening: the anxious fixture produced a clipped _"I was worried the
  Kestrel migration cutover would fail on Friday and my name would be tied to
  it."_, the hopeful one a warmer, more expansive reflection.
- Opening-line extraction checked against 8 cases including Markdown
  stripping, leading blank lines, title fallback, long-unpunctuated
  truncation, and the "nothing real exists" case that must return null.
- Full end-to-end run against the live dev server, real Supabase and the real
  LLM: stages streamed in correct pipeline order, retrieval matched both
  fixture entries, and the reply came back grounded and correctly cited.
- `pnpm lint`, `tsc --noEmit`, and `next build --turbopack` all pass.
  `/chat/[sessionId]` First Load JS is 190kB, ~1kB over its prior baseline —
  confirming the client component's `NO_RECORD_REPLY` import did not drag the
  provider SDKs into the browser bundle (the barrel-leak failure mode
  documented twice below).

### Not independently verified

- The chat screen's actual in-browser appearance — the timeline dots, progress
  bar, softer no-record styling, and the loading copy rotating in sequence.
  No browser screenshot tool was available; verified through the streaming
  protocol, bundle output, and build only. Worth a manual look.

## 2026-08-04 — Phase 6.6 fix: eliminated both per-request auth round trips via local JWT verification

Follow-up to the same day's earlier fix pass, which had reduced the
duplicate-auth-check cost from two network round trips to... still two
(React `cache()` only dedupes calls within a single request's render tree,
not across the separate middleware/page request lifecycle boundary — see
that entry's "Not fixed" section). This closes that gap properly instead of
architecting around it.

### Fixed

- Discovered the Supabase project's JWT signing key is already asymmetric
  (ES256/P-256, confirmed by decoding a real session's access token header),
  not the legacy shared-secret algorithm (HS256) that requires a network
  call to verify. `supabase.auth.getUser()` (used in both
  `packages/auth/src/middleware.ts` and `packages/auth/src/server.ts`)
  always makes that network round trip regardless of signing algorithm.
  `supabase.auth.getClaims()` doesn't: it verifies the token's signature
  locally against a JWKS public key fetched once and cached, and only falls
  back to the old network call if it detects a legacy HS256-signed token —
  so switching to it is safe regardless of the project's signing algorithm,
  never slower than before, and faster the moment ES256 is active (which,
  it turned out, it already was).
- Both call sites switched to `getClaims()`: `updateSession()`
  (`packages/auth/src/middleware.ts`) now returns `{ id: string } | null`
  derived from `claims.sub` instead of the full Supabase `User` object, and
  `getUser()` (`packages/auth/src/server.ts`, still wrapped in React
  `cache()`) now returns a normalized `{ id, email } | null`. Confirmed by
  grep that `.id` and `.email` are the only fields ever read from this
  helper's result anywhere in the app (21 call sites, all through a handful
  of `requireUserId()` wrappers or plain truthiness checks) — no call site
  needed to change.

### Verified

- A throwaway authenticated smoke-test script (deleted after use) against a
  real production build (`next build` + `next start`) confirms: authenticated
  requests to `/journal` and `/notes` now land at **21-108ms** (down from
  578-937ms before this fix — over a 5-10x reduction, since the auth check
  was previously 2 of maybe 3 round trips on those routes), and an
  unauthenticated request to a protected route now redirects in **5ms**
  (previously required a network call just to determine there's no valid
  session). `/account` and `/api/entries` still take 300ms-1s — confirmed
  that's real DB query cost for those routes (profile lookup, entry counts),
  not auth, now that auth itself is no longer the bottleneck.
- Full monorepo `pnpm lint`, a direct `tsc --noEmit` on `packages/auth`, and
  `next build --turbopack` all pass with no changes needed at any of the 21
  consuming call sites.
- Caught and fixed a bug in the smoke-test script itself during
  verification, not in the shipped code: an early draft of the test
  constructed the session cookie as a positional array
  (`[access_token, refresh_token, null, null, null]`), which is not the
  format `@supabase/ssr@0.12.3` actually uses (confirmed by reading its
  installed `cookies.js` directly) — it expects the full JSON-serialized
  `Session` object, base64url-encoded with a `base64-` prefix. The array
  format silently produced "not authenticated" redirects that looked like a
  real regression until traced to the test script, not `getClaims()` itself.

### Not independently verified

- The auth timing figures above were measured with `curl` against a
  scripted test user, not through an actual signed-in session in a browser.
  A real sign-in/sign-up flow through the UI has not been manually
  re-confirmed after this change (though the underlying mechanism —
  `getClaims()` falling back to the exact same `getUser()` behavior for any
  non-ES256 token — makes a regression there unlikely).

## 2026-08-04 — Phase 2 follow-up: real brand logo, chrome-free RecordButton, redesigned landing screen

### Added / Changed

- Replaced the placeholder `LeafMark`/`Logo` path (`packages/ui/src/components/logo.tsx`) with the real brand mark, traced from `packages/ui/src/assets/logo.png` via `potrace` after the accompanying `logo.svg` turned out to be an unusable ~19,740-character bitmap trace rather than clean vector artwork. The re-traced path is ~1,900 characters, a single `currentColor` path at the source's native 496x757 proportions — same component contract, no call-site changes needed anywhere it's already used (header/wordmark, chat, onboarding, sign-in/up layouts, `/dev/components` gallery).
- `apps/web/app/favicon.ico` regenerated from the same traced mark at 16/32/48px.
- `RecordButton` (`packages/ui/src/components/record-button.tsx`) rebuilt per direct request: the circular bordered chrome around the icon is gone for `idle`/`recording` states — it's now the logo itself at a larger tappable size (`size-24` outer / `size-9`-`size-14` icon depending on the `size` prop), with color and a pulse animation signaling state instead of a background circle and border. `paused` and `processing` keep their distinct `Play`/`Loader2` glyphs rather than also switching to the leaf, since those two states need to be unambiguous at a glance in a way a color change alone doesn't guarantee. `TransportButton` (the separate pause/stop control) is unchanged — it was never the icon this request was about.
- Landing page (`apps/web/app/page.tsx`) redesigned from a plain centered-logo placeholder to an onboarding-style layout: soft blurred mint blob shapes in two corners, the leaf mark large and centered on a light mint disc, a serif headline ("Say it once, keep it forever"), descriptive subtext, and a pill-shaped primary CTA with a trailing arrow — Mindreva's own palette and mark throughout, not any external reference's colors or characters.

### Verified

- Rasterized the traced SVG at 16px, 32px, and 400px via `sharp` and visually confirmed the leaf silhouette and spiral cutout both stay legible with no muddiness at the smallest (favicon) size, and match the source PNG's proportions almost exactly at large size.
- `pnpm lint`, a direct `tsc --noEmit` on `packages/ui`, and a full `next build --turbopack` all pass with no new bundle-size regression (First Load JS unchanged, +~1kB from the slightly larger path data).
- Landing page SSR output verified via `curl` against a real production build (`next start`) to contain the expected headline/branding text.

### Not independently verified

- The landing page and RecordButton's actual in-browser visual appearance — no browser screenshot tool was available in this environment. Flagged for a manual check rather than assumed; the production build compiles and server-renders the expected markup/classes, but pixel-level layout (blob placement, spacing, contrast) has not been visually confirmed by a human or a screenshot tool.

## 2026-08-04 — Phase 6.6 fix pass: deferred auth caching, background AI work, parallel photo uploads, photo-editor toolbar redesign

Reported directly against the running app: navigation still felt slow
everywhere, saving text blocked on a full LLM re-summarize, and multi-photo
uploads happened one at a time. The previous barrel-leak fix was necessary
but addressed bundle size, not request-count or blocking-call latency.

### Fixed

- `getUser()` (`packages/auth/src/server.ts`) is now wrapped in React's
  `cache()`, so every Server Component and service call within a single
  request's render tree shares one `supabase.auth.getUser()` network round
  trip instead of firing a fresh one each. Middleware's own `getUser()` call
  is a separate request lifecycle and still pays its own round trip —
  deduplicating across that boundary needs request-scoped plumbing between
  middleware and the page render, left as a known remaining cost (see
  Known Issues).
- Journal/notes list pages no longer fetch calendar day-cell cover-photo
  thumbnails (`listMyDayThumbnails`, a Storage sign round trip) on every
  navigation. That data now loads lazily client-side, only the first time
  the date-picker bottom sheet is actually opened, via a new
  `/api/entries/day-thumbnails` route.
- `listMyEntryDates` is no longer called from journal/notes at all — dates
  for the calendar's dot indicators are now derived synchronously from the
  entries list already being fetched (`entryDatesFrom`), removing a second
  DB round trip. `listMyEntryDates` itself is kept for `chat/page.tsx`,
  which needs available years without fetching a full entries list.
- Saving edited transcript/note text (`saveMyTranscriptEdit`) and creating a
  text entry (`createTextEntry`) no longer block the HTTP response on
  re-summarization. The DB write is confirmed and returned immediately;
  summarization now runs after the response is sent via `next/server`'s
  `after()`. The entry detail page shows "Saved" instantly, with a small
  "updating…" indicator next to the summary while it polls
  `/api/entries/[entryId]/summary` briefly in the background for the
  refreshed result.
- Voice recording (`createVoiceEntry`) no longer blocks on ASR transcription
  either — transcription now runs via the same `after()` pattern.
  `record-flow.tsx` uploads, then immediately routes back to `/journal`
  with a "Recording saved — transcribing in the background…" toast, instead
  of sending the user to the review screen to wait. A new
  `TranscriptionWatcher` client component (mounted in `EntryListScreen`,
  backed by `sessionStorage` via `transcription-watch.ts` so it survives the
  navigation) polls the entry's transcript status and toasts "Transcription
  complete" (refreshing the list) once it's done, or a graceful failure
  toast if it isn't. The review screen at `/entries/[entryId]/review` still
  exists for manual/direct navigation but is no longer the default
  post-recording destination.
- Multi-photo uploads (entry detail and the review screen) now upload in
  parallel via `Promise.allSettled` instead of a sequential `for...await`
  loop — picking 3 photos previously took roughly 3x as long as picking 1.
- Photo upload UI redesigned per direct feedback: the old large "Tap to
  Upload Photo" box is gone. `PhotoUploader` (`packages/ui`) is now a small
  camera-icon trigger button rendered inline in `RichTextEditor`'s toolbar
  row, next to Bold/Italic, via a new `toolbarEnd` slot prop that keeps the
  editor itself agnostic to what's rendered there. Existing photos render
  separately below via a new `PhotoThumbnailStrip` component (renders
  nothing when there are no photos yet).

### Verified

- A throwaway authenticated timing script (deleted after use, per this
  project's convention of not keeping one-off verification scripts in the
  repo) against a real **production build** (`next build` + `next start`,
  not `next dev`) shows consistent 540-830ms server response times across
  `/journal`, `/notes`, `/entries/[entryId]`, `/archive`, `/trash`, and
  `/account`, with no first-hit compile penalty.
- The same script against `next dev` showed no clear improvement and a
  worse cold number for `/journal` (~32s) than pre-fix — investigated via
  the dev server's own log output and confirmed to be Turbopack's one-time
  per-route dev-mode compile cost (`/journal`'s shared-chunk compile
  absorbing cost that every subsequent route then reused for free), not a
  regression from these fixes. `next dev` timings are not representative of
  deployed (Vercel) performance and should not be used to judge this work;
  a production build is the correct measurement, which is what the
  540-830ms figures above reflect.
- `pnpm lint` and `pnpm build` pass across the monorepo.

### Not fixed (inherent to the stack, not a bug) — superseded, see below

- ~~The Supabase project is hosted in ap-northeast-2 (Seoul); every Auth or
  DB round trip pays a real ~100ms geographic baseline measured directly
  against the project's Auth health endpoint. The 540-830ms production
  figures above include several such round trips (middleware auth, page
  auth, data queries) and won't drop meaningfully further without changing
  deployment region or the number of round trips per request.~~ The two
  Auth round trips in that figure were eliminated the same day — see
  "Phase 6.6 fix: eliminated both per-request auth round trips via local JWT
  verification" above. The Seoul geographic baseline is still real for
  whatever DB round trips remain, just no longer compounded by Auth calls
  on top of them.
- `addPhotoToEntry`'s three round trips (upload, DB insert, sign) remain
  genuinely sequential, as noted in the prior fix pass.

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
