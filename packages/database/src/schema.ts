import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/**
 * Mindreva schema. Journals and notes are ONE `entries` table distinguished by
 * `type` — never two parallel systems. Entries are soft-deleted only
 * (`deleted_at`). The AI-generated rows (transcripts, summaries) keep `provider`
 * and `prompt_version` so we can tell which rows used an older prompt.
 *
 * `profiles.id` references `auth.users(id)` — that FK plus the pgvector
 * extension, RLS policies, the new-user trigger, and the HNSW index live in the
 * hand-authored SQL migration (drizzle-kit only manages table DDL).
 */

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // == auth.users.id (FK added in migration)
  displayName: text("display_name"),
  // Onboarding language selection, comma-separated (e.g. "en,bn,ur"). Simple
  // text is fine for MVP — no separate join table.
  languages: text("languages"),
  summaryStyle: text("summary_style").notNull().default("general"),
  // Monetization groundwork — present now, unenforced until Phase 9.
  plan: text("plan").notNull().default("free"),
  minutesUsedThisPeriod: integer("minutes_used_this_period")
    .notNull()
    .default(0),
  notesUsedThisPeriod: integer("notes_used_this_period").notNull().default(0),
  periodResetsAt: timestamp("period_resets_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // 'journal' | 'note'
    title: text("title"),
    entryDate: date("entry_date"),
    source: text("source").notNull(), // 'voice' | 'text'
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("entries_type_check", sql`${t.type} in ('journal','note')`),
    check("entries_source_check", sql`${t.source} in ('voice','text')`),
    index("entries_user_created_idx").on(t.userId, t.createdAt),
    index("entries_user_entry_date_idx").on(t.userId, t.entryDate),
  ],
);

export const recordings = pgTable("recordings", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id")
    .notNull()
    .references(() => entries.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(),
  durationMs: integer("duration_ms"),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const transcripts = pgTable(
  "transcripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    rawText: text("raw_text"),
    editedText: text("edited_text"),
    provider: text("provider"),
    language: text("language"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "transcripts_status_check",
      sql`${t.status} in ('pending','processing','done','failed')`,
    ),
    index("transcripts_entry_idx").on(t.entryId),
  ],
);

export const summaries = pgTable(
  "summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    summaryText: text("summary_text"),
    promptVersion: text("prompt_version"),
    provider: text("provider"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("summaries_entry_idx").on(t.entryId)],
);

export const embeddings = pgTable(
  "embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    chunkText: text("chunk_text"),
    // Gemini embedding dimension. HNSW index added in the SQL migration.
    embedding: vector("embedding", { dimensions: 768 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("embeddings_entry_idx").on(t.entryId)],
);

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  personaYearStart: integer("persona_year_start"),
  personaYearEnd: integer("persona_year_end"),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'assistant'
    content: text("content").notNull(),
    // Comma-separated entry ids the assistant actually cited (Phase 6).
    citedEntryIds: text("cited_entry_ids"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("chat_messages_role_check", sql`${t.role} in ('user','assistant')`),
    index("chat_messages_session_idx").on(t.sessionId),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type Recording = typeof recordings.$inferSelect;
export type NewRecording = typeof recordings.$inferInsert;
export type Transcript = typeof transcripts.$inferSelect;
export type NewTranscript = typeof transcripts.$inferInsert;
export type Summary = typeof summaries.$inferSelect;
export type NewSummary = typeof summaries.$inferInsert;
export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;

export type EntryType = "journal" | "note";
export type EntrySource = "voice" | "text";
export type TranscriptStatus = "pending" | "processing" | "done" | "failed";
export type ChatRole = "user" | "assistant";
