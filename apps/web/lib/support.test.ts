import { afterEach, describe, expect, it, vi } from "vitest";
import { contactEmail, supportUrl } from "./support";

afterEach(() => vi.unstubAllEnvs());

describe("supportUrl", () => {
  it("is hidden when unset or blank", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_URL", "");
    expect(supportUrl()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_URL", "   ");
    expect(supportUrl()).toBeNull();
  });
  it("accepts web pages only", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_URL", "https://ko-fi.com/mindreva");
    expect(supportUrl()).toBe("https://ko-fi.com/mindreva");
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_URL", "javascript:alert(1)");
    expect(supportUrl()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_URL", "data:text/html,hi");
    expect(supportUrl()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_URL", "not a url");
    expect(supportUrl()).toBeNull();
  });
});

describe("contactEmail", () => {
  it("returns a valid address or nothing", () => {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "hello@example.com");
    expect(contactEmail()).toBe("hello@example.com");
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "nope");
    expect(contactEmail()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", "");
    expect(contactEmail()).toBeNull();
  });
});

describe("supportUrl accepts only https", () => {
  it("hides an http link", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_URL", "http://ko-fi.com/x");
    expect(supportUrl()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_URL", "https://ko-fi.com/x");
    expect(supportUrl()).toBe("https://ko-fi.com/x");
  });
});
