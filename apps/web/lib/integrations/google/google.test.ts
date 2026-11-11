import { describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptToken, encryptToken, parseKey } from "./crypto";
import { getGoogleCalendarConfig } from "./config";
import {
  GoogleReauthRequiredError,
  buildAuthUrl,
  emailFromIdToken,
  exchangeCode,
  pkceChallenge,
  refreshAccessToken,
} from "./oauth";
import {
  GoogleUnauthorizedError,
  googleGet,
  mapCalendars,
  mapEvents,
  sortEvents,
} from "./calendar-api";

const key = randomBytes(32);
const env = {
  GOOGLE_CLIENT_ID: "cid.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "secret",
  GOOGLE_REDIRECT_URI:
    "https://app.example.com/api/integrations/google-calendar/callback",
  CALENDAR_TOKEN_KEY: key.toString("base64"),
} as unknown as NodeJS.ProcessEnv;

describe("token encryption", () => {
  it("round-trips and never stores the plain token", () => {
    const sealed = encryptToken("1//refresh-token", key);
    expect(sealed).not.toContain("refresh-token");
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(decryptToken(sealed, key)).toBe("1//refresh-token");
  });

  it("uses a fresh IV each time", () => {
    expect(encryptToken("same", key)).not.toBe(encryptToken("same", key));
  });

  it("rejects a tampered value or the wrong key", () => {
    const sealed = encryptToken("token", key);
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptToken(parts.join("."), key)).toThrow();
    expect(() => decryptToken(sealed, randomBytes(32))).toThrow();
    expect(() => decryptToken("garbage", key)).toThrow();
  });

  it("only accepts 32-byte keys", () => {
    expect(parseKey(randomBytes(16).toString("base64"))).toBeNull();
    expect(parseKey(undefined)).toBeNull();
    expect(parseKey(key.toString("base64"))?.length).toBe(32);
  });
});

describe("config", () => {
  it("is off unless every setting is present and valid", () => {
    expect(getGoogleCalendarConfig(env)).not.toBeNull();
    expect(
      getGoogleCalendarConfig({ ...env, GOOGLE_CLIENT_SECRET: "" }),
    ).toBeNull();
    expect(
      getGoogleCalendarConfig({ ...env, CALENDAR_TOKEN_KEY: "short" }),
    ).toBeNull();
    expect(
      getGoogleCalendarConfig({
        ...env,
        GOOGLE_REDIRECT_URI: "http://evil.example/cb",
      }),
    ).toBeNull();
    expect(
      getGoogleCalendarConfig({
        ...env,
        GOOGLE_REDIRECT_URI:
          "http://localhost:3000/api/integrations/google-calendar/callback",
      }),
    ).not.toBeNull();
  });
});

describe("oauth", () => {
  const config = getGoogleCalendarConfig(env)!;

  it("computes the RFC 7636 S256 challenge", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("asks for calendar read and event access, offline, with state and PKCE", () => {
    const url = new URL(buildAuthUrl(config, "st4te", "verifier"));
    const p = url.searchParams;
    expect(url.origin).toBe("https://accounts.google.com");
    expect(p.get("scope")).toBe(
      "openid email https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events",
    );
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("include_granted_scopes")).toBe("true");
    expect(p.get("state")).toBe("st4te");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("code_challenge")).toBe(pkceChallenge("verifier"));
    expect(p.get("redirect_uri")).toBe(env.GOOGLE_REDIRECT_URI);
    expect(url.toString()).not.toContain("secret");
  });

  it("exchanges a code server-side and reads the email", async () => {
    const idToken = `x.${Buffer.from(JSON.stringify({ email: "a@b.co" })).toString("base64url")}.y`;
    const fetchImpl = vi.fn(async () =>
      Response.json({
        access_token: "at",
        expires_in: 3600,
        refresh_token: "rt",
        scope: "https://www.googleapis.com/auth/calendar.readonly",
        id_token: idToken,
      }),
    );
    const t = await exchangeCode(config, "code", "verifier", fetchImpl);
    expect(t).toMatchObject({
      accessToken: "at",
      refreshToken: "rt",
      email: "a@b.co",
    });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = String(init.body);
    expect(body).toContain("code_verifier=verifier");
    expect(body).toContain("grant_type=authorization_code");
  });

  it("turns invalid_grant into a reconnect, and never leaks tokens in errors", async () => {
    const revoked = vi.fn(async () =>
      Response.json({ error: "invalid_grant" }, { status: 400 }),
    );
    await expect(
      refreshAccessToken(config, "rt-secret", revoked),
    ).rejects.toBeInstanceOf(GoogleReauthRequiredError);
    const broken = vi.fn(async () =>
      Response.json({ error: "server_error" }, { status: 500 }),
    );
    const err = await refreshAccessToken(config, "rt-secret", broken).catch(
      (e: Error) => e,
    );
    expect(String(err)).not.toContain("rt-secret");
  });

  it("reads the email claim defensively", () => {
    expect(emailFromIdToken(undefined)).toBeNull();
    expect(emailFromIdToken("not.a.jwt")).toBeNull();
  });
});

describe("calendar api", () => {
  it("maps timed, all-day, untitled and cancelled events", () => {
    const events = mapEvents("primary", [
      {
        id: "1",
        summary: "Standup",
        start: { dateTime: "2026-10-23T09:30:00+06:00" },
        end: { dateTime: "2026-10-23T09:45:00+06:00" },
      },
      {
        id: "2",
        summary: "Holiday",
        start: { date: "2026-10-23" },
        end: { date: "2026-10-24" },
      },
      {
        id: "3",
        start: { dateTime: "2026-10-23T12:00:00+06:00" },
        end: { dateTime: "2026-10-23T13:00:00+06:00" },
      },
      {
        id: "4",
        status: "cancelled",
        summary: "Gone",
        start: { date: "2026-10-23" },
      },
      { summary: "no id", start: { date: "2026-10-23" } },
    ]);
    expect(events.map((e) => [e.id, e.title, e.allDay])).toEqual([
      ["1", "Standup", false],
      ["2", "Holiday", true],
      ["3", "(No title)", false],
    ]);
    expect(sortEvents(events).map((e) => e.id)).toEqual(["2", "1", "3"]);
  });

  it("lists visible calendars, main one first", () => {
    expect(
      mapCalendars([
        { id: "b", summary: "Work" },
        { id: "x", summary: "Hidden", hidden: true },
        { id: "a", summary: "Me", primary: true, backgroundColor: "#123456" },
      ]).map((c) => c.id),
    ).toEqual(["a", "b"]);
  });

  it("retries rate limits with backoff, then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ items: [] }));
    await expect(googleGet("/x", {}, "at", fetchImpl, [1, 1])).resolves.toEqual(
      { items: [] },
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("gives up after the retries and treats 401 as unauthorized", async () => {
    const always429 = vi.fn(async () => new Response("", { status: 429 }));
    await expect(googleGet("/x", {}, "at", always429, [1, 1])).rejects.toThrow(
      "429",
    );
    const unauthorized = vi.fn(async () => new Response("", { status: 401 }));
    await expect(
      googleGet("/x", {}, "at", unauthorized),
    ).rejects.toBeInstanceOf(GoogleUnauthorizedError);
  });
});
