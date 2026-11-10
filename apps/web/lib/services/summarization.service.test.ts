import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getTranscript = vi.fn();
const getProfile = vi.fn();
const setSummaryRetry = vi.fn();
const claimDueSummaryRetry = vi.fn();
const createSummary = vi.fn();
const getEntry = vi.fn();
const replaceTasks = vi.fn();
const upsertEmbedding = vi.fn();
const complete = vi.fn();
const embed = vi.fn();
const tryUseDaily = vi.fn();
const refundDaily = vi.fn();

vi.mock("@mindreva/database", () => ({
  TranscriptsRepository: { getByEntry: getTranscript },
  ProfilesRepository: { getById: getProfile },
  EntriesRepository: {
    setSummaryRetry,
    claimDueSummaryRetry,
    getByIdForUser: getEntry,
    update: vi.fn(),
  },
  SummariesRepository: { create: createSummary },
  EntryTasksRepository: { replaceForEntry: replaceTasks },
  EmbeddingsRepository: { upsertForEntry: upsertEmbedding },
}));
vi.mock("@mindreva/llm", () => ({
  getLLMProvider: () => ({ name: "openrouter", complete, embed }),
  resolveSummaryPrompt: () => ({
    promptVersion: "v1",
    buildMessages: (t: string) => [{ role: "user", content: t }],
  }),
  parseTaskBlock: (raw: string) => ({ summaryText: raw, tasks: [] }),
  parseTitleLine: (raw: string) => ({ title: null, rest: raw }),
}));
vi.mock("./mindmap.service", () => ({ recomputeMindmapForUser: vi.fn() }));
vi.mock("./usage.service", () => ({
  tryUseDaily,
  refundDaily,
  nextDailyReset: () => new Date("2026-10-23T00:00:00Z"),
}));

const { summarizeEntry, retryDueSummary } =
  await import("./summarization.service");

const USER = "user-1";
const ENTRY = "entry-1";

beforeEach(() => {
  vi.clearAllMocks();
  getTranscript.mockResolvedValue({
    status: "done",
    rawText: "Went running.",
    editedText: null,
  });
  getProfile.mockResolvedValue({ timezone: "UTC", summaryStyle: "general" });
  tryUseDaily.mockResolvedValue(true);
  getEntry.mockResolvedValue({ id: ENTRY, title: "Run" });
  embed.mockResolvedValue([0.1]);
});

describe("summarizeEntry", () => {
  it("stores the model that actually answered (the repository clears the retry mark)", async () => {
    complete.mockResolvedValue({
      text: "A run.",
      model: "google/gemma-4-31b-it:free",
      provider: "openrouter",
    });
    expect(await summarizeEntry(ENTRY, USER)).toEqual({ status: "done" });
    expect(createSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "google/gemma-4-31b-it:free",
        provider: "openrouter",
      }),
    );
    expect(setSummaryRetry).not.toHaveBeenCalled();
  });

  it("over the daily limit: no AI call, pending until the user's midnight", async () => {
    tryUseDaily.mockResolvedValue(false);
    const outcome = await summarizeEntry(ENTRY, USER);
    expect(outcome).toMatchObject({ status: "pending", reason: "daily-limit" });
    expect(complete).not.toHaveBeenCalled();
    expect(setSummaryRetry).toHaveBeenCalledWith(
      ENTRY,
      USER,
      new Date("2026-10-23T00:00:00Z"),
    );
  });

  it("when every provider fails: refunds, marks pending, never throws", async () => {
    complete.mockRejectedValue(
      new Error("All LLM providers failed. openrouter: (429) | groq: (429)"),
    );
    const outcome = await summarizeEntry(ENTRY, USER);
    expect(outcome).toMatchObject({
      status: "pending",
      reason: "provider-limit",
    });
    expect(refundDaily).toHaveBeenCalledWith(USER, "summaries");
    expect(createSummary).not.toHaveBeenCalled();
    expect(setSummaryRetry).toHaveBeenCalledWith(ENTRY, USER, expect.any(Date));
  });

  it("an entry still transcribing is rescheduled, not dropped", async () => {
    getTranscript.mockResolvedValue({
      status: "processing",
      rawText: null,
      editedText: null,
    });
    expect(await summarizeEntry(ENTRY, USER)).toEqual({ status: "skipped" });
    expect(setSummaryRetry).toHaveBeenCalledWith(ENTRY, USER, expect.any(Date));
    expect(tryUseDaily).not.toHaveBeenCalled();
  });

  it("a failed transcription stops the retries", async () => {
    getTranscript.mockResolvedValue({
      status: "failed",
      rawText: null,
      editedText: null,
    });
    await summarizeEntry(ENTRY, USER);
    expect(setSummaryRetry).toHaveBeenCalledWith(ENTRY, USER, null);
  });
});

describe("retryDueSummary", () => {
  it("does nothing when no entry is due", async () => {
    claimDueSummaryRetry.mockResolvedValue(null);
    expect(await retryDueSummary(USER)).toBeNull();
    expect(getTranscript).not.toHaveBeenCalled();
  });

  it("summarizes the claimed entry", async () => {
    claimDueSummaryRetry.mockResolvedValue(ENTRY);
    complete.mockResolvedValue({ text: "x", model: "m", provider: "groq" });
    expect(await retryDueSummary(USER)).toEqual({ status: "done" });
    expect(getTranscript).toHaveBeenCalledWith(ENTRY, USER);
  });
});
