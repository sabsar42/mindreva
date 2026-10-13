import { beforeEach, describe, expect, it, vi } from "vitest";

// The service imports "server-only", which throws outside Next; stub it the
// same way transcription.service.test.ts does.
vi.mock("server-only", () => ({}));

const getByToken = vi.fn();
const getTranscript = vi.fn();
const listForSharedEntry = vi.fn();
const getCoverForSharedEntry = vi.fn();
const getUser = vi.fn();
const createAdminClient = vi.fn();

vi.mock("@mindreva/database", () => ({
  EntrySharesRepository: { getByToken },
  TranscriptsRepository: { getByEntry: getTranscript },
  EntryPhotosRepository: { listForSharedEntry, getCoverForSharedEntry },
}));
vi.mock("@mindreva/auth/server", () => ({ getUser }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient }));

const { generateShareToken, resolveSharedEntry } =
  await import("./shares.service");

const OWNER = "owner-user-id";
const OTHER = "other-user-id";
const ENTRY = "entry-id";

function share(over: {
  visibility?: "public" | "private";
  revokedAt?: Date | null;
  recipientEmails?: string[];
}) {
  return {
    share: {
      id: "share-id",
      visibility: over.visibility ?? "public",
      revokedAt: over.revokedAt ?? null,
      token: "t",
    },
    entry: {
      id: ENTRY,
      userId: OWNER,
      title: "My day",
      entryDate: "2026-09-26",
    },
    recipientEmails: over.recipientEmails ?? [],
  };
}

const token = generateShareToken();

beforeEach(() => {
  vi.clearAllMocks();
  getTranscript.mockResolvedValue({
    editedText: "Hello **world**",
    rawText: "",
  });
  listForSharedEntry.mockResolvedValue([]);
  getCoverForSharedEntry.mockResolvedValue(null);
  getUser.mockResolvedValue(null);
  createAdminClient.mockReturnValue(null);
});

describe("generateShareToken", () => {
  it("is 43 url-safe characters and never repeats", () => {
    const a = generateShareToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateShareToken()).not.toBe(a);
  });
});

describe("resolveSharedEntry: link validity", () => {
  it("rejects a malformed token without touching the database", async () => {
    expect(await resolveSharedEntry("nope")).toEqual({ status: "not_found" });
    expect(getByToken).not.toHaveBeenCalled();
  });

  it("treats an unknown token as not found", async () => {
    getByToken.mockResolvedValue(null);
    expect(await resolveSharedEntry(token)).toEqual({ status: "not_found" });
  });

  it("treats a revoked link exactly like one that never existed", async () => {
    getByToken.mockResolvedValue(share({ revokedAt: new Date() }));
    expect(await resolveSharedEntry(token)).toEqual({ status: "not_found" });
  });
});

describe("resolveSharedEntry: public links", () => {
  it("lets a signed-out stranger read the entry", async () => {
    getByToken.mockResolvedValue(share({ visibility: "public" }));
    const result = await resolveSharedEntry(token);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.entry.title).toBe("My day");
      expect(result.entry.body).toBe("Hello **world**");
      expect(result.viewerIsOwner).toBe(false);
    }
  });
});

describe("resolveSharedEntry: private links", () => {
  it("asks a signed-out visitor to sign in instead of showing anything", async () => {
    getByToken.mockResolvedValue(share({ visibility: "private" }));
    expect(await resolveSharedEntry(token)).toEqual({
      status: "sign_in_required",
    });
    // Nothing about the entry is even read for an unauthenticated visitor.
    expect(getTranscript).not.toHaveBeenCalled();
  });

  it("forbids a signed-in user who is not on the list", async () => {
    getByToken.mockResolvedValue(
      share({ visibility: "private", recipientEmails: ["friend@example.com"] }),
    );
    getUser.mockResolvedValue({ id: OTHER, email: "stranger@example.com" });
    expect(await resolveSharedEntry(token)).toEqual({ status: "forbidden" });
    expect(getTranscript).not.toHaveBeenCalled();
  });

  it("allows a listed recipient, ignoring email case", async () => {
    getByToken.mockResolvedValue(
      share({ visibility: "private", recipientEmails: ["friend@example.com"] }),
    );
    getUser.mockResolvedValue({ id: OTHER, email: "Friend@Example.com" });
    const result = await resolveSharedEntry(token);
    expect(result.status).toBe("ok");
  });

  it("allows the owner without being on the list", async () => {
    getByToken.mockResolvedValue(share({ visibility: "private" }));
    getUser.mockResolvedValue({ id: OWNER, email: "me@example.com" });
    const result = await resolveSharedEntry(token);
    expect(result.status === "ok" && result.viewerIsOwner).toBe(true);
  });

  it("does not let a user with no email match an empty list entry", async () => {
    getByToken.mockResolvedValue(
      share({ visibility: "private", recipientEmails: [""] }),
    );
    getUser.mockResolvedValue({ id: OTHER, email: undefined });
    expect(await resolveSharedEntry(token)).toEqual({ status: "forbidden" });
  });
});

describe("resolveSharedEntry: images", () => {
  const PHOTO = "0b6f3f5e-1c2d-4e8a-9a41-3c5d7e9f1a22";
  const body = `Text\n\n![](mindreva-photo:${PHOTO}?size=m&align=left)\n\nMore`;

  it("only asks for photos referenced by this entry's own body", async () => {
    getByToken.mockResolvedValue(share({ visibility: "public" }));
    getTranscript.mockResolvedValue({ editedText: body, rawText: "" });
    await resolveSharedEntry(token);
    expect(listForSharedEntry).toHaveBeenCalledWith(ENTRY, [PHOTO]);
  });

  it("signs images with the admin client when it is configured", async () => {
    getByToken.mockResolvedValue(share({ visibility: "public" }));
    getTranscript.mockResolvedValue({ editedText: body, rawText: "" });
    listForSharedEntry.mockResolvedValue([
      { id: PHOTO, storagePath: "u/e/a.jpg" },
    ]);
    createAdminClient.mockReturnValue({
      storage: {
        from: () => ({
          createSignedUrls: async () => ({
            data: [{ path: "u/e/a.jpg", signedUrl: "https://signed/a" }],
            error: null,
          }),
        }),
      },
    });
    const result = await resolveSharedEntry(token);
    expect(result.status === "ok" && result.entry.imageUrls[PHOTO]).toBe(
      "https://signed/a",
    );
  });

  it("degrades to text with a flag when signing isn't available", async () => {
    getByToken.mockResolvedValue(share({ visibility: "public" }));
    getTranscript.mockResolvedValue({ editedText: body, rawText: "" });
    listForSharedEntry.mockResolvedValue([
      { id: PHOTO, storagePath: "u/e/a.jpg" },
    ]);
    const result = await resolveSharedEntry(token);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.entry.imagesUnavailable).toBe(true);
      expect(result.entry.imageUrls).toEqual({});
    }
  });
});
