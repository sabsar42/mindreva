/**
 * Public surface of @mindreva/database. Consumers get REPOSITORIES and domain
 * TYPES only — never the Drizzle client or table objects. Business logic talks
 * to repositories; repositories are the sole owners of Drizzle (enforced by the
 * ESLint no-restricted-imports rule in this package).
 */

export { ProfilesRepository } from "./repositories/profiles.repository";
export {
  EntriesRepository,
  type EntryListItem,
  type ListEntriesOptions,
} from "./repositories/entries.repository";
export { RecordingsRepository } from "./repositories/recordings.repository";
export { EntryPhotosRepository } from "./repositories/entry-photos.repository";
export { TranscriptsRepository } from "./repositories/transcripts.repository";
export { SummariesRepository } from "./repositories/summaries.repository";
export {
  EmbeddingsRepository,
  type MatchedEntry,
} from "./repositories/embeddings.repository";
export { ChatRepository } from "./repositories/chat.repository";

export type {
  Profile,
  NewProfile,
  Entry,
  NewEntry,
  Recording,
  NewRecording,
  EntryPhoto,
  NewEntryPhoto,
  Transcript,
  NewTranscript,
  Summary,
  NewSummary,
  Embedding,
  NewEmbedding,
  ChatSession,
  NewChatSession,
  ChatMessage,
  NewChatMessage,
  EntryType,
  EntrySource,
  TranscriptStatus,
  ChatRole,
} from "./schema";
