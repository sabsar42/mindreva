import "server-only";
import {
  EntriesRepository,
  type Entry,
  type EntryType,
} from "@mindreva/database";
import { getUser } from "@mindreva/auth/server";

/**
 * Business rules for entries (journals + notes). Thin for now — the record →
 * transcript → summarize pipeline arrives in Phases 4-5. Route handlers call
 * this; it never touches Drizzle directly.
 */

async function requireUserId(): Promise<string> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
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
