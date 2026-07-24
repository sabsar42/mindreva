import "server-only";
import {
  EntriesRepository,
  TranscriptsRepository,
  type Entry,
  type EntryType,
  type Transcript,
} from "@mindreva/database";
import { getUser, createClient } from "@mindreva/auth/server";
import { transcribeEntry } from "./transcription.service";

/**
 * Business rules for entries (journals + notes). Route handlers call this;
 * it never touches Drizzle directly.
 */

async function requireUserId(): Promise<string> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

function extensionFromMimeType(mimeType: string): string {
  const subtype = mimeType.split(";")[0]?.split("/")[1];
  return subtype ?? "webm";
}

export async function listMyEntries(options?: {
  type?: EntryType;
  includeArchived?: boolean;
}): Promise<Entry[]> {
  const userId = await requireUserId();
  return EntriesRepository.listForUser(userId, options ?? {});
}

export async function countMyEntries(): Promise<number> {
  const userId = await requireUserId();
  return EntriesRepository.countForUser(userId);
}

export async function getMyEntry(id: string): Promise<Entry | null> {
  const userId = await requireUserId();
  return EntriesRepository.getByIdForUser(id, userId);
}

/** Trash an entry (soft delete). Never a hard delete. */
export async function trashMyEntry(id: string): Promise<Entry | null> {
  const userId = await requireUserId();
  return EntriesRepository.softDelete(id, userId);
}

/**
 * The record screen's write path: uploads the audio to Supabase Storage
 * (RLS-scoped to the caller via the session client), creates the
 * entry/recording/transcript rows transactionally, then runs transcription
 * synchronously. A transcription failure doesn't fail entry creation — the
 * transcript row already records status='failed' for the UI to show a retry.
 */
export async function createVoiceEntry(input: {
  audio: Buffer;
  mimeType: string;
  durationMs: number;
  type?: EntryType;
}): Promise<{ entryId: string }> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");

  const objectPath = `${user.id}/${crypto.randomUUID()}.${extensionFromMimeType(input.mimeType)}`;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from("recordings")
    .upload(objectPath, input.audio, { contentType: input.mimeType });
  if (uploadError) {
    throw new Error(`Recording upload failed: ${uploadError.message}`);
  }

  const { entry } = await EntriesRepository.createVoiceEntry({
    userId: user.id,
    type: input.type ?? "journal",
    storagePath: objectPath,
    durationMs: input.durationMs,
    mimeType: input.mimeType,
  });

  try {
    await transcribeEntry(entry.id, user.id);
  } catch {
    // transcribeEntry already persisted status='failed'; the review screen
    // will surface it. Entry creation itself still succeeded.
  }

  return { entryId: entry.id };
}

export async function getMyEntryTranscript(
  entryId: string,
): Promise<Transcript | null> {
  const userId = await requireUserId();
  return TranscriptsRepository.getByEntry(entryId, userId);
}

/** Save the user's correction. raw_text is never touched. */
export async function saveMyTranscriptEdit(
  entryId: string,
  editedText: string,
): Promise<Transcript | null> {
  const userId = await requireUserId();
  const transcript = await TranscriptsRepository.getByEntry(entryId, userId);
  if (!transcript) return null;
  return TranscriptsRepository.setEditedText(transcript.id, userId, editedText);
}
