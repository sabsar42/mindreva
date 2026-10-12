# Decisions Log

A running log of decisions made while building this project that **weren't**
called for in [docs/roadmap.md](./roadmap.md) — things discovered mid-build,
not planned in advance. Each entry: what happened, why, what was decided.

For decisions already baked into the roadmap (the ADRs in Phase 0), see the
roadmap itself. This log is specifically for the unplanned ones. See also
[docs/KNOWN-ISSUES.md](./KNOWN-ISSUES.md) for things that are still open
rather than resolved.

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
