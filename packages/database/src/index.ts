/**
 * Public surface of @mindreva/database. Consumers get REPOSITORIES and domain
 * TYPES only — never the Drizzle client or table objects. Business logic talks
 * to repositories; repositories are the sole owners of Drizzle (enforced by the
 * ESLint no-restricted-imports rule in this package).
 */

export {
  ProfilesRepository,
  type DailyUsageKind,
} from "./repositories/profiles.repository";
export {
  EntriesRepository,
  type EntryListItem,
  type ListEntriesOptions,
} from "./repositories/entries.repository";
export { RecordingsRepository } from "./repositories/recordings.repository";
export { EntryPhotosRepository } from "./repositories/entry-photos.repository";
export { EntryTasksRepository } from "./repositories/entry-tasks.repository";
export {
  EntrySharesRepository,
  type ShareWithRecipients,
} from "./repositories/entry-shares.repository";
export { TranscriptsRepository } from "./repositories/transcripts.repository";
export { SummariesRepository } from "./repositories/summaries.repository";
export {
  EmbeddingsRepository,
  type MatchedEntry,
} from "./repositories/embeddings.repository";
export { ChatRepository } from "./repositories/chat.repository";
export { AppLoginsRepository } from "./repositories/app-logins.repository";
export {
  MindmapRepository,
  membershipKey,
  type ClusterWithEntries,
  type ComputedCluster,
  type EmbeddedEntry,
} from "./repositories/mindmap.repository";
// Pure clustering math (no Drizzle) used by the mindmap service. Exported here
// rather than from a separate package because it's defined entirely in terms
// of this package's EmbeddedEntry shape.
export {
  clusterCountFor,
  cosineSimilarity,
  kMeansCluster,
  mostRepresentative,
  type ClusterAssignment,
} from "./lib/cluster";

export type {
  Profile,
  NewProfile,
  Entry,
  NewEntry,
  Recording,
  NewRecording,
  EntryPhoto,
  NewEntryPhoto,
  EntryTask,
  NewEntryTask,
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
  EntryShare,
  NewEntryShare,
  EntryShareRecipient,
  AppLogin,
  MindmapCluster,
  NewMindmapCluster,
  MindmapClusterEntry,
  NewMindmapClusterEntry,
  EntryType,
  EntrySource,
  TranscriptStatus,
  ChatRole,
  EntryPhotoKind,
  ShareVisibility,
  PersonaHalf,
  TranscriptSegmentRow,
} from "./schema";
export {
  ChunksRepository,
  type ChunkHit,
  type ChunkToStore,
  type KeywordHit,
  type VectorHit,
} from "./repositories/entry-chunks.repository";
export {
  EmbeddingJobsRepository,
  type ClaimedEmbeddingJob,
} from "./repositories/embedding-jobs.repository";
