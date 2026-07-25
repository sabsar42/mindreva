# Mindreva

Voice journaling and notetaking app. Dark mint / white / minimal / premium theme.

## Before doing anything

1. Read docs/roadmap.md, specifically the phase noted below.
2. For any UI work, look at docs/design-reference/ directly, don't guess at visuals.
3. Follow that phase's checklist, folder structure, common mistakes, and best
   practices exactly. Don't skip "Common mistakes", several of them are
   data-loss or trust-loss risks, not just style preferences.

## Current phase

Phase: 6
Completed: Phase 1 (Monorepo Bootstrap and Dev Environment), Phase 2 (Design System), Phase 3 (Database, Auth and Backend Foundations — verified live against a real Supabase project: migrations applied, RLS cross-user isolation proven with db:rls-check, sign-up/onboarding/account working end-to-end), Phase 4 (Voice Capture & ASR Abstraction Layer — packages/asr with Groq default + HuggingFace fallback + Nemotron stub, real MediaRecorder + live waveform, transactional entry/recording/transcript writes, RLS-scoped Storage bucket, transcript review/edit screen — verified live with a real microphone recording transcribed correctly via Groq), Phase 5 (Journaling, Notes & Summarization Pipeline — packages/llm with Gemini/Groq/Claude/OpenRouter adapters, 5 versioned summary prompt templates, real journal/notes list screens with search+filters+calendar, entry detail with regenerate/edit, Archive & Trash wired to account settings — verified live: real summarization end to end with clean output, embeddings.embedding migrated to vector(2048) to match the active OpenRouter embedding model's native dimension with a halfvec HNSW index, real 2048-dim vector inserted successfully. LLM_PROVIDER=openrouter is a TEMPORARY default — Gemini's account/region quota issue is parked, not fixed; revert to gemini once resolved)
(update these two lines yourself at the end of every phase)

## Note

Phase 6's matchEntries query must cast
its query vector to ::halfvec(2048) to match the expression index on
embeddings.embedding, or Postgres will silently skip the index and fall back to
a slow sequential scan. This isn't optional, it's required for the index to
actually be used.

## Non-negotiable rules, apply in every phase from here on

- Row Level Security must be enabled on every table from Phase 3 onward.
  Never disable it "temporarily," not even for a quick test.
- Only packages/database/src/repositories may import Drizzle directly.
- All ASR calls go through the ASRProvider interface, all LLM calls through
  LLMProvider. Never hardcode one provider's request/response shape into
  business logic, business logic should not know which provider is active.
- Journals and notes are one shared `entries` table distinguished by a
  `type` field. Never build two parallel systems for them.
- Entries are soft-deleted only (`deleted_at`). Never a hard DELETE.

## Stack

Turborepo + pnpm workspaces, Next.js 15 (App Router), TypeScript,
Tailwind + shadcn/ui, Drizzle ORM, Supabase (Postgres + Auth + Storage + pgvector),
deployed to Vercel Hobby.

## Commands

pnpm dev · pnpm build · pnpm lint · pnpm test
