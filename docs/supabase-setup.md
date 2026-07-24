# Supabase setup (Phase 3)

Phase 3's code is complete, but it needs a live Supabase project to run. These
are the steps only you can do (they need your account). ~10 minutes.

## 1. Create the project

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. Choose a region close to you and set a strong database password (save it).

## 2. Fill in `apps/web/.env.local`

A ready-to-fill `apps/web/.env.local` already exists (git-ignored). It's the
single env file the app, the migrations, and the RLS test all read. Fill these
from the Supabase dashboard:

| Var                             | Where in the dashboard                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                  | Project Settings → API → Project URL                                                                              |
| `NEXT_PUBLIC_SUPABASE_URL`      | same value as `SUPABASE_URL`                                                                                      |
| `SUPABASE_ANON_KEY`             | Project Settings → API → Project API keys → `anon` `public`                                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same value as `SUPABASE_ANON_KEY`                                                                                 |
| `SUPABASE_SERVICE_ROLE_KEY`     | Project Settings → API → `service_role` (secret — never commit it)                                                |
| `DATABASE_URL`                  | Project Settings → Database → Connection string → **Transaction pooler** (port 6543). Put your DB password in it. |

Use the **transaction pooler** string (port 6543, host `...pooler.supabase.com`)
for `DATABASE_URL` — it's the one that works on Vercel/serverless.

## 3. Apply the schema + RLS

From the repo root:

```bash
pnpm --filter @mindreva/database db:migrate
```

This runs both migrations: the tables, then the pgvector extension, the
new-user trigger, **Row Level Security policies on every table**, and the HNSW
vector index.

(If `db:migrate` can't reach the DB over the pooler, use the direct connection
string on port 5432 just for migrating, then switch `DATABASE_URL` back to the
pooler for the app.)

## 4. Turn on Google sign-in (optional but in the UI)

Supabase dashboard → Authentication → Providers → Google → enable, and paste a
Google OAuth client ID/secret. Add the callback URL Supabase shows you to the
Google console. Email/password works without this.

For local dev, set Authentication → URL Configuration → Site URL to
`http://localhost:3000` and add `http://localhost:3000/**` to the redirect
allowlist.

## 5. Verify RLS actually blocks cross-user reads

```bash
pnpm --filter @mindreva/database db:rls-check
```

This creates two throwaway users, has one insert an entry, confirms the other
**cannot** read it through the RLS-enforced client, and cleans up. It must
print `ALL PASS ✅` before you build any feature on top of the schema.

## 6. Run the app

```bash
pnpm dev
```

- `/sign-up` → create an account → you'll land in `/onboarding/languages`
- pick languages → use-case → `/journal` (placeholder home)
- `/account` → profile, usage groundwork, editable summary style + languages,
  sign out

## 7. Keep the free project awake

Add a `DATABASE_URL` **repository secret** on GitHub (Settings → Secrets and
variables → Actions). The `.github/workflows/supabase-keepalive.yml` workflow
then pings the DB every 3 days so the free project never auto-pauses.
