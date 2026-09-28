import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { EntriesRepository, TranscriptsRepository } from "@mindreva/database";
import { getASRProvider } from "@mindreva/asr";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env.local") });

// Next.js aliases "server-only" to a no-op only inside its own webpack/
// turbopack server compilation; the raw npm package always throws. Vitest
// doesn't know about that aliasing, so stub it the same way Next does.
vi.mock("server-only", () => ({}));

// Real database (same live project the RLS check uses), fake ASR + Storage —
// the only two genuinely external I/O boundaries in the record -> transcribe
// pipeline. This proves the actual status-transition logic, not a rewrite of
// it, against the real repository layer and RLS-backed schema.
vi.mock("@mindreva/asr", () => ({
  getASRProvider: vi.fn(() => ({
    name: "groq",
    transcribe: vi.fn().mockResolvedValue({
      text: "This is a mocked transcript.",
      language: "en",
      durationMs: 1200,
      segments: [],
      provider: "groq",
    }),
  })),
}));

vi.mock("@mindreva/auth/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    storage: {
      from: () => ({
        download: vi.fn().mockResolvedValue({
          data: new Blob([new Uint8Array([0, 1, 2, 3])], {
            type: "audio/webm",
          }),
          error: null,
        }),
      }),
    },
  }),
}));

const { transcribeEntry } = await import("./transcription.service");

const requiredEnv = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const missingEnv = requiredEnv.filter((k) => !process.env[k]);

describe.skipIf(missingEnv.length > 0)("transcribeEntry", () => {
  // Constructed inside beforeAll, not at describe-body scope: describe()'s
  // callback always runs to register the test tree (skipIf only skips the
  // its), so building this here would throw in CI, where SUPABASE_URL is
  // intentionally unset — see the CI workflow's comment on this file.
  let admin: ReturnType<typeof createAdminClient>;
  let userId: string;

  beforeAll(async () => {
    admin = createAdminClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data, error } = await admin.auth.admin.createUser({
      email: `asr-test-${Date.now()}@example.com`,
      password: "Test-pw-123456",
      email_confirm: true,
    });
    if (error || !data.user) {
      throw error ?? new Error("failed to create test user");
    }
    userId = data.user.id;
  });

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
  });

  it("moves a transcript from pending to done via the mocked ASR provider", async () => {
    const { entry, transcript } = await EntriesRepository.createVoiceEntry({
      userId,
      type: "journal",
      storagePath: `${userId}/test.webm`,
      durationMs: 1200,
      mimeType: "audio/webm",
    });
    expect(transcript.status).toBe("pending");

    await transcribeEntry(entry.id, userId);

    const updated = await TranscriptsRepository.getByEntry(entry.id, userId);
    expect(updated?.status).toBe("done");
    expect(updated?.rawText).toBe("This is a mocked transcript.");
    expect(updated?.provider).toBe("groq");
  });

  it("marks the transcript failed when the ASR provider throws", async () => {
    vi.mocked(getASRProvider).mockReturnValueOnce({
      name: "groq",
      transcribe: vi.fn().mockRejectedValue(new Error("boom")),
    });

    const { entry } = await EntriesRepository.createVoiceEntry({
      userId,
      type: "journal",
      storagePath: `${userId}/test2.webm`,
      durationMs: 800,
      mimeType: "audio/webm",
    });

    await expect(transcribeEntry(entry.id, userId)).rejects.toThrow();

    const updated = await TranscriptsRepository.getByEntry(entry.id, userId);
    expect(updated?.status).toBe("failed");
  });
});
