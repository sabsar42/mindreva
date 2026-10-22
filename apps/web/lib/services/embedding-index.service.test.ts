import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getEntry = vi.fn();
const getTranscript = vi.fn();
const getHash = vi.fn();
const replaceForEntry = vi.fn();
const deleteForEntry = vi.fn();
const getProfile = vi.fn();
const markDone = vi.fn();
const markRetry = vi.fn();
const embedMany = vi.fn();
const tryUseDaily = vi.fn();
const refundDaily = vi.fn();
const recompute = vi.fn();

vi.mock("@mindreva/database", () => ({
  EntriesRepository: { getByIdForUser: getEntry },
  TranscriptsRepository: { getByEntry: getTranscript },
  ChunksRepository: {
    getHashForEntry: getHash,
    replaceForEntry,
    deleteForEntry,
  },
  ProfilesRepository: { getById: getProfile },
  EmbeddingJobsRepository: { markDone, markRetry },
}));
vi.mock("@mindreva/llm", () => ({
  getLLMProvider: () => ({ embedMany }),
}));
vi.mock("./usage.service", () => ({
  tryUseDaily,
  refundDaily,
  nextDailyReset: () => new Date("2026-10-23T00:00:00Z"),
}));
vi.mock("./mindmap.service", () => ({ recomputeMindmapForUser: recompute }));

const { indexEntry, runEmbeddingJob } =
  await import("./embedding-index.service");
const { contentHash } = await import("../retrieval/chunker");

const USER = "u1";
const ENTRY = "e1";
const job = { id: "j1", userId: USER, entryId: ENTRY, attempts: 0, lease: "t" };

beforeEach(() => {
  vi.clearAllMocks();
  getEntry.mockResolvedValue({
    id: ENTRY,
    entryDate: "2026-03-14",
    title: null,
  });
  getTranscript.mockResolvedValue({
    status: "done",
    rawText: "Walked by the river.",
    editedText: null,
  });
  getHash.mockResolvedValue(null);
  getProfile.mockResolvedValue({ timezone: "UTC" });
  tryUseDaily.mockResolvedValue(true);
  embedMany.mockImplementation(async (texts: string[]) =>
    texts.map(() => [0.1]),
  );
});

describe("indexEntry", () => {
  it("embeds a changed entry in one batched call and stores date-prefixed chunks", async () => {
    expect(await indexEntry(ENTRY, USER)).toEqual({
      status: "indexed",
      chunks: 1,
    });
    expect(embedMany).toHaveBeenCalledTimes(1);
    expect(embedMany.mock.calls[0]![0]).toEqual([
      "Date: 2026-03-14 (Saturday)\n\nWalked by the river.",
    ]);
    expect(replaceForEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        contentHash: contentHash("Walked by the river.", "2026-03-14"),
        plainText: "Walked by the river.",
      }),
    );
    expect(recompute).toHaveBeenCalledWith(USER);
  });

  it("makes zero API calls when only the formatting changed", async () => {
    getTranscript.mockResolvedValue({
      status: "done",
      rawText: "x",
      editedText: "Walked by the **river**.",
    });
    getHash.mockResolvedValue(
      contentHash("Walked by the river.", "2026-03-14"),
    );
    expect(await indexEntry(ENTRY, USER)).toEqual({ status: "unchanged" });
    expect(embedMany).not.toHaveBeenCalled();
    expect(tryUseDaily).not.toHaveBeenCalled();
  });

  it("waits at the daily embedding limit instead of calling the API", async () => {
    tryUseDaily.mockResolvedValue(false);
    expect(await indexEntry(ENTRY, USER)).toEqual({
      status: "daily-limit",
      retryAt: new Date("2026-10-23T00:00:00Z"),
    });
    expect(embedMany).not.toHaveBeenCalled();
  });

  it("refunds the unit and rethrows when the embedding call fails", async () => {
    embedMany.mockRejectedValue(new Error("upstream down"));
    await expect(indexEntry(ENTRY, USER)).rejects.toThrow("upstream down");
    expect(refundDaily).toHaveBeenCalledWith(USER, "embeddings");
    expect(replaceForEntry).not.toHaveBeenCalled();
  });

  it("waits while transcribing, clears when the text is gone, skips trashed", async () => {
    getTranscript.mockResolvedValueOnce({
      status: "processing",
      rawText: null,
      editedText: null,
    });
    expect(await indexEntry(ENTRY, USER)).toEqual({ status: "waiting" });

    getTranscript.mockResolvedValueOnce({
      status: "done",
      rawText: "  ",
      editedText: null,
    });
    expect(await indexEntry(ENTRY, USER)).toEqual({ status: "cleared" });
    expect(deleteForEntry).toHaveBeenCalledWith(ENTRY, USER);

    getEntry.mockResolvedValueOnce(null);
    expect(await indexEntry(ENTRY, USER)).toEqual({ status: "skipped" });
    expect(embedMany).not.toHaveBeenCalled();
  });
});

describe("runEmbeddingJob", () => {
  it("marks the job done after indexing", async () => {
    await runEmbeddingJob(job);
    expect(markDone).toHaveBeenCalledWith(job);
  });

  it("a real failure costs an attempt, with backoff", async () => {
    embedMany.mockRejectedValue(
      new Error("OpenRouter embedding failed (502): bad gateway"),
    );
    const before = Date.now();
    await runEmbeddingJob(job);
    const args = markRetry.mock.calls[0]![1];
    expect(args.countAttempt).toBe(true);
    expect(args.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(
      before + 5 * 60 * 1000,
    );
    expect(markDone).not.toHaveBeenCalled();
  });

  it("a rate limit waits without spending an attempt", async () => {
    embedMany.mockRejectedValue(
      new Error("OpenRouter embedding failed (429): rate limited"),
    );
    await runEmbeddingJob(job);
    expect(markRetry.mock.calls[0]![1].countAttempt).toBe(false);
  });

  it("a daily limit waits until the user's reset, no attempt spent", async () => {
    tryUseDaily.mockResolvedValue(false);
    await runEmbeddingJob(job);
    expect(markRetry.mock.calls[0]![1]).toMatchObject({
      nextAttemptAt: new Date("2026-10-23T00:00:00Z"),
      countAttempt: false,
    });
  });
});

describe("drainEmbeddingJobs", () => {
  it("refreshes each user's mindmap once at the end, not per entry", async () => {
    const { EmbeddingJobsRepository } = await import("@mindreva/database");
    const claim = vi
      .fn()
      .mockResolvedValueOnce({ ...job, id: "a", entryId: "e1" })
      .mockResolvedValueOnce({ ...job, id: "b", entryId: "e2" })
      .mockResolvedValueOnce(null);
    (
      EmbeddingJobsRepository as unknown as { claimDue: typeof claim }
    ).claimDue = claim;
    const { drainEmbeddingJobs } = await import("./embedding-index.service");
    const result = await drainEmbeddingJobs({ max: 10, budgetMs: 10_000 });
    expect(result).toEqual({ processed: 2, outcomes: { indexed: 2 } });
    expect(embedMany).toHaveBeenCalledTimes(2);
    expect(recompute).toHaveBeenCalledTimes(1);
    expect(recompute).toHaveBeenCalledWith(USER);
  });
});

describe("undated entries", () => {
  it("are filed under the day they were created, like Re-live Me sessions", async () => {
    getEntry.mockResolvedValue({
      id: ENTRY,
      entryDate: null,
      title: null,
      createdAt: new Date("2025-11-02T09:30:00Z"),
    });
    await indexEntry(ENTRY, USER);
    expect(embedMany.mock.calls[0]![0][0]).toMatch(
      /^Date: 2025-11-02 \(Sunday\)\n\n/,
    );
    expect(replaceForEntry).toHaveBeenCalledWith(
      expect.objectContaining({ entryDate: "2025-11-02" }),
    );
  });
});
