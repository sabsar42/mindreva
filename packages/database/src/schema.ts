import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
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
  // IANA zone (e.g. "Asia/Dhaka"), synced from the browser. Decides which
  // calendar day a visit or a new entry belongs to — the server runs in UTC,
  // so without this a late-night or early-morning entry lands on the wrong
  // day and breaks the streak.
  timezone: text("timezone").notNull().default("UTC"),
  // Null until the browser has reported a zone. The first sync re-cuts this
  // user's existing days into the zone (once); later changes (travel) don't
  // rewrite history.
  timezoneSyncedAt: timestamp("timezone_synced_at", { withTimezone: true }),
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
    type: text("type").notNull().$type<EntryType>(),
    title: text("title"),
    entryDate: date("entry_date"),
    source: text("source").notNull().$type<EntrySource>(),
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

export const entryPhotos = pgTable(
  "entry_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    storagePath: text("storage_path").notNull(),
    // Display order within the entry. Computed server-side as the current
    // photo count at upload time — see EntryPhotosRepository.create.
    position: integer("position").notNull().default(0),
    // 'cover' photos are the entry's cover/thumbnail set (what attaching a
    // photo did before inline images existed, so every existing row is
    // 'cover'). 'inline' photos are referenced from the journal body by id
    // (see packages/types journal-markdown) and are never used as a cover.
    kind: text("kind").notNull().default("cover").$type<EntryPhotoKind>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("entry_photos_kind_check", sql`${t.kind} in ('cover','inline')`),
    index("entry_photos_entry_idx").on(t.entryId, t.position),
  ],
);

export const entryTasks = pgTable(
  "entry_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isDone: boolean("is_done").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("entry_tasks_entry_idx").on(t.entryId)],
);

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
    // Timed ASR segments ({text,startMs,endMs}[]) for the transcript view.
    // Null for transcripts made before segments were stored, and for ASR
    // providers that return none (see TranscriptSegmentRow).
    segments: jsonb("segments").$type<TranscriptSegmentRow[]>(),
    status: text("status")
      .notNull()
      .default("pending")
      .$type<TranscriptStatus>(),
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
    // 2048 matches nvidia/nemotron-3-embed-1b:free's native output dimension
    // (the current temporary embedding provider — see packages/llm/src/factory.ts
    // and .env.example). Chosen over truncating to 768 (Gemini's dimension) to
    // avoid the small retrieval-quality loss documented for Matryoshka
    // truncation. Revisit this if/when Gemini becomes the active provider
    // again. HNSW index added in the SQL migration.
    embedding: vector("embedding", { dimensions: 2048 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("embeddings_entry_idx").on(t.entryId)],
);

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    personaYearStart: integer("persona_year_start"),
    personaYearEnd: integer("persona_year_end"),
    // 1 = Jan-Jun, 2 = Jul-Dec of persona_year_start (single-year sessions
    // only). Null = the whole year or year range, which is how every session
    // created before half-year sessions behaves.
    personaHalf: smallint("persona_half").$type<PersonaHalf>(),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Soft delete, like entries: a conversation is hidden, never hard-deleted.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "chat_sessions_half_check",
      sql`${t.personaHalf} is null or ${t.personaHalf} in (1,2)`,
    ),
  ],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull().$type<ChatRole>(),
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

/**
 * Precomputed theme clusters for the mindmap view. Recomputed in the
 * background after an entry is summarized (see mindmap.service.ts) rather than
 * derived live — the graph is a periodic snapshot, not a physics simulation.
 *
 * A whole recompute replaces the user's rows transactionally. `firstSeenAt`
 * deliberately survives that replacement when a cluster's theme label is
 * unchanged, so the UI can fade in genuinely-new nodes without re-animating
 * every existing one on each refresh.
 */
export const mindmapClusters = pgTable(
  "mindmap_clusters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** Short theme label generated by the LLM, e.g. "Work stress". */
    label: text("label").notNull(),
    /** "YYYY-MM" — clusters are scoped per month, per the by-theme-and-by-month grouping. */
    month: text("month").notNull(),
    entryCount: integer("entry_count").notNull().default(0),
    /** Index into the mint palette, assigned at compute time so a theme keeps its shade across refreshes. */
    colorIndex: integer("color_index").notNull().default(0),
    /** When this label+month first appeared, preserved across recomputes — drives the gentle fade-in of new nodes. */
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("mindmap_clusters_user_idx").on(t.userId, t.month)],
);

export const mindmapClusterEntries = pgTable(
  "mindmap_cluster_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clusterId: uuid("cluster_id")
      .notNull()
      .references(() => mindmapClusters.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
  },
  (t) => [index("mindmap_cluster_entries_cluster_idx").on(t.clusterId)],
);

/**
 * One share row per entry. `token` is the unguessable path segment of the share
 * link; revoking sets `revoked_at`, and sharing again rotates the token so an
 * old link can never come back to life. `visibility`:
 *   'public'  - anyone with the link can read the entry;
 *   'private' - only the owner and signed-in users whose email is in
 *               entry_share_recipients can read it.
 * Read access for non-owners is enforced in the server (never in the client).
 */
export const entryShares = pgTable(
  "entry_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    visibility: text("visibility").notNull().$type<ShareVisibility>(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "entry_shares_visibility_check",
      sql`${t.visibility} in ('public','private')`,
    ),
    unique("entry_shares_entry_unique").on(t.entryId),
    unique("entry_shares_token_unique").on(t.token),
  ],
);

/**
 * One row per user per calendar day they opened the app — the "visited"
 * signal for the activity heatmap's lighter tier (the darker tier is an
 * entry recorded that day, read from `entries` as before; this table adds
 * nothing to that). Upserted on page load (insert-if-missing), so a day with
 * many visits still costs one row. `day` is a plain date, not a timestamp:
 * the heatmap only ever needs "did they open the app this calendar day",
 * never a time-of-day.
 */
export const appLogins = pgTable(
  "app_logins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("app_logins_user_day_unique").on(t.userId, t.day)],
);

export const entryShareRecipients = pgTable(
  "entry_share_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shareId: uuid("share_id")
      .notNull()
      .references(() => entryShares.id, { onDelete: "cascade" }),
    // Stored lower-cased; compared lower-cased against the viewer's auth email.
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("entry_share_recipients_unique").on(t.shareId, t.email)],
);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type Recording = typeof recordings.$inferSelect;
export type NewRecording = typeof recordings.$inferInsert;
export type EntryPhoto = typeof entryPhotos.$inferSelect;
export type NewEntryPhoto = typeof entryPhotos.$inferInsert;
export type EntryTask = typeof entryTasks.$inferSelect;
export type NewEntryTask = typeof entryTasks.$inferInsert;
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
export type EntryShare = typeof entryShares.$inferSelect;
export type NewEntryShare = typeof entryShares.$inferInsert;
export type EntryShareRecipient = typeof entryShareRecipients.$inferSelect;
export type AppLogin = typeof appLogins.$inferSelect;
export type MindmapCluster = typeof mindmapClusters.$inferSelect;
export type NewMindmapCluster = typeof mindmapClusters.$inferInsert;
export type MindmapClusterEntry = typeof mindmapClusterEntries.$inferSelect;
export type NewMindmapClusterEntry = typeof mindmapClusterEntries.$inferInsert;

export type EntryType = "journal" | "note";
export type EntrySource = "voice" | "text";
export type TranscriptStatus = "pending" | "processing" | "done" | "failed";
export type ChatRole = "user" | "assistant";
export type EntryPhotoKind = "cover" | "inline";
export type ShareVisibility = "public" | "private";
export type PersonaHalf = 1 | 2;
/** One timed piece of an ASR transcript, as stored in transcripts.segments. */
export interface TranscriptSegmentRow {
  text: string;
  startMs: number;
  endMs: number;
}
