import "server-only";
import { randomBytes } from "node:crypto";
import {
  EntryPhotosRepository,
  EntrySharesRepository,
  TranscriptsRepository,
  type ShareVisibility,
} from "@mindreva/database";
import { extractInlinePhotoIds } from "@mindreva/types";
import { getUser } from "@mindreva/auth/server";
import { createAdminClient } from "@/lib/supabase-admin";

/**
 * Sharing a journal entry by link.
 *
 * Two audiences, two kinds of function:
 *  - The OWNER manages sharing (get / enable / revoke / recipients). Every one
 *    of those resolves the signed-in user and is scoped to entries they own, so
 *    nobody else can create, change or read a share's settings.
 *  - A VIEWER opens a link. `resolveSharedEntry` is the one place that decides
 *    whether they may read it, and it re-checks everything on the server; the
 *    client never decides access.
 *
 * Nothing here can modify the entry: a link only ever yields a read-only
 * snapshot, and no mutation route accepts a share token.
 */

/** 32 random bytes as base64url: 43 chars, 256 bits, unguessable. */
export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class InvalidRecipientError extends Error {
  constructor() {
    super("Enter a valid email address.");
    this.name = "InvalidRecipientError";
  }
}

async function requireUserId(): Promise<string> {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export interface ShareState {
  /** True when a link currently works. */
  enabled: boolean;
  visibility: ShareVisibility | null;
  /** The path segment of the link, or null when sharing is off. */
  token: string | null;
  /** Emails allowed to open a private link. Always empty for public links. */
  recipients: string[];
}

const OFF: ShareState = {
  enabled: false,
  visibility: null,
  token: null,
  recipients: [],
};

/** Current sharing status for an entry the caller owns. */
export async function getMyShare(entryId: string): Promise<ShareState> {
  const userId = await requireUserId();
  const found = await EntrySharesRepository.getByEntry(entryId, userId);
  if (!found || found.share.revokedAt) return OFF;
  return {
    enabled: true,
    visibility: found.share.visibility,
    token: found.share.token,
    recipients: found.recipients.map((r) => r.email),
  };
}

/** Turn sharing on, or switch it between public and private. */
export async function setMyShare(
  entryId: string,
  visibility: ShareVisibility,
): Promise<ShareState> {
  const userId = await requireUserId();
  await EntrySharesRepository.enable({
    entryId,
    userId,
    visibility,
    token: generateShareToken(),
  });
  return getMyShare(entryId);
}

/** Disable the link. Sharing again later issues a different link. */
export async function revokeMyShare(entryId: string): Promise<ShareState> {
  const userId = await requireUserId();
  await EntrySharesRepository.revoke(entryId, userId);
  return OFF;
}

export async function addMyShareRecipient(
  entryId: string,
  email: string,
): Promise<ShareState> {
  const userId = await requireUserId();
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized) || normalized.length > 254) {
    throw new InvalidRecipientError();
  }
  await EntrySharesRepository.addRecipient(entryId, userId, normalized);
  const state = await getMyShare(entryId);
  // The repository is a no-op unless the caller owns the entry and has an
  // active link; report that as "not found" rather than a fake success.
  if (!state.enabled) throw new Error("Not found");
  return state;
}

export async function removeMyShareRecipient(
  entryId: string,
  email: string,
): Promise<ShareState> {
  const userId = await requireUserId();
  await EntrySharesRepository.removeRecipient(entryId, userId, email);
  return getMyShare(entryId);
}

/* -------------------------------------------------------------------------- */
/* Viewing a link                                                              */
/* -------------------------------------------------------------------------- */

export interface SharedEntry {
  title: string | null;
  entryDate: string | null;
  /** The journal body (Markdown with inline image tokens). */
  body: string;
  /** Signed URL for the cover image, if it has one and signing is available. */
  coverUrl: string | null;
  /** photoId -> signed URL for each inline image in the body. */
  imageUrls: Record<string, string>;
  /** True when the entry has images but this deployment can't sign them. */
  imagesUnavailable: boolean;
}

export type SharedEntryResult =
  | { status: "ok"; entry: SharedEntry; viewerIsOwner: boolean }
  /** Unknown, malformed, revoked or trashed. Deliberately indistinguishable. */
  | { status: "not_found" }
  /** A private link opened without signing in. */
  | { status: "sign_in_required" }
  /** Signed in, but not the owner and not on the recipient list. */
  | { status: "forbidden" };

const SHARED_IMAGE_URL_SECONDS = 60 * 60;

/**
 * Decide whether the current viewer may read this share, and if so return a
 * read-only snapshot. The order of checks matters:
 *   1. malformed token -> not_found (no database hit);
 *   2. unknown / revoked / trashed-entry -> not_found (one answer for all, so a
 *      revoked link can't be told apart from one that never existed);
 *   3. public -> allowed;
 *   4. private -> must be signed in, then must be the owner or a listed email.
 */
export async function resolveSharedEntry(
  token: string,
): Promise<SharedEntryResult> {
  if (!TOKEN_PATTERN.test(token)) return { status: "not_found" };

  const found = await EntrySharesRepository.getByToken(token);
  if (!found || found.share.revokedAt) return { status: "not_found" };

  const { share, entry, recipientEmails } = found;
  let viewerIsOwner = false;

  if (share.visibility === "private") {
    const viewer = await getUser();
    if (!viewer) return { status: "sign_in_required" };
    viewerIsOwner = viewer.id === entry.userId;
    const email = viewer.email?.toLowerCase() ?? null;
    const listed = email !== null && recipientEmails.includes(email);
    if (!viewerIsOwner && !listed) return { status: "forbidden" };
  } else {
    const viewer = await getUser();
    viewerIsOwner = viewer?.id === entry.userId;
  }

  // The owner id is the entry's own, already verified through the token, so
  // reading its transcript with that id is not a cross-user read.
  const transcript = await TranscriptsRepository.getByEntry(
    entry.id,
    entry.userId,
  );
  const body = transcript?.editedText ?? transcript?.rawText ?? "";

  const inlineIds = [...new Set(extractInlinePhotoIds(body))];
  const [inlinePhotos, cover] = await Promise.all([
    EntryPhotosRepository.listForSharedEntry(entry.id, inlineIds),
    EntryPhotosRepository.getCoverForSharedEntry(entry.id),
  ]);

  const toSign = [...inlinePhotos, ...(cover ? [cover] : [])];
  let signed = new Map<string, string>();
  let imagesUnavailable = false;
  if (toSign.length > 0) {
    const admin = createAdminClient();
    if (!admin) {
      imagesUnavailable = true;
    } else {
      const { data, error } = await admin.storage
        .from("photos")
        .createSignedUrls(
          toSign.map((p) => p.storagePath),
          SHARED_IMAGE_URL_SECONDS,
        );
      if (error || !data) {
        imagesUnavailable = true;
      } else {
        signed = new Map(
          data.flatMap((d) =>
            d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [],
          ),
        );
      }
    }
  }

  const imageUrls: Record<string, string> = {};
  for (const photo of inlinePhotos) {
    const url = signed.get(photo.storagePath);
    if (url) imageUrls[photo.id] = url;
  }

  return {
    status: "ok",
    viewerIsOwner,
    entry: {
      title: entry.title,
      entryDate: entry.entryDate,
      body,
      coverUrl: cover ? (signed.get(cover.storagePath) ?? null) : null,
      imageUrls,
      imagesUnavailable,
    },
  };
}
