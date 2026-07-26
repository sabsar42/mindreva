# Mindreva

Voice journaling and notetaking app. Dark mint / white / minimal / premium theme.

## Before doing anything

1. Read docs/roadmap.md, specifically the phase noted below.
2. For any UI work, look at docs/design-reference/ directly, don't guess at visuals.
3. Follow that phase's checklist, folder structure, common mistakes, and best
   practices exactly. Don't skip "Common mistakes", several of them are
   data-loss or trust-loss risks, not just style preferences.
4. Check docs/CHANGELOG.md, docs/DECISIONS.md, and docs/KNOWN-ISSUES.md for
   relevant context before starting work on a phase — prior unplanned
   decisions and open issues often affect what a later phase should do.

At the end of each phase — or whenever an unplanned decision gets made or a
new open issue is found, not just at phase boundaries — update all three of
those docs, not only the "Current phase" lines below:

- docs/CHANGELOG.md: add a dated entry for what was actually built.
- docs/DECISIONS.md: add an entry for anything decided that wasn't already
  called for in the roadmap (what happened, why, what was decided).
- docs/KNOWN-ISSUES.md: add or update entries for anything left open.

## Current phase

Phase: 7
Completed: Phase 1 (Monorepo Bootstrap and Dev Environment), Phase 2 (Design System), Phase 3 (Database, Auth and Backend Foundations — verified live against a real Supabase project: migrations applied, RLS cross-user isolation proven with db:rls-check, sign-up/onboarding/account working end-to-end), Phase 4 (Voice Capture & ASR Abstraction Layer — packages/asr with Groq default + HuggingFace fallback + Nemotron stub, real MediaRecorder + live waveform, transactional entry/recording/transcript writes, RLS-scoped Storage bucket, transcript review/edit screen — verified live with a real microphone recording transcribed correctly via Groq), Phase 5 (Journaling, Notes & Summarization Pipeline — packages/llm with Gemini/Groq/Claude/OpenRouter adapters, 5 versioned summary prompt templates, real journal/notes list screens with search+filters+calendar, entry detail with regenerate/edit, Archive & Trash wired to account settings — verified live: real summarization end to end with clean output, embeddings.embedding migrated to vector(2048) to match the active OpenRouter embedding model's native dimension with a halfvec HNSW index, real 2048-dim vector inserted successfully. LLM_PROVIDER=openrouter is a TEMPORARY default — Gemini's account/region quota issue is parked, not fixed; revert to gemini once resolved), Phase 6 ("Chat with Past Self" RAG Persona Engine — embeddings generated automatically after every summarize using title+edited_text; matchEntries fixed to cast the query vector to ::halfvec(2048) so it actually uses the HNSW index instead of silently falling back to a seq scan; the grounded persona prompt hard-filters by date range BEFORE ranking by similarity; chat UI with serif year header, serif past-self replies, and tappable citation-chip pills. Verified live with a 4-fixture eval spanning two years with deliberately similar topics but different facts: the date-range hard filter never let a 2023 fact leak into a 2021 answer or vice versa, the model honestly said "I don't have a journal entry from this period about that" for an uncovered topic instead of inventing one, and an empty-range query correctly returned zero citations), Phase 6.5 (Photo Attachments for Entries — unplanned addition, added to docs/roadmap.md after the fact. entry_photos table + private "photos" Storage bucket mirroring the recordings pattern exactly (RLS via join through entries, per-user-folder Storage paths, explicit Data API grant); EntryPhotosRepository computes position server-side from photo count rather than trusting the client; PhotoUploader (packages/ui) wired into both the transcript review screen and entry detail screen; getMyEntryDetail now returns ordered photos with batch-signed URLs. Verified live: a two-user RLS script proved upload/insert/signed-URL works for the owning user and every read/list/download/sign/insert path is denied for a second user)
(update these two lines yourself at the end of every phase)

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
