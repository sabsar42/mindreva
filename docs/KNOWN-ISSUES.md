# Known Issues

Open, unresolved items. Not decisions already made (see
[docs/DECISIONS.md](./DECISIONS.md) for those) — this is specifically for
things still outstanding.

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

## New logo/landing-page/RecordButton visuals not independently verified in a browser

**Status:** Open.

**What's wrong:** The 2026-08-04 logo/RecordButton/landing-page redesign
(see docs/CHANGELOG.md) was verified via `sharp`-rasterized PNGs (for the
traced logo's legibility at various sizes), `tsc`/`eslint`/`next build`,
and `curl` against a real production server for the landing page's SSR
output — but no browser screenshot tool was available in this environment,
so none of it has been visually confirmed by a human or automated
screenshot at the actual pixel/layout level (blob placement, spacing,
RecordButton hit-area feel on a real touch device).

**Current workaround:** None needed unless a manual check turns up a real
issue — flagging so this isn't silently assumed correct.

**To revisit when there's time to chase it:** open the app in a real
browser (`pnpm dev`, visit `/`, `/record`) and confirm the landing page
layout and RecordButton states look and feel right, especially on an
actual phone screen per this same phase's own "test the palette in
daylight, not just your dev monitor" guidance.

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
