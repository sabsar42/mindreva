# Known Issues

Open, unresolved items. Not decisions already made (see
[docs/DECISIONS.md](./DECISIONS.md) for those) — this is specifically for
things still outstanding.

---

## Photos uploaded before 2026-10-14 are still full-size

**Status:** Open.

**What's wrong:** Resizing now happens before upload (see docs/DECISIONS.md,
2026-10-14), so existing photos keep their original size; one measured cover
is a 2.4MB PNG. They load fast on revisits within a session (signed URLs are
reused), but the first view per session, and every view after a full page
reload, still downloads the whole file. Those older objects also have no
`cache-control`.

**To revisit:** a one-off backfill script that downloads each existing photo,
resizes it the same way, uploads it under a new path with `cacheControl`,
and updates `entry_photos.storage_path`. Or, more simply, re-upload a cover
from the entry page.

---

## Every recording now costs an LLM summary

**Status:** Open.

Since 2026-10-18 each voice recording is summarised automatically (title,
summary, tasks, embedding, mindmap). On the OpenRouter free tier (50/day) a busy
day can hit the cap; the card then shows "Saved, but the summary didn't finish.
Open it to try again." and the recording and transcript are safe. A server-side
queue with a stored summary status would make this retryable without opening
the entry.

## A memory only forms while the tab stays open

**Status:** Open.

Transcription finishes on the server regardless, but summarising is started by
the client. Closing the tab right after recording leaves a transcribed, untitled
entry until it is opened and saved.

## Mori and card effects are unreviewed guesses on two points

**Status:** Open — owner's call.

The long-press option (today at a glance + Quiet mode) and the card hover/tap
effect (lift + green edge) were not specified precisely. Not yet tried on a real
phone or iOS Safari (long-press timing, `dvh`, haptics).

## Haptics do nothing on iOS Safari, and the native app is not in this repo

**Status:** Open.

`haptic()` uses `navigator.vibrate` (Android browsers only) and the Capacitor Haptics plugin when `window.Capacitor` exists. iOS Safari has no vibration API, so web users there get no haptics. There is no Capacitor project here yet, so the native path is untested on a device.

## Entry body has no ruled lines

**Status:** Open (optional polish).

Faint notebook lines would drift against the text because paragraph spacing (12px) isn't a multiple of the line height. Needs the editor's paragraph spacing changed to a whole number of lines first.

## Fixed Journal header leaves little room for the list on short screens

**Status:** Open — owner's call.

Header, graph, record bar and the Journal row are fixed (~450px). The list gets
394px on an 844px-high phone and ~217px on a 667px-high one (iPhone SE size),
less in landscape. If that is too tight, collapse the graph (or the header)
while the list scrolls. Not tried on a real phone or iOS Safari (`dvh`,
safe-area at the top).

## Privacy and Terms are drafts; there is no account-deletion flow

**Status:** Open — needs the owner.

`/privacy` and `/terms` now exist (plain-language drafts written from what the app does). They should be read and adjusted by the owner, and `NEXT_PUBLIC_CONTACT_EMAIL` set so people have a way to ask for deletion or a copy of their data. There is still no in-app "Delete account" (the old link was dead and was removed): deletion is by request only.

## Older photos still load full size in lists

Thumbnails (`<photo path>.thumb`) only exist for covers uploaded after
2026-10-16. A one-off backfill (download, resize, upload `.thumb`) would
cover the rest; see also "Photos uploaded before 2026-10-14" below.

## Journal hero (activity card + inline recorder): open items

**Inline recorder only tested with a fake media stream** in headless Edge,
not a real microphone, a real permission prompt, or a phone browser (iOS
Safari's MediaRecorder support is the main risk).

**Visits are recorded per server-local calendar day**, not the user's
timezone, same as `entry_date` elsewhere. Near midnight a visit can land on
the neighbouring day.

## Journal activity heatmap: open items

**No lazy loading.** `CalendarPicker` was previously deferred behind
`next/dynamic` because `react-day-picker` is a real ~164kB dependency.
`JournalHeatmap` has no comparable dependency, so it's imported straight from
the barrel with no deferral — not an issue today, but if a future revision
adds a heavier charting dependency to this component, it should get the same
lazy-loading treatment the old calendar had.

**Week always starts Monday**, matching the rest of the app's calendar
convention, with no per-user locale setting. A user whose locale expects a
Sunday-first week sees Monday-first here, same as everywhere else journal
dates are shown.

**Not independently checked:** dark mode, desktop width, and a year with
enough days at the same intensity level to make the four-level bucketing
feel coarse (only tested with a handful of entries, matching normal
journaling volume, not a power-user's hundreds of entries in one year).

## River of Memories: open items

**No month-density scaling in the axis itself.** The time axis spaces months
evenly regardless of how many themes/milestones land in a given month;
a month with far more writing than its neighbors doesn't get visually more
room. Not a problem in any tested case (handful of themes, a few months) but
could look cramped for someone with dozens of themes active in the same
stretch.

**No virtualization for a very long "All time" history.** The whole history
renders into one wide SVG, scrolled horizontally. Fine at the scale tested
(a few months); not verified at multi-year scale with many themes, where the
SVG could get very wide.

**Server-computed insight only, never refreshed mid-session.** The single
"a theme that returned" insight is computed once per `getMyRiver()` call
(on page load). It is correct as of that load, but doesn't update if new
data lands without a refresh — same freshness model as the rest of this
precomputed view.

**Not independently checked:** the river in dark mode, and at desktop widths
(verified at phone width in light mode only, with a headless browser and
seeded fixtures covering a known gap/return/intersection shape).

## OpenRouter free-tier model availability

**`OPENROUTER_MODEL` can go stale without warning.** OpenRouter's free-tier
model lineup rotates as models get retired or added; on 2026-10-13 the
previously-working `nvidia/nemotron-nano-9b-v2:free` started returning 404
"No endpoints found" with zero prior warning, silently breaking both
summarization and Chat-with-Past-Self (anything going through
`LLMProvider.complete()`) until noticed. Replaced with
`nvidia/nemotron-3-super-120b-a12b:free`, verified live. There is no
monitoring/alerting on this — a future retirement will again surface only as
a user-visible "summarization doesn't work" report. If this happens again:
check https://openrouter.ai/models?max_price=0 for the current free lineup,
and test a candidate against the real prompts before swapping (several free
Nemotron variants return `finish_reason: "length"` with null/truncated
content because they spend the whole token budget on hidden reasoning even
with `reasoning: { exclude: true }` set — cheap "does it return 200" checks
are not enough).

**Who owns this Supabase project is unclear.** The live project's `auth.users`
table has three accounts, none matching the owner's own email
(`shakibatwork@gmail.com`). The owner identified `kakasama71@gmail.com` (20
live conversations at the time) from a screenshot of its own screen as the
account to clear, but the bulk soft-delete itself needs to be run with
explicit approval (the auto-mode classifier declined to run a direct SQL
bulk-update as an "unverifiable deletion scope" even after that
confirmation) — see the owner-facing summary for the exact command.

## Past Self / editor / sharing: open items

**Service-role key is required in production for shared pictures.** Public shared
pages sign Storage URLs with `SUPABASE_SERVICE_ROLE_KEY`. If it isn't set in
Vercel, shared pages show text but no pictures. Set it as a server-only variable.

**Removed inline pictures stay in Storage.** Deleting a picture from the text only
removes the token; the `entry_photos` row and file remain (and aren't re-shown).
A cleanup sweep for unreferenced inline photos hasn't been built.

**Share links have no rate limiting.** Tokens are 256-bit so guessing is not
realistic, but `/s/[token]` can be requested without limit.

**Adding timestamps re-runs ASR.** For old recordings, "Add timestamps" calls the
speech provider again (counts against its free tier). It only writes segments.
If the provider still returns none, the panel says so.

**Editor picture URLs expire after an hour.** An editor tab left open longer than
that will show broken pictures until reload; saved content is unaffected.

**Legacy conversation placement is a guess.** Whole-year conversations from before
half-year sessions appear under the half they were created in, which may not match
what they discussed.

**Title field relies on `field-sizing: content`.** Browsers without it show a
fixed-height title box (still editable). A JS auto-resize fallback isn't added.

**Not independently checked:** a real microphone recording storing segments end to
end (fixtures used seeded segments), and the new screens in desktop-frame and dark
mode.

## Redesign: items that need product input

**Status:** Open.

- **Google Calendar.** UI and architecture are ready; nothing connects. Needed:
  OAuth scopes, what is written to the calendar (and from which entries), one-way
  vs two-way sync, where tokens are stored (new table with RLS), consent/
  disconnect behaviour. Implement in
  `apps/web/lib/integrations/providers/google-calendar.ts`.
- **Plans, upgrade, top-up and billing** appear in the references but are not
  built (Phase 9).
- **Standalone Mindmap tab.** Kept alongside the embedded map; confirm whether it
  should stay (see DECISIONS.md, 2026-10-13).
- **Not yet checked on a physical phone or the deployed site:** the layout was
  verified in headless Edge (390px and 1280px). Worth a real-device pass for swipe
  gestures, the floating tab bar over the iOS home indicator, and the live
  recorder.

---

## CI's push trigger watches `main`, but the repo's default branch is `master`

**Status:** Open.

**What's wrong:** `.github/workflows/ci.yml` runs on `pull_request` (any
branch) and `push: branches: [main]`. This repo's default branch is
`master`, so a direct push to `master` — bypassing a PR, e.g. a docs fix or
an empty commit to re-trigger a Vercel deploy — never runs CI. PRs are
unaffected; this only misses direct pushes.

**To revisit:** change the workflow's push trigger to `master`, or rename
the branch to `main` to match the trigger.

---

## ~230ms per-request floor from the edge → Tokyo function hop

**Status:** Open, accepted for now. See docs/DECISIONS.md (2026-10-12).

**What's wrong:** Every dynamic request from Bangladesh pays ~230ms just to
reach the `hnd1` function, before auth (~50ms) and DB (~70ms). The
2026-10-12 caching changes hide this for tab switches but not for first
visits, entry detail, or `/journal` after its 30s cache window.

**Re-measured 2026-10-14 after the caching changes deployed:** tab switches
now land at 15-33ms with no request (see docs/CHANGELOG.md, 2026-10-12
entry). First page loads still take ~440-450ms and returning to Journal
after 30s ~490ms, which is this floor plus real work.

**To revisit:** if first visits still feel slow, consider co-locating in
Mumbai: a new free Supabase project in `ap-south-1` plus
`"regions": ["bom1"]`. Moving only the database would not help.

---

## Cold starts add ~1-1.5s to the first request after idle

**Status:** Open, accepted for now (no free fix).

**What's wrong:** Warm dynamic requests land at ~450ms, but the first one
on a new function instance took 1.6-1.9s in live measurements (2026-10-12).
At low traffic, most "open the app after a while" visits hit this.

**Why no fix yet:** The usual workaround is a keep-warm ping every few
minutes. The repo is private, so a GitHub Actions schedule at that rate
(~8,600 runs/month) would far exceed the 2,000 free Actions minutes, and
Vercel Hobby crons run at most once a day. Revisit if the repo goes public
or a free external pinger is acceptable.

---

## Journal list goes stale after mutate-then-navigate within 30s

**Status:** Open, pre-existing, minor.

**What's wrong:** Record upload (`record-flow.tsx`), trash from entry detail
(`entry-detail.tsx`) and transcript review (`transcript-review.tsx`) all
`router.push("/journal")` right after a mutation without invalidating the
Router Cache. If `/journal` is still cached (≤30s, or ≤5 min when a hover
prefetch fired), the list shows the pre-mutation state until the next fetch.
`refresh()` before `push()` doesn't fix it, since the navigation discards the
pending refresh (see docs/DECISIONS.md, 2026-10-12).

**To revisit:** do the mutation through a server action that calls
`revalidatePath("/journal")`, which purges the client cache before the
navigation, or remove the changed row from local state on arrival.

---

## Footer links to pages that don't exist

**Status:** Open.

**What's wrong:** `/privacy`, `/terms` and `/support` are linked from the
sign-in page and Account, but no such routes exist. The live sign-in page
logs three 404s from their prefetch on every load.

---

## UI redesign (`feature/ui-update`) not yet checked in a real browser

**Status:** Open. The 2026-09-27 fix pass was verified with lint, typecheck,
tests and `pnpm build` only; no browser automation or logged-in session was
available.

**Needs a manual check on a phone, then desktop:**

- Swipe a journal/notes card left: it should open Archive/Trash and stay on
  the same tab. Swipe on empty page space: it should switch tabs.
- `/record`, `/notes/new`, transcript review and a chat conversation should
  show no bottom nav or sidebar, and their bottom buttons should be fully
  tappable.
- Card timestamps should appear right after load with no hydration warning in
  the console (best tested on the deployed site, where server and browser time
  zones differ).
- Error toasts should show red text, success toasts green.
- Filter pills should fit on a 320px-wide screen.

---

## Redesign's pill/rounded style awaits confirmation

**Status:** Open, pending a product decision. See docs/DECISIONS.md
(2026-09-24): the redesign reverses Phase 6.6's sharp 10px radius. Kept for
now; revert steps are listed there.

---

## RESOLVED: ~700ms per authenticated page load was sequential Storage round trips, not a DB connection issue

**Status:** Fixed. See docs/CHANGELOG.md's 2026-08-16 entry for the full
before/after.

**What was wrong (and what it turned out NOT to be):** A live smoke test
still reported every screen as slow after the `start`-script and
`CalendarPicker` fixes. Initial investigation found every authenticated page
load costing a flat 660-800ms and, reasoning from the timing shape alone,
suspected `getDb()`'s connection singleton wasn't surviving between
requests on Vercel — that hypothesis was wrong. A temporary diagnostic log
added to `getDb()` and deployed confirmed `reusedExistingConnection=true`
consistently, with the same `moduleInstance` persisting across a full
minute of real navigation. The connection singleton was working correctly
the whole time.

**The real cause:** `listMyEntries` (and the archived/trashed/search
variants) ran three genuinely sequential steps per page load — list
entries, then look up which have a cover photo, then call Supabase
**Storage's** `createSignedUrls` API (a separate HTTPS service from
Postgres, with its own round trip) — each awaiting the previous step's
result, so none of it could be parallelized with `Promise.all`. That chain,
not the database connection, was the ~700ms.

**The fix:** thumbnail signing removed from the initial list-screen server
render entirely. `listMyEntries`/`listMyArchivedEntries`/
`listMyTrashedEntries`/`searchMyEntries` now return entries with no
`thumbnailUrl`; a new `useEntryThumbnails` hook
(`apps/web/app/(protected)/_components/use-entry-thumbnails.ts`) fetches
them client-side after the list has already painted, via a new
`POST /api/entries/thumbnails` batch endpoint — the same "defer to a lazy
client fetch" pattern already established for the calendar's day-cell
thumbnails.

**Verified:** re-measured the exact same steady-state test that showed
660-800ms before the fix: **723ms avg → 281ms avg locally**, a ~442ms
reduction matching the removed round trips almost exactly. `pnpm lint` and
`pnpm typecheck` pass; confirmed the new endpoint returns real signed URLs
for an entry with photos and a correct empty result for one without,
end-to-end against a real authenticated session.

---

## Gemini API returns 403 PERMISSION_DENIED at the account level

**Status:** Open. Not resolved — worked around, not fixed.

**What's wrong:** `GEMINI_API_KEY` requests fail with
`403 PERMISSION_DENIED: "Your project has been denied access. Please contact
support."` This was reproduced across multiple distinct Google Cloud
projects (a fresh key under a brand-new project hit the same wall), and a
separate attempt returned `429 RESOURCE_EXHAUSTED` with
`quota_limit_value: "0"` for every project tried in the `asia-southeast1`
region — consistent with a restriction on the Google account itself, not a
per-project misconfiguration or a bug in `GeminiLLMProvider`
(`packages/llm/src/providers/gemini-provider.ts`, confirmed to make a
correct, well-formed request).

**Current workaround:** `OpenRouterLLMProvider` is the standing default
(`LLM_PROVIDER=openrouter`). See
[docs/DECISIONS.md](./DECISIONS.md#2026-07-26--switched-default-llm-provider-from-gemini-to-openrouter)
for the full decision record. `GeminiLLMProvider` itself is untouched and
ready to go the moment this is resolved — reverting is a one-line env var
change (`LLM_PROVIDER=gemini`), not a code change.

**To revisit when there's time to chase it:**

- Try a completely fresh Google account (not just a new Cloud project under
  the same account) — the failure pattern points at the account, not the
  project.
- Or contact Google Cloud support directly, per the error message's own
  suggestion.

---

## Persona chat's new visuals not independently verified in a browser

**Status:** Open.

**What's wrong:** The 2026-08-06 persona chat character pass (see
docs/CHANGELOG.md) was verified through the real LLM, the real streaming
protocol, an 8-case opening-line check, a live end-to-end run, and build
output — but not visually. The monthly timeline dots, the progress bar
toward 5 entries, the softer `text-muted-foreground italic` treatment on
"I don't have a journal entry…" replies, and the three loading messages
rotating in sequence have not been seen rendered.

**Current workaround:** None needed unless a manual check turns up an
issue — flagging so it isn't silently assumed correct.

**To revisit when there's time to chase it:** open a chat session in a
real browser against both a sparse date range (to see the timeline and
progress bar) and a well-populated one (to see the grounded opening line),
and send a question the entries can't answer (to see the softened
no-record styling).

---

## CI's test step is near-vacuous (placeholder tests + self-skipping suite)

**Status:** Open. The pipeline is correct; the tests behind it aren't there yet.

**What's wrong:** `.github/workflows/ci.yml` runs `pnpm test`, but five of the
seven workspace packages define `"test": "echo \"no tests yet\" && exit 0"`,
and the only real suite
(`apps/web/lib/services/transcription.service.test.ts`) wraps everything in
`describe.skipIf(missingEnv.length > 0)` against `DATABASE_URL`,
`SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` — none of which are set in CI.
So the test step reliably goes green while asserting almost nothing.

**Current workaround:** None. The step is wired up deliberately so real tests
start being enforced the moment they exist, rather than having to remember to
add the step later. Lint, typecheck and build in the same workflow do provide
real signal today.

**To revisit when there's time to chase it:** either add unit tests that need
no credentials (the clustering math in `packages/database/src/lib/cluster.ts`
and `parseThemeLabel`/`stripFormatting` are pure functions and obvious first
candidates), or give CI a dedicated throwaway Supabase project so the
integration suite actually runs — which overlaps with the Preview/Production
project-separation decision.

---

## Preview/staging and Production share one Supabase project

**Status:** Open. A deliberate deferral, not an oversight.

**What's wrong:** A repo-wide audit found exactly one Supabase project ref
(`mvzjqlddkkdwjphcrjsk`) across `DATABASE_URL`, `SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_URL`, and no staging-specific env file or naming
convention (`.env.example` declares one flat, unprefixed set of names).
Environment separation is therefore entirely a function of what values the
deploy platform injects — nothing in the code selects between environments.
docs/roadmap.md's own Phase 7 checklist says **"never point Preview at the
same Supabase project as Production"** once real user data exists.

The sharper risk is writes, not reads: `packages/database/drizzle.config.ts`
resolves `DATABASE_URL` from the same unprefixed name, so a staging
environment that runs migrations would alter production schema. The same
applies to `db:rls-check`, which creates and deletes throwaway users.

**Current workaround:** None. Acceptable only while there's no real user data.

**To revisit when there's time to chase it:** provision a second Supabase
project for Preview, apply all migrations to it, re-run `db:rls-check`
against it, and set the Preview environment's variables separately in the
deploy platform.

---

## OpenRouter free tier's 50-requests-per-day cap is easy to exhaust

**Status:** Open. An account/plan limit, not a code defect.

**What's wrong:** `LLM_PROVIDER=openrouter` (the standing temporary default,
see the Gemini entry above) is on the free tier, which allows 50 model
requests per day. Every entry costs at least one call to summarize, and the
Phase 6.7 mindmap adds a theme-labeling call per new or changed cluster. A
session of testing with a handful of entries can hit the cap, after which
`summarizeEntry` fails with
`429 Rate limit exceeded: free-models-per-day` and, because embeddings are
generated inside that same flow, no new entries become chat- or
mindmap-eligible until the daily reset.

**Current workaround:** Failures degrade gracefully rather than breaking
anything — summarization logs and leaves the entry intact, theme labeling
falls back to a generic "Other" that a later recompute retries, and the
mindmap keeps rendering whatever was last computed. The cap resets daily.
Mindmap label reuse (added in the same phase) keeps steady-state cost to
roughly one call per genuinely-new cluster rather than a full relabel per
entry.

**To revisit when there's time to chase it:** add credits to the OpenRouter
account to raise the cap, or resolve the Gemini account issue above and
switch back via the one-line `LLM_PROVIDER` change. Verifying anything
LLM-dependent is worth doing early in a session, before the day's quota is
spent.

---

## Mindmap visuals not independently verified in a browser

**Status:** Open.

**What's wrong:** The Phase 6.7 mindmap (see docs/CHANGELOG.md) was verified
through a two-user RLS script, 19 clustering-correctness checks, an
end-to-end run against the real LLM, and build output — but not visually.
The SVG node layout, the mint tints, the area-proportional node sizing, the
gentle fade-in on newly-formed clusters, and the cluster bottom sheet have
not been seen rendered.

**Current workaround:** None needed unless a manual check turns up an issue.

**To revisit when there's time to chase it:** open `/mindmap` in a real
browser for an account with entries across at least two months, tap a node
to confirm the sheet lists its entries, and add a new entry on a fresh topic
to watch a new node fade in on the next visit.
