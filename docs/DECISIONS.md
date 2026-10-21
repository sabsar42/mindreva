# Decisions Log

A running log of decisions made while building this project that **weren't**
called for in [docs/roadmap.md](./roadmap.md) — things discovered mid-build,
not planned in advance. Each entry: what happened, why, what was decided.

For decisions already baked into the roadmap (the ADRs in Phase 0), see the
roadmap itself. This log is specifically for the unplanned ones. See also
[docs/KNOWN-ISSUES.md](./KNOWN-ISSUES.md) for things that are still open
rather than resolved.

---

## 2026-10-22 — iOS polish: what was kept from earlier owner decisions

**What happened:** The owner asked for a full iOS-native refinement pass (tokens, components, navigation, motion, performance, accessibility). Several parts of that brief conflict with decisions the owner had already made, so those decisions were kept and the brief applied around them.

**Decided:**

- **No bottom tab bar, no collapsing large titles.** Navigation stays as header icons and the Journal's fixed top section (2026-10-16, 2026-10-17). A tab bar would be a navigation redesign, not a polish. `PageHeader` became a sticky iOS-style nav bar instead.
- **No desktop split view.** The one phone-width column stays (2026-10-13).
- **Compact body text kept** (15px, 2026-10-19). The iOS names were added as tokens and the scale already matches them; only fields (17px, to stop iOS focus zoom) and button labels moved up.
- **Secondary text stays `#6a6a70`,** not iOS's `rgba(60,60,67,0.6)`, which is about 3.4:1 on white and fails AA for body text.
- **Theme still ignores the OS setting** (light by default, dark when chosen, 2026-10-16). `theme-color` follows the app's choice rather than `prefers-color-scheme`.
- **20px screen padding kept** (iOS uses 16 to 20).
- **No new dependencies.** Sheet drag, swipe physics and optimistic rollback use pointer events and React state.
- **Not done:** push/pop slide transitions (Next 15's View Transitions support is still experimental; the existing fade-and-rise stays); edge-swipe-back (it would compete with the tab swipe and row swipes); squircle corners (`corner-shape` changes perceived radius and has little browser support).

---

## 2026-10-22 — A day is the user's local day, stored per profile

**What happened:** Visits and entry dates used the server clock (UTC on Vercel), so users outside UTC had early/late entries filed on the wrong day, breaking streaks.
**Decided:** Store an IANA `timezone` on `profiles`, synced from the browser, and cut every day (visit, `entry_date`, streak "today") in that zone. The first sync re-cuts existing days into the zone once (`timezone_synced_at` marks it); later changes don't rewrite history, so a trip doesn't shuffle past days. Entries with a hand-edited date are never moved. Archived entries count toward the graph and appear in the day list; deleted ones don't.

## 2026-10-19 — The sign-in page is the design reference; neutral, flat, no rim

The sign-in and sign-up pages are the reference for the whole app. Surfaces use Apple's neutral grays instead of a warm cream; borders are plain hairlines; cards carry no inner rim light and (in dark) no shadow, because a bright 1px rim on a near-black card reads as an outline, not as depth. Dark mode steps surfaces up from true black instead of lifting the page. Filled buttons keep their top-edge highlight because that is what gives the sign-in buttons their depth. The paper grain added earlier the same day was removed for the same reason. Radius tightened to 22px for a more compact feel.

---

## 2026-10-19 — Tactile and compact through tokens; no plans; support is voluntary

- **Through tokens, not screens.** Press, shadows, springs, the type scale and the 44px hit areas live in `tokens.css` base rules and `packages/ui` components, so new screens inherit them. The type scale is lowered in the theme tokens (text only) rather than by shrinking the root font size, because rem also drives spacing and tap-target sizes.
- **Hit areas via `::after`**, with a `data-dense` opt-out for packed grids, because enlarging every control's real box would undo "compact", and overlapping 44px zones in the day grids would misroute taps.
- **A deeper dark-mode red** for the destructive gradient instead of changing the label per theme: no single label colour passed contrast across the old gradient.
- **No tiers anywhere.** The app has no paid plans; the plan and usage columns remain only as unused database columns. Support is a link out to a page the owner chooses via an env var, hidden when unset. Past Self's two-conversations-per-period cap stays (it keeps each period focused) but is described as a plain limit, not a plan.
- **Legal text is written from the code, not boilerplate**, and carries no invented contact details: the contact line shows only when `NEXT_PUBLIC_CONTACT_EMAIL` is set. It is a plain-language draft the owner should read and adjust.

---

## 2026-10-18 — Mori, auto-summarising inline recordings, and what was removed

**What happened:** The owner asked for Mori (the leaf mascot) as a living
companion, the record bar and week strip from the mockup, and a memory card
that visibly forms after recording, plus removal of dead code.

**Decisions:**

- **Auto-summarise.** A card that "forms into a memory" needs a title and
  summary, but voice entries were only summarised after the (now unreachable)
  review screen. The client now calls `summarize` as soon as the transcript is
  done. This reverses the old rule "never summarise unreviewed raw ASR output";
  the trade is that a mis-heard word can reach the summary. Editing the
  transcript on the entry page still re-summarises. Cost: one LLM call (plus
  embedding and mindmap work) per recording, which matters on the OpenRouter
  free tier (see KNOWN-ISSUES).
- **Client-driven, not a server chain.** The client sequences transcribe ->
  summarise because it gets a definite success or failure per step to show on
  the card; the server has no summary status to poll. The store is module-level
  so work continues across tab changes. If the tab is closed mid-way the
  recording and transcript are safe on the server but the memory is not made
  until the entry is opened and saved.
- **Dead code removed, not kept as deep links.** `/record`, the review screen,
  the watcher and the old record button had no entry points left.
- **Mori's long-press option** was unspecified: I chose a sheet with today at a
  glance and a Quiet mode switch. **The card hover/tap effect** referred to an
  earlier design I could not find: I used a small lift, green edge and
  thumbnail lean-in, in the same green language as the forming card. Both are
  easy to change.
- The week strip renders after hydration (a same-size placeholder before),
  because its weeks depend on the viewer's clock and time zone.

---

## 2026-10-17 — Journal: whole top section fixed, only the list scrolls

The owner clarified that the entire top portion (header included) must not
scroll. Done as a fixed-height flex column with the list as the sole scroll
container, rather than `position: sticky`, so nothing above the list can move
at all. Cost: ~450px of fixed UI (see KNOWN-ISSUES for short screens).

---

## 2026-10-16 — Journal header: pinned, bare graph, whole-bar record button

**What happened:** The owner found the activity card too tall and asked for
just the graph, pinned with the record bar while entries scroll, the logo as
the record button, and a more game-like (Duolingo) feel.

**Decisions:**

- Kept the graph and the bar both pinned as asked, and compacted instead of
  collapsing on scroll. Result: 218px at 390px wide. If that is still too
  much, the next step is collapsing the graph once the list scrolls.
- The whole bar is the button, not only the logo. A nested logo button would
  be a button inside a button, and tapping anywhere on a record bar is the
  more forgiving behaviour.
- The streak moved from a footer into the bar's subtitle (it replaces
  "Starts instantly, no extra tap"), keeping a gamification element without
  adding a row. It describes today's streak whichever year the graph shows.
- Day details moved into the year slot rather than a footer or tooltip, for
  zero extra height.
- Styling: a first pass used Duolingo-style raised 3D buttons and sparks; the
  owner called it cartoonish and asked for an iOS feel matching the rest of
  the app. Decided: flat capsules, hairline borders, soft shadows and a
  press-scale. "Gamification" is kept only as the streak flame and the brief
  "Saved!" confirmation.

---

## 2026-10-16 — List thumbnails: client-made WebP copies, not format conversion

**What happened:** The owner asked to make all images WebP and lazy-load
them. Measuring showed new uploads were already WebP (since 2026-10-14) and
the default artwork is ~1 KB SVG, smaller than any WebP would be. The real
waste was list cards downloading the full (up to 1600px) cover to show an
80px square.

**Why:** Supabase image transformations aren't on the free plan, and
`next/image` optimisation would count every signed URL against Vercel Hobby's
quota.

**What was decided:** The browser makes a 240px thumbnail alongside the
resized photo; the server stores it at `<photo path>.thumb` (same per-user
folder, so the existing Storage policies apply). The thumbnails API signs
thumbnails and full photos in parallel and prefers the thumbnail. Older photos
have no thumbnail and keep loading full size. Lazy loading was added to list
images. Also decided: the activity-card year cache is module-level for the
session but is cleared when the signed-in user changes, because sign-out is a
client-side redirect, not a page reload.

---

## 2026-10-16 — Journal hero: activity card on top, record bar in the search slot, recording inline

**What happened:** The owner asked for the activity heatmap at the top of
Journal and the record control in place of the search box, with recording
starting on tap. A first attempt grew the heatmap into a bigger section and
later merged it into the record pill; both were rejected, and the work was
redone from master against two reference screenshots.

**Why:** The heatmap should occupy the old hero slot, not add height. Recording
should not leave the screen or stop at a review step.

**What was decided:**

- Heatmap is a standalone, always-visible year card; the record bar is a
  separate pill below it. Search moved to an icon beside the list heading;
  the All/Today/Date filter row was removed.
- Opening the app counts as activity (new `app_logins` table). Levels 1-4 =
  visited, then 1/2/3+ recordings, so recording deepens the same colour.
- Muted amber, not mint, because mint is reserved for actions. The ramp is a
  pair of CSS variables (`--heat-1..4`) that brighten in dark mode; a single
  fixed amber scale made the palest "visited" cell the brightest thing on a
  dark background.
- Recording runs inline via a shared `useVoiceRecorder` hook, so `/record`
  and the Journal bar use one MediaRecorder implementation. The pill keeps
  the same height in both states so the list never jumps. Tapping the
  waveform pauses; a discard button is included so an accidental tap doesn't
  create an entry.

---

## 2026-10-14 — Fix slow photos client-side: reuse signed URLs, resize before upload

**What happened:** Photos took 1-2s on every visit. Measured: each render
re-signed the photo with a new token, so the browser never reused its cached
copy, and the files were full-size originals (a 2.4MB PNG as a card cover).

**Why:** The usual fixes are paid or don't fit. Supabase image
transformations aren't on the free plan. `next/image` optimization would
count every new signed URL as a new source image against Vercel Hobby's
quota. Public buckets would give stable URLs but would expose private
journal photos.

**What was decided:**

- Keep signing server-side, but reuse the first signed URL per Storage object
  in the browser while it's valid (`lib/photo-url-cache.ts`). Kept in memory
  only, not `localStorage`, so a usable photo URL never outlives the tab.
  This covers moving in and out of entries (the reported case); a full page
  reload still downloads once.
- Resize new uploads in the browser to a 1600px longest edge, as WebP (JPEG
  fallback). This is a deliberate quality trade: originals above 1600px are
  no longer stored. 1600px covers the largest display size (desktop cover)
  and 2x density on phone layouts.
- Existing full-size photos are not backfilled (see docs/KNOWN-ISSUES.md).

---

## 2026-10-13 (follow-up) — Journal activity heatmap replaces the date-picker, not a new dashboard element

**What happened:** the brief described a "compact calendar preview within the
current dashboard" that expands to a full year, but no such persistent,
always-visible calendar existed — the only calendar in the app was
`CalendarPicker`, which opens inside a BottomSheet only when the Journal
screen's "Date" filter pill is tapped, purely to pick one date to filter the
list by.

**What was decided (confirmed with the user before building):**

- **The heatmap replaces `CalendarPicker` inside that same sheet**, rather
  than adding a second, separate persistent calendar card to the Journal
  screen. This keeps "preserve the existing dashboard structure" literally
  true — the main list, search, and filter pills are untouched — while still
  giving the brief's compact-preview/expand-to-year behavior a real home.
  `CalendarPicker` itself is left in place (still used by the dev component
  gallery) rather than deleted, since nothing else in the app references it
  and deleting a component outside this task's scope wasn't asked for.
- **No new schema.** `entries.entry_date` is already indexed on
  `(user_id, entry_date)`; the heatmap's three shapes (month, year, one
  day's entries) are three queries against that same column, not new
  storage.
- **Selecting a day still updates the underlying list filter** (sets the
  existing `filter: "date"` state), in addition to showing its inline
  detail — so closing the sheet after picking a day lands on a list already
  filtered to it, matching the calendar's pre-existing behavior, on top of
  the brief's new inline-detail requirement.
- **Streak is computed, not stored**, by walking backward through the same
  day-count data already fetched for the grid. The brief said to include a
  streak "only if the application already supports reliable streak
  calculations" — none existed, but since a reliable one is trivially
  derivable from data already being fetched for an unrelated reason (the
  grid itself), computing it qualifies rather than being skipped.

## 2026-10-13 (follow-up) — "River of Memories" built on the existing mindmap storage, not new tables

**What happened:** the brief asked for a full redesign of the mindmap into a
"river" timeline visualization, with gap/return/intersection behavior,
without specifying how it should be stored.

**What was decided:**

- **No schema change.** `mindmap_clusters` is already one row per (theme
  label, month) with an `entry_count`; that is already a theme-by-month
  matrix, which is exactly the raw material a streamgraph needs. The river is
  a new read/shape layer (`getMyRiver()`) and a new UI over the identical
  storage and identical `recomputeMindmapForUser` clustering/labeling
  pipeline from Phase 6.7 — nothing about how themes get clustered or
  labeled changed.
- **Theme identity is exact label match, not fuzzy/semantic grouping**
  (confirmed with the user before building the layout engine, since getting
  this wrong would have meant redoing it). Two month-clusters are "the same
  theme" iff their labels are byte-identical — the same guarantee the old
  bubble map already relied on for stable tint and label reuse. This also
  satisfies the brief's "distinguish themes explicitly mentioned... from
  connections supported by themes appearing together... never invent
  relationships" directly: merging "Home" and "Home life" because they sound
  related would be exactly the kind of invented connection that rule forbids.
- **Time-range filtering fetches once, slices client-side** (confirmed with
  the user). The full history is small (a handful of themes × months), so
  there's no accuracy cost to doing it client-side, and it keeps every range
  switch instant with no loading state — in keeping with the existing
  "opening this view is a plain DB read" philosophy from Phase 6.7.
- **Expand reuses the existing Dialog/modal popup pattern** (confirmed with
  the user), not a new route. The brief's "include a clear way to return to
  the Past Self journal history" is exactly what the existing
  `MindmapModal`-style popup already gives for free: closing it returns to
  the same scroll position with no navigation involved.
- **The one insight shown ("a theme that returned") is computed from the same
  gap data the river already derives**, not a separate LLM call, and only
  above a 2-month gap threshold — a one-month gap is normal writing cadence,
  not something worth calling out as "returned."
- **"Past Self" → "Re-live Me" is a pure rename of user-facing text.** The
  `/chat` route, `past-self.service.ts`, `lib/past-self/sessions.ts`, and
  every internal identifier are untouched; only what a person actually reads
  on screen changed. Renaming the internals too would have been a large,
  purely-cosmetic refactor across many files for zero user-visible benefit.

## 2026-10-13 (follow-up) — Nav icons, conversation cap, OpenRouter model swap

**What was decided:**

- **Past Self dropped its Entries section entirely**, on direct user feedback
  ("why are you showing entries in the past self screen"); entries stay
  discoverable only via /journal. `PastSelfSession.entries` still exists on
  the data (it still gates whether "Ask your past self" shows, since a
  session with no entries has nothing to ground a conversation on), it's just
  not rendered as a list anymore.
- **Conversations per half-year session are capped at 2 on the free tier**
  (`MAX_FREE_CONVERSATIONS_PER_HALF`), per direct instruction: "this half
  timeline can only have 2 conversation and if needed more than 2 then need
  to delete one (unless they are on paid...)". Implemented as auto-eviction
  of the oldest live conversation in that half (soft-deleted, never hard)
  rather than blocking creation outright — the user said "need to delete
  one," and silently evicting the oldest means the UI never has to show a
  blocking error for something that will keep happening on every normal use
  of a free account. The constant is a single top-level value, not a
  plan-lookup table, since paid-tier limits aren't configured yet.
- **Bottom nav bar replaced by top-right icons** (Hourglass/Puzzle, left of
  the avatar) on a literal screenshot match from the user, not a redesign
  judgment call.
- **OpenRouter's free chat model needed replacing mid-project** when the
  previously-pinned one was retired upstream with no warning — see
  docs/KNOWN-ISSUES.md "OpenRouter free-tier model availability" for the
  mechanics and what to do if it recurs.

## 2026-10-13 — Past Self sessions, inline pictures, sharing and transcripts: judgment calls

**What happened:** one brief asked for half-year sessions, an inline-image editor,
real sharing and a transcript view. The brief left several choices open.

**What was decided:**

- **Sessions are derived, not stored.** There is no sessions table. A session is a
  (year, half) computed from entry dates; a conversation records its half in
  `chat_sessions.persona_half` and is grounded on exactly that six-month window.
  Old whole-year conversations are shown under the half they were created in
  (or the year's last half if created later), and keep working.
- **Session names** come from two fixed 12-name pools picked by `year % 12`, so a
  name is stable across visits and unique within a year.
- **Pictures live in the Markdown body as tokens** referencing `entry_photos.id`,
  never URLs (signed URLs expire in an hour). `@mindreva/types` is the only
  place that parses the token, so the editor, the shared page and plain-text
  stripping can't drift. Removing a picture from the text leaves its file in
  Storage (see KNOWN-ISSUES).
- **Cover vs inline** is `entry_photos.kind`; list thumbnails and the cover only
  ever look at `cover`.
- **Autosave never re-summarises on each keystroke** (`resummarize: false`, to
  protect the LLM free-tier quota); one summary refresh runs after 25s idle.
- **Sharing model:** one share row per entry; 32-byte base64url token; revoke sets
  `revoked_at`, and sharing again issues a _new_ token so an old leaked link never
  comes back. Unknown, revoked, malformed and trashed all look identical (404).
  Private links need sign-in and a listed email (case-insensitive); the owner can
  always open their own link. The public page is noindex, no-referrer, dynamic.
  There is no share-token write path at all.
- **Public pictures need the service-role key.** Anonymous viewers can't sign
  URLs for the private `photos` bucket, so the server signs them with
  `SUPABASE_SERVICE_ROLE_KEY` (server only, never sent to the browser). Without
  it the shared page renders text but no pictures.
- **Transcript timestamps:** ASR segments are stored in `transcripts.segments` and
  grouped into ~30s blocks for display. Older transcripts have none; rather than
  inventing times, the panel says so and offers to re-run ASR on the stored
  recording, writing only segments and never overwriting edited text.
- **Home:** Week removed, Today kept, no new date controls.

## 2026-10-13 (follow-up) — Phone-width column on every screen; green only for actions

**What happened:** After the redesign shipped for review, the product owner
pointed out that it read as "everything green" and that the web version should
look like the phone version (matching the reference screenshots, which show the
phone layout centred on a white page on desktop).

**What was decided:**

- **Colour discipline:** neutral surfaces and text; green only on actions and
  accents. Encoded in `tokens.css` so components don't choose per-case.
- **One layout.** This deliberately reverses the 2026-09-24 responsive desktop
  and tablet layout (sidebar, widened containers, centred sheets). The app is a
  30rem column everywhere; on wide screens it's centred on a white canvas.
  Rationale: one design to maintain and verify, identical behaviour on phone and
  web, and it matches the Capacitor/PWA direction in Phase 8. If a real desktop
  layout is wanted later, it should be designed as its own thing rather than
  re-adding `md:` overrides to individual screens.

---

## 2026-10-13 — Apple-inspired redesign: scope and judgment calls

**What happened:** A redesign was requested from reference screens of a different
(purple) app. Several things in the references don't exist in Mindreva or conflict
with the brief, so scope was decided deliberately.

**What was decided:**

- **Navigation.** The brief names three experiences (Voice/Home, Past Self,
  Mindmap) and also asks for the Mindmap to sit above Past Self "instead of a
  button in the dashboard". Resolved as: three tabs (Home, Past Self, Mindmap),
  the map embedded in Past Self (collapsible), and `/mindmap` kept as the full
  view reachable from the panel. Account moved behind the avatar, as in the
  references. If the standalone Mindmap tab should go, remove it from
  `_components/nav-items.ts` and the swipe order.
- **Not built (no backing feature in Mindreva):** phone/OTP sign-in, date of
  birth and "Manage profile" tabs, plans/upgrade/top-up and billing, an
  English/Bangla UI language switch, per-recording summary style. Billing and
  quota enforcement are Phase 9; the UI language switch needs real i18n.
- **Integrations without a migration.** No table was added: with no OAuth
  requirements yet, there is nothing meaningful to store, and the schema should
  follow the spec (scopes, tokens, sync direction). The provider interface is the
  seam; the Google Calendar provider reports "not configured". An unavailable
  integration answers instantly in the UI; the API still returns 501 as a guard.
- **Account data as a promise.** An `async` layout awaiting the profile would
  serialize that query ahead of every page, undoing the 2026-10-12 latency work,
  so the layout passes an un-awaited promise to Suspense-wrapped consumers.
- **Dark mode is real, not a stub.** The existing local-only "Preferences"
  switches on the Account page remain stubs; the new dark-mode switch persists.
- **Pill/rounded direction kept** (see the 2026-09-24 entry); the references
  also use pills, so that question is still the product owner's to confirm.

---

## 2026-10-12 — Don't move the database; cache tab pages on the client instead

**What happened:** The deployed app felt slow, and moving the Supabase
database was on the table. Live measurement (see docs/CHANGELOG.md,
2026-10-12) showed DB queries cost ~70ms of a ~450ms request; the fixed
~230ms is the user → Mumbai edge → Tokyo function hop.

**Why:** Moving only the database can't shorten that hop. Moving the
database _and_ the function region to Mumbai (a new Supabase project in
`ap-south-1` plus `bom1` in `vercel.json`) would, but that means migrating
auth users, Storage buckets and pgvector data — free, but not small. Paid
options were ruled out for now.

**What was decided:**

- Keep Seoul + Tokyo. Fix perceived speed client-side: AppShell fully
  prefetches `/chat`, `/mindmap` and `/account` on every tab screen, and
  ChatHome no longer calls `router.refresh()` on every mount.
- **`/journal` is excluded from that prefetch.** Record upload, trash from
  entry detail and transcript review each `router.push("/journal")` right
  after a mutation without invalidating the cache. Calling `refresh()` before
  `push()` doesn't help: in Next 15.5 a navigation discards a pending
  refresh, whose cache reset only applies once its own fetch resolves
  (`app-router-instance.js`, `refresh-reducer.js`). A 5-minute prefetch of
  the journal list would therefore show trashed entries or miss a new
  recording. Journal keeps its existing 30s `staleTimes.dynamic` window.
- Accepted: Mindmap, Chat home and Account can be up to 5 minutes stale when
  opened from a tab. Account's server actions already purge the cache via
  `revalidatePath`; a new chat session sets a flag that makes ChatHome
  refresh on its next mount; the mindmap is a background-computed snapshot
  anyway.
- Revisit the Mumbai co-location only if first visits still feel slow after
  this ships.

---

## 2026-09-27 — Hide the nav bars on focused flows instead of guarding navigation

**What happened:** The 2026-09-24 protected-group layout rendered `SideNav`
and `BottomNav` on every protected page. On `/record` that made it one tap to
leave mid-recording, which unmounts `RecordFlow`, stops the microphone and
discards the audio with no prompt (`beforeunload` doesn't fire for
client-side navigation). The nav also covered bottom controls on `/notes/new`,
transcript review and chat conversations.

**Why:** A "you're recording, leave?" guard would need intercepting every
`Link`/`router.push` in the app, which Next's App Router has no supported hook
for. Those screens already have their own exit (Cancel/Back/Save) and are
single-purpose flows where a tab bar doesn't belong anyway.

**What was decided:** `_components/app-shell.tsx` (client component, used by
`(protected)/layout.tsx`) checks the pathname and renders no nav and no
sidebar offset on `/record`, `/notes/new`, `/entries/[id]/review` and
`/chat/[sessionId]`. Entry detail, Archive and Trash keep the nav and reserve
bottom padding for it. Chose a pathname list over moving pages into a second
route group to avoid relocating a dozen files and their relative imports.

---

## 2026-09-24 — UI redesign supersedes the Phase 6.6 sharp-radius / warm palette

**What happened:** The `feature/ui-update` branch (commit `cf59f7c`) reworked
the design system: a four-colour mint palette with hard-coded hex values
replaced the warm scale, all shadows were removed (`--shadow-subtle` and
`--shadow-elevated` are now `none`), buttons/inputs/tabs/filter pills went
back to fully rounded pills, and `--radius-lg` rose from 10px to 16px.

**Why:** It was a deliberate redesign toward a flatter look, but it reverses
Phase 6.6's explicit decision to use a single sharp 10px radius and take
`rounded-full` off buttons, badges, filter pills, tabs and toasts. That
reversal wasn't recorded when the branch was written.

**What was decided:** Kept the redesign as the current direction, since it's
the purpose of the branch, and recorded it here so the Phase 6.6 rule isn't
re-applied by mistake. Status: pending product-owner confirmation. If the
sharp 10px style should win, revert `packages/ui/src/styles/tokens.css`'s
radius scale and the `rounded-full` classes in `button.tsx`, `input.tsx`,
`tabs.tsx` and `filter-pills.tsx`. Genuinely circular elements (Avatar,
RecordButton, Switch) were circular under both designs.

---

## 2026-07-26 — Switched default LLM provider from Gemini to OpenRouter

**What happened:** `GEMINI_API_KEY` calls started failing with
`403 PERMISSION_DENIED: "Your project has been denied access. Please contact
support."` A second Gemini API key under a brand-new Google Cloud project hit
the same wall, and a third attempt returned `429 RESOURCE_EXHAUSTED` with
`quota_limit_value: "0"` for the Generate Content API in every project tried,
in the `asia-southeast1` region specifically.

**Why:** The consistent failure across multiple distinct Google Cloud
projects — not just one flaky key — points at a restriction on the Google
account itself (likely region/country-tied to the free-tier eligibility
Google auto-assigns), not a bug in this codebase, a fixable per-project
setting, or an ASRProvider/LLMProvider implementation error. `GeminiLLMProvider`
was tested and confirmed to make a correct, well-formed request; Google's
API rejected it before generation.

**What was decided:** Added `OpenRouterLLMProvider` (see
`packages/llm/src/providers/openrouter-provider.ts`) as a new, fully
interface-compliant `LLMProvider` adapter, and set it as the temporary
default (`LLM_PROVIDER=openrouter` in `.env.example`/`.env.local`).
`GeminiLLMProvider` was left completely unchanged and remains the documented
long-term default (see ADR-5 in the roadmap) — the plan is to revert
`LLM_PROVIDER` back to `gemini` once the account-level block is resolved (see
the open item in [docs/KNOWN-ISSUES.md](./KNOWN-ISSUES.md)).

---

## 2026-07-26 — Corrected OPENROUTER_MODEL after an initial wrong value

**What happened:** `OPENROUTER_MODEL` was initially set to a value that
turned out to point at a content-safety/moderation classifier model on
OpenRouter, not a general-purpose chat completion model — an easy mistake
given how similar some OpenRouter model slugs read at a glance.

**Why:** A classifier model doesn't produce the kind of free-form
completions `LLMProvider.complete()` needs for summaries or persona-chat
replies; using one silently would have produced nonsensical or unusable
output rather than a clear error.

**What was decided:** Corrected `OPENROUTER_MODEL` to
`nvidia/nemotron-nano-9b-v2:free`, a real general-purpose chat completion
model. Live-verified afterward: real summarization end to end produced
clean, correctly-structured prose with no reasoning-trace leakage (this
model also required the reasoning-suppression handling documented directly
in `openrouter-provider.ts`).

---

## 2026-07-26 — Migrated embeddings.embedding from vector(768) to vector(2048)

**What happened:** The schema's `embeddings.embedding` column was originally
`vector(768)`, sized for Gemini's `text-embedding-004` model (see the
now-superseded comment that used to live on that column). Once OpenRouter
became the active provider, its embedding model —
`nvidia/nemotron-3-embed-1b:free` — was live-tested and confirmed to return a
**2048**-dimension vector, not 768. `OpenRouterLLMProvider.embed()`'s
dimension guard correctly caught the mismatch and threw rather than silently
truncating or padding it.

**Why:** Truncating a 2048-dim embedding down to 768 (a "Matryoshka"-style
truncation) is only safe for models specifically trained to support it;
doing so for a model not designed that way causes a real, documented
retrieval-quality loss. Since the `embeddings` table had zero rows at the
time (confirmed before migrating), there was no backfill cost to changing
the column's true dimension instead.

**What was decided:** Migrated `embeddings.embedding` to `vector(2048)` to
match the active embedding model's actual native output, rather than
truncating to fit the old column size. See the next entry for the indexing
consequence this decision required.

---

## 2026-07-26 — Worked around pgvector's 2000-dimension HNSW index cap with a halfvec expression index

**What happened:** Rebuilding the HNSW index on `embeddings.embedding` after
the `vector(2048)` migration failed with
`column cannot have more than 2000 dimensions for hnsw index` — a real,
hard pgvector constraint (HNSW indexes cap at 2000 dimensions; 2048 exceeds
it), not a mistake in the migration SQL.

**Why:** Reverting to a smaller (≤2000-dim) embedding model would have
undone the previous decision to keep the model's native dimension instead of
truncating. pgvector's documented fix for exactly this situation is a
`halfvec` expression index: casting the indexed expression to
half-precision doubles the indexable ceiling to 4000 dimensions, while the
underlying column stays full-precision `vector(2048)` for storage — only the
index itself trades a small amount of precision.

**What was decided:** Rebuilt the index as
`CREATE INDEX ... ON embeddings USING hnsw ((embedding::halfvec(2048)) halfvec_cosine_ops)`
(see migration `0003_goofy_ser_duncan.sql`). **Any future query against this
column must cast its query vector to `::halfvec(2048)` to actually use this
index** — Postgres only uses an expression index when the query's expression
matches it syntactically; without the cast, the planner silently falls back
to a full sequential scan with no error. `EmbeddingsRepository.matchEntries`
(the one place this matters today, used by the Phase 6 persona chat) already
does this correctly — this note is for any future query added against the
same column.
