# Deployment

Operational reference for deploying, configuring, and rolling back Mindreva.
Written for the Vercel Hobby target (see `docs/roadmap.md`'s ADR-7 for the
non-commercial-use caveat that comes with that plan).

## Environment variables

The full, commented list lives in [`.env.example`](./.env.example) — that
file is the source of truth for what each variable does and its expected
format. This section only adds the operational notes `.env.example` doesn't
cover: which values are secret, where each one comes from, and what happens
if it's missing.

| Variable                        | Secret?                   | Where it comes from                                                                                                                                                                                                                  | If missing                                                                                                                                                                              |
| ------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | Yes                       | Supabase project → Settings → Database → Connection string, **Transaction pooler** (port 6543), not the direct 5432 connection                                                                                                       | Build still succeeds — `getDb()` (`packages/database/src/client.ts`) connects lazily on first query, not at import time. Any request that touches the database fails at runtime.        |
| `SUPABASE_URL`                  | No (but keep server-only) | Supabase project → Settings → API → Project URL                                                                                                                                                                                      | Server-side Supabase client construction throws.                                                                                                                                        |
| `SUPABASE_ANON_KEY`             | No                        | Supabase project → Settings → API → anon/public key                                                                                                                                                                                  | Same as above.                                                                                                                                                                          |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Yes, highly**           | Supabase project → Settings → API → service_role key                                                                                                                                                                                 | `packages/database` (Drizzle) can't connect; repositories that rely on it fail. This key bypasses Row Level Security entirely — see the warning in `packages/database/src/client.ts`.   |
| `NEXT_PUBLIC_SUPABASE_URL`      | No                        | Same value as `SUPABASE_URL`                                                                                                                                                                                                         | Browser-side Supabase client can't initialize; sign-in breaks.                                                                                                                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No                        | Same value as `SUPABASE_ANON_KEY`                                                                                                                                                                                                    | Same as above.                                                                                                                                                                          |
| `ASR_PROVIDER`                  | No                        | Set manually: `groq` \| `huggingface` \| `nemotron-self-hosted`                                                                                                                                                                      | Falls back to whatever `packages/asr`'s factory defaults to — check `packages/asr/src/factory.ts` before assuming.                                                                      |
| `GROQ_API_KEY`                  | Yes                       | [console.groq.com](https://console.groq.com)                                                                                                                                                                                         | ASR calls fail if `ASR_PROVIDER=groq`.                                                                                                                                                  |
| `HUGGINGFACE_API_KEY`           | Yes                       | huggingface.co → Settings → Access Tokens                                                                                                                                                                                            | ASR calls fail if `ASR_PROVIDER=huggingface`.                                                                                                                                           |
| `LLM_PROVIDER`                  | No                        | Set manually: `gemini` \| `groq` \| `claude` \| `openrouter`. **Currently must be `openrouter`** — see the TEMPORARY note in `.env.example` and `docs/KNOWN-ISSUES.md` (Gemini account-level quota issue, unresolved).               | Summarization and persona chat fail.                                                                                                                                                    |
| `GEMINI_API_KEY`                | Yes                       | [aistudio.google.com](https://aistudio.google.com)                                                                                                                                                                                   | Only matters if `LLM_PROVIDER=gemini`, which is currently unusable — see above.                                                                                                         |
| `ANTHROPIC_API_KEY`             | Yes                       | [console.anthropic.com](https://console.anthropic.com)                                                                                                                                                                               | Only matters if `LLM_PROVIDER=claude` (post-monetization provider, not the default).                                                                                                    |
| `OPENROUTER_API_KEY`            | Yes                       | [openrouter.ai](https://openrouter.ai) → Keys                                                                                                                                                                                        | Summarization, embedding, and mindmap theme labeling all fail — this is the active default provider.                                                                                    |
| `OPENROUTER_MODEL`              | No                        | `nvidia/nemotron-nano-9b-v2:free` (see `.env.example`)                                                                                                                                                                               | Falls back to whatever the provider code defaults to; don't rely on this, set it explicitly.                                                                                            |
| `OPENROUTER_EMBEDDING_MODEL`    | No                        | `nvidia/nemotron-3-embed-1b:free` — **must stay a different model from `OPENROUTER_MODEL` above**, the embeddings column is sized for this specific model's output dimension (`vector(2048)`, see `packages/database/src/schema.ts`) | Embeddings fail or, worse, silently produce the wrong dimension if swapped for a model with a different output size.                                                                    |
| `NEXT_PUBLIC_SENTRY_DSN`        | No                        | Sentry project → Settings → Client Keys (DSN)                                                                                                                                                                                        | Sentry stays a no-op — verified directly: `pnpm build` succeeds with this fully unset, both locally and with CI's placeholder Supabase vars. No errors get reported anywhere, silently. |
| `SENTRY_DSN`                    | No                        | Same DSN as above; only needed if you want the server/edge runtimes to use a different value than the client (uncommon)                                                                                                              | Server/edge configs fall back to `NEXT_PUBLIC_SENTRY_DSN` if this is unset.                                                                                                             |
| `SENTRY_AUTH_TOKEN`             | **Yes**                   | Sentry → Settings → Auth Tokens (needs `project:releases` scope)                                                                                                                                                                     | Build still succeeds, but no source maps upload — Sentry stack traces show minified bundle code instead of your real `file:line`.                                                       |
| `SENTRY_ORG`                    | No                        | Your Sentry org slug                                                                                                                                                                                                                 | Same as `SENTRY_AUTH_TOKEN` above — source maps silently don't upload.                                                                                                                  |
| `SENTRY_PROJECT`                | No                        | Your Sentry project slug                                                                                                                                                                                                             | Same as above.                                                                                                                                                                          |

### Sentry setup notes

Sentry is wired into the code (`apps/web/sentry.{client,server,edge}.config.ts`,
`apps/web/instrumentation.ts`, `apps/web/app/global-error.tsx`,
`next.config.ts`'s `withSentryConfig` wrapper) but **no Sentry project has
been created yet** — every DSN var above is unset. This was done by hand
rather than via `npx @sentry/wizard`, because the wizard needs an interactive
browser OAuth login this environment can't drive. To finish activating it:

1. Create a free Sentry project at [sentry.io](https://sentry.io) (platform:
   Next.js).
2. Copy its DSN into `NEXT_PUBLIC_SENTRY_DSN` (locally in `.env.local`, and
   separately for Preview/Production in Vercel).
3. For source-map uploads, also set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
   `SENTRY_PROJECT` in Vercel (build-time only — never `NEXT_PUBLIC_`
   prefixed, never commit the token).
4. Redeploy, then trigger a real error (e.g. temporarily throw in a route
   handler) and confirm it shows up in the Sentry dashboard before trusting
   it's live.

**Two things worth knowing before you rely on this:**

- **Middleware roughly doubled in size** (94.6kB → 192kB) once Sentry's edge
  config was wired in — confirmed this happens even with no DSN set, since
  the config module gets bundled regardless of whether it's active at
  runtime. Worth keeping an eye on if you ever hit Vercel's middleware size
  limits.
- **The build now prints ~10 Turbopack warnings** about `import-in-the-middle`
  and `@opentelemetry/instrumentation` not being externalizable. This is a
  known interaction between Sentry's Node auto-instrumentation and
  Turbopack, not a bug introduced here — confirmed non-fatal (`next start`
  serves correctly afterward, both root and an authenticated redirect
  tested), just noisy in the build log.

### Setting variables in Vercel

Set variables **separately per environment** (Preview vs Production) in
Vercel's dashboard under Project → Settings → Environment Variables — each
variable has a checkbox per environment, don't just paste one set and assume
it applies everywhere.

⚠️ **As of this writing, Preview and Production point at the same Supabase
project** (see `docs/KNOWN-ISSUES.md`, "Preview/staging and Production share
one Supabase project"). Until that's split, Preview deploys read and write
real data — treat every preview URL as production until this is resolved.

### CI's placeholder values

`.github/workflows/ci.yml` builds with fake `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` values and no `DATABASE_URL` at all — this is
intentional (see the comment in that file). CI only proves the app compiles;
it never talks to a real Supabase project and nothing it builds is deployed.

## Rotating the Supabase service role key

The service role key bypasses Row Level Security — treat a leak of this key
as a full data breach, not a routine credential issue.

1. Supabase dashboard → Settings → API → click **Generate new secret** next
   to `service_role`. This immediately invalidates the old key.
2. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel (Production **and** Preview,
   separately) and in every local `.env.local` on your own machine.
3. Redeploy — Vercel doesn't pick up changed env vars for already-running
   deployments; a redeploy is required, not just saving the value.
4. Confirm the old key is dead: try a request with it (e.g. `curl` the REST
   API with the old key as the `apikey` header) and confirm it's rejected.

Rotate the anon key the same way if it's ever exposed somewhere it
shouldn't be (it's meant to be public, but treat an unexpected leak as worth
checking) — Settings → API → **Generate new secret** next to `anon`.

## Rolling back a deployment

Vercel keeps every deployment; rolling back doesn't rebuild, it just
re-points production traffic at a previous, already-built deployment —
fast, and doesn't re-run migrations or anything else.

1. Vercel dashboard → your project → **Deployments** tab.
2. Find the last known-good deployment (green checkmark, correct commit).
3. Click its `⋯` menu → **Promote to Production** (wording may read
   "Rollback" depending on Vercel's current UI).
4. Confirm. Traffic switches immediately; no rebuild happens.

**Database migrations do not roll back automatically.** If the bad
deployment ran a migration (`pnpm db:migrate`, see
`packages/database/migrations/`), rolling back the app code does **not**
undo schema changes. Check `packages/database/migrations/` for what shipped
in the bad deploy and assess whether the migration needs a manual down-script
before you roll back — don't assume it's safe by default.

## Production smoke test

Run this against the live production URL after every deploy that touches
auth, entries, ASR, LLM, or Storage. Each step should complete without an
error toast or a stuck loading state.

1. **Sign up** — create a new account (use a real or plus-addressed email you
   control; you'll need to confirm it). Confirm you land in onboarding, not
   an error page.
2. **Onboarding** — pick a language and a use case, confirm you land on
   `/journal` afterward.
3. **Record a voice entry** — `/record`, grant mic permission, record a short
   entry, stop. Confirm you're returned to `/journal` immediately with a
   "transcribing in the background" toast (not stuck on a spinner screen —
   see `docs/CHANGELOG.md`'s 2026-08-04 performance entry for why this
   matters).
4. **Confirm the transcript lands** — wait for the "Transcription complete"
   toast, open the entry, confirm the transcript text is real and not empty.
5. **Confirm the summary generates** — the entry detail page should show a
   generated summary within a few seconds of the transcript landing.
6. **Photos** — add a photo to an entry from the camera-icon button in the
   editor toolbar, confirm it uploads and displays.
7. **Notes** — create a text note directly (`/notes/new`), confirm it saves
   and appears in the notes list.
8. **Mindmap** — visit `/mindmap`. If you have entries across more than one
   month, confirm at least one themed node renders. (A brand-new account will
   correctly show the empty state — that's not a failure.)
9. **Past-self chat** — visit `/chat`, pick a year with entries, start a
   session, ask a question the entries can actually answer. Confirm you get
   a grounded reply with a citation, not an error toast.
   - ⚠️ If this fails with a rate-limit-looking error, check
     `docs/KNOWN-ISSUES.md` — the OpenRouter free tier caps at 50
     requests/day and is easy to exhaust during a testing session, especially
     since this same call powers both summarization and chat.
10. **Sign out / sign back in** — confirm the session actually persists
    across a real reload, not just client-side state.

If any step fails, check the deployment's Function Logs in Vercel before
assuming it's a code bug — most first failures after a fresh deploy are a
missing or mistyped environment variable (see the table above).

## Known gaps at time of writing

See `docs/KNOWN-ISSUES.md` for the live list. The two most relevant to
deployment specifically:

- **Preview and Production share one Supabase project.** No separate
  staging database exists yet.
- **CI's test step is close to vacuous** — most packages have placeholder
  tests, and the one real integration suite self-skips without Supabase
  credentials, which CI doesn't currently provide.
