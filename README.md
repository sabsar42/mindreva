# Mindreva

Mindreva is a private, voice-first journal for turning thoughts, recordings, and notes into useful reflections. Record an entry or write one by hand, then review its transcript, summary, tasks, photos, and related memories in one place.

Currently in Phase 7 — see [docs/roadmap.md](docs/roadmap.md) for what's shipped and what's next.

## Features:

- Voice recording and speech-to-text through a provider abstraction
- Written journal entries and notes with Markdown-backed rich-text editing
- AI-generated titles, summaries, and action-item extraction
- Photo attachments, calendar browsing, archive, and trash
- A "chat with your past self" experience powered by entry search and retrieval
- Supabase authentication, storage, PostgreSQL, and row-level security
- Onboarding for preferred languages and summary style

## Stack

- Next.js 15, React 19, TypeScript, Tailwind CSS
- Turborepo and pnpm workspaces
- Supabase, PostgreSQL, Drizzle ORM, and pgvector
- Pluggable ASR and LLM providers

## Getting started

### Prerequisites

- Node.js 24 or later
- pnpm 10
- A Supabase project
- API keys for the ASR and LLM providers you choose

### Install and configure

```bash
pnpm install
Copy-Item .env.example apps/web/.env.local
```

Fill in `apps/web/.env.local` with your Supabase credentials and the provider keys you plan to use. See [the Supabase setup guide](docs/supabase-setup.md) for the required values and dashboard setup. Optional variables worth knowing (all documented in `.env.example`):

| Variable                    | What it does                                                                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPPORT_URL`   | A voluntary tip page (`https://` only). Shows a "Support Mindreva" row on Account and small footer links; empty hides both. Unlocks nothing. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Where privacy requests go; shown on the Privacy and Terms pages when set.                                                                    |
| `CRON_SECRET`               | Unlocks the daily `/api/cron/embeddings` job that catches up embedding work. Without it the route refuses every request.                     |
| `RETRIEVAL_MIN_SIMILARITY`  | Overrides the past-self search's similarity threshold (default in `apps/web/lib/retrieval/retrieve.ts`).                                     |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Needed for shared-entry pictures and for account deletion.                                                                      |

After migrating, backfill search data for existing entries with `pnpm --filter @mindreva/database db:backfill-embeddings` (a dry run by default; see the script header).

Apply the database migrations:

```bash
pnpm --filter @mindreva/database db:migrate
```

Then start the app:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm format:check
pnpm --filter @mindreva/database db:rls-check
```

## Project layout

```text
apps/web          Next.js application
packages/asr      Speech-to-text provider interface and implementations
packages/auth     Supabase auth clients and middleware
packages/database Drizzle schema, migrations, and repositories
packages/llm      Summarization, embeddings, and chat providers
packages/types    Shared domain types and utilities
packages/ui       Reusable UI components and design tokens
docs              Roadmap, decisions, setup notes, and known issues
```

## Documentation

- [Roadmap](docs/roadmap.md)
- [Architecture decisions](docs/DECISIONS.md)
- [Known issues](docs/KNOWN-ISSUES.md)
- [Changelog](docs/CHANGELOG.md)

## Privacy

Journals are personal data. Mindreva uses Supabase Row Level Security to scope database records to their owner. Keep service-role and AI-provider keys server-side; never expose them in browser code.
