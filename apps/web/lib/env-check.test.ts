import { afterEach, describe, expect, it, vi } from "vitest";
import { checkEnv, enforceEnv } from "./env-check";

afterEach(() => vi.unstubAllEnvs());

function setCore() {
  vi.stubEnv("DATABASE_URL", "postgres://x");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
}

describe("checkEnv", () => {
  it("names each missing required variable", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(checkEnv().missingRequired).toEqual([
      "DATABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]);
  });

  it("warns per provider about what stops working, never printing values", () => {
    setCore();
    vi.stubEnv("LLM_PROVIDER", "openrouter");
    vi.stubEnv("OPENROUTER_API_KEY", "secret-value");
    vi.stubEnv("OPENROUTER_MODEL", "");
    vi.stubEnv("OPENROUTER_EMBEDDING_MODEL", "m");
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_URL", "http://ko-fi.com/x");
    const { missingRequired, warnings } = checkEnv();
    expect(missingRequired).toEqual([]);
    expect(
      warnings.some((w) => w.startsWith("OPENROUTER_MODEL is not set")),
    ).toBe(true);
    expect(warnings.some((w) => w.includes("NEXT_PUBLIC_SUPPORT_URL"))).toBe(
      true,
    );
    expect(warnings.join(" ")).not.toContain("secret-value");
  });
});

describe("enforceEnv", () => {
  it("throws in production when a required variable is missing", () => {
    setCore();
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => enforceEnv()).toThrow(/DATABASE_URL/);
  });

  it("only logs in development", () => {
    setCore();
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => enforceEnv()).not.toThrow();
    expect(error).toHaveBeenCalled();
  });
});
