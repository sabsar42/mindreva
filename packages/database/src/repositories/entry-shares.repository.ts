import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../client";
import {
  entries,
  entryShareRecipients,
  entryShares,
  type Entry,
  type EntryShare,
  type EntryShareRecipient,
  type ShareVisibility,
} from "../schema";

async function assertEntryOwned(
  entryId: string,
  userId: string,
): Promise<void> {
  const rows = await getDb()
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.id, entryId), eq(entries.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new Error("Entry not found for user");
}

export interface ShareWithRecipients {
  share: EntryShare;
  recipients: EntryShareRecipient[];
}

/**
 * Sharing for journal entries. Everything here that takes a userId is scoped to
 * entries that user owns (the owner's management surface). The ONE exception is
 * `getByToken`, which resolves a share link for a non-owner; it returns the raw
 * facts (share, entry, recipients) and the caller applies the access policy.
 */
export const EntrySharesRepository = {
  async getByEntry(
    entryId: string,
    userId: string,
  ): Promise<ShareWithRecipients | null> {
    const rows = await getDb()
      .select({ share: entryShares })
      .from(entryShares)
      .innerJoin(entries, eq(entries.id, entryShares.entryId))
      .where(and(eq(entryShares.entryId, entryId), eq(entries.userId, userId)))
      .limit(1);
    const share = rows[0]?.share;
    if (!share) return null;
    const recipients = await getDb()
      .select()
      .from(entryShareRecipients)
      .where(eq(entryShareRecipients.shareId, share.id))
      .orderBy(entryShareRecipients.createdAt);
    return { share, recipients };
  },

  /**
   * Turn sharing on, or change its visibility.
   *  - no row yet: create one with `token`;
   *  - active row: keep the same link, only update visibility;
   *  - revoked row: re-enable with the NEW `token`, so a link that was revoked
   *    can never work again.
   */
  async enable(input: {
    entryId: string;
    userId: string;
    visibility: ShareVisibility;
    token: string;
  }): Promise<EntryShare> {
    await assertEntryOwned(input.entryId, input.userId);
    const existing = await getDb()
      .select()
      .from(entryShares)
      .where(eq(entryShares.entryId, input.entryId))
      .limit(1);
    const current = existing[0];

    if (!current) {
      const rows = await getDb()
        .insert(entryShares)
        .values({
          entryId: input.entryId,
          visibility: input.visibility,
          token: input.token,
        })
        .returning();
      return rows[0]!;
    }

    const rows = await getDb()
      .update(entryShares)
      .set({
        visibility: input.visibility,
        updatedAt: new Date(),
        ...(current.revokedAt ? { revokedAt: null, token: input.token } : {}),
      })
      .where(eq(entryShares.id, current.id))
      .returning();
    return rows[0]!;
  },

  /** Disable the link. The row stays (so the owner can see it was shared). */
  async revoke(entryId: string, userId: string): Promise<EntryShare | null> {
    await assertEntryOwned(entryId, userId);
    const rows = await getDb()
      .update(entryShares)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(entryShares.entryId, entryId), isNull(entryShares.revokedAt)),
      )
      .returning();
    return rows[0] ?? null;
  },

  async addRecipient(
    entryId: string,
    userId: string,
    email: string,
  ): Promise<EntryShareRecipient | null> {
    const found = await this.getByEntry(entryId, userId);
    if (!found) return null;
    const rows = await getDb()
      .insert(entryShareRecipients)
      .values({ shareId: found.share.id, email: email.trim().toLowerCase() })
      .onConflictDoNothing()
      .returning();
    return rows[0] ?? null;
  },

  async removeRecipient(
    entryId: string,
    userId: string,
    email: string,
  ): Promise<void> {
    const found = await this.getByEntry(entryId, userId);
    if (!found) return;
    await getDb()
      .delete(entryShareRecipients)
      .where(
        and(
          eq(entryShareRecipients.shareId, found.share.id),
          eq(entryShareRecipients.email, email.trim().toLowerCase()),
        ),
      );
  },

  /**
   * Resolve a share link. NOT scoped to a user: the viewer is usually a
   * stranger. Returns the share, its (non-deleted) entry and the recipient
   * emails; the service decides who may see it. Soft-deleted entries resolve to
   * null so trashing an entry also kills its link.
   */
  async getByToken(token: string): Promise<{
    share: EntryShare;
    entry: Entry;
    recipientEmails: string[];
  } | null> {
    const rows = await getDb()
      .select({ share: entryShares, entry: entries })
      .from(entryShares)
      .innerJoin(entries, eq(entries.id, entryShares.entryId))
      .where(and(eq(entryShares.token, token), isNull(entries.deletedAt)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const recipients = await getDb()
      .select({ email: entryShareRecipients.email })
      .from(entryShareRecipients)
      .where(eq(entryShareRecipients.shareId, row.share.id));
    return {
      share: row.share,
      entry: row.entry,
      recipientEmails: recipients.map((r) => r.email),
    };
  },
};
