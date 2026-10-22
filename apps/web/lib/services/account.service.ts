import "server-only";
import { disconnectCalendarForUser } from "./calendar.service";
import { getUser } from "@mindreva/auth/server";
import { createAdminClient } from "../supabase-admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/** Storage buckets that hold per-user files under "<userId>/…". */
const USER_BUCKETS = ["recordings", "photos"] as const;
const LIST_PAGE = 1000;
const REMOVE_BATCH = 100;

/** Every file path under `prefix`, walking sub-folders (photos are stored as
 * <user>/<entry>/<file>, plus a .thumb next to each cover). */
async function listFilesRecursive(
  admin: AdminClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: LIST_PAGE, offset });
    if (error)
      throw new Error(`Listing ${bucket}/${prefix} failed: ${error.message}`);
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      // Folders come back without an id.
      if (item.id === null)
        files.push(...(await listFilesRecursive(admin, bucket, path)));
      else files.push(path);
    }
    if (!data || data.length < LIST_PAGE) break;
  }
  return files;
}

/** Removes every file the user owns, in all buckets. Safe to repeat. */
export async function removeUserFiles(
  admin: AdminClient,
  userId: string,
): Promise<number> {
  let removed = 0;
  for (const bucket of USER_BUCKETS) {
    const paths = await listFilesRecursive(admin, bucket, userId);
    for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
      const batch = paths.slice(i, i + REMOVE_BATCH);
      const { error } = await admin.storage.from(bucket).remove(batch);
      if (error)
        throw new Error(`Removing ${bucket} files failed: ${error.message}`);
      removed += batch.length;
    }
  }
  return removed;
}

/**
 * Permanently deletes the signed-in user's account and everything in it.
 *
 * Files first, then the login: deleting the auth user cascades in the
 * database (profiles -> entries -> transcripts, summaries, chunks, jobs,
 * photos rows, chats, shares, activity…), but Storage objects don't cascade.
 * Doing files first means a failure part-way leaves the account in place to
 * retry, never orphaned files that no account owns.
 *
 * This is the one deliberate exception to "entries are soft-deleted only":
 * a person asking for their account to be erased must actually be erased.
 */
export async function deleteMyAccount(): Promise<void> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  const admin = createAdminClient();
  if (!admin) {
    throw new Error(
      "Account deletion needs SUPABASE_SERVICE_ROLE_KEY on the server.",
    );
  }
  // Revoke Google Calendar access with Google first (best effort); the
  // stored row itself goes with the cascade below.
  await disconnectCalendarForUser(user.id).catch(() => {});
  await removeUserFiles(admin, user.id);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw new Error(`Deleting the account failed: ${error.message}`);
}
