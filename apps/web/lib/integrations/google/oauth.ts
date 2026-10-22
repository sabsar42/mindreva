import { createHash, randomBytes } from "node:crypto";
import { GOOGLE_CALENDAR_SCOPES, type GoogleCalendarConfig } from "./config";

/**
 * Google OAuth 2.0, authorization-code flow with PKCE (S256) and a random
 * state, token exchange server-side only. Offline access for a refresh
 * token; incremental authorization (include_granted_scopes).
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

/** The refresh token was revoked or expired: the user must reconnect. */
export class GoogleReauthRequiredError extends Error {
  constructor() {
    super("Google access was revoked or expired");
    this.name = "GoogleReauthRequiredError";
  }
}

export function randomUrlToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildAuthUrl(
  config: GoogleCalendarConfig,
  state: string,
  codeVerifier: string,
): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    // Always show consent, so Google always returns a refresh token (it
    // only does on first consent otherwise, which breaks reconnecting).
    prompt: "consent",
    state,
    code_challenge: pkceChallenge(codeVerifier),
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

export interface TokenSet {
  accessToken: string;
  expiresAt: number;
  refreshToken: string | null;
  scope: string;
  email: string | null;
}

/** The email claim from an id_token received directly from Google over TLS. */
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as { email?: unknown };
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

async function tokenRequest(
  body: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<TokenSet> {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    id_token?: string;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    if (data.error === "invalid_grant") throw new GoogleReauthRequiredError();
    // Never include tokens or the response body in errors (they may be logged).
    throw new Error(
      `Google token request failed (${res.status} ${data.error ?? ""})`,
    );
  }
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    refreshToken: data.refresh_token ?? null,
    scope: data.scope ?? "",
    email: emailFromIdToken(data.id_token),
  };
}

export function exchangeCode(
  config: GoogleCalendarConfig,
  code: string,
  codeVerifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TokenSet> {
  return tokenRequest(
    {
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
    },
    fetchImpl,
  );
}

export function refreshAccessToken(
  config: GoogleCalendarConfig,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TokenSet> {
  return tokenRequest(
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    },
    fetchImpl,
  );
}

/** Best effort: revoking an already-revoked token is not an error for us. */
export async function revokeToken(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  try {
    await fetchImpl(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      cache: "no-store",
    });
  } catch {
    // Network failure: the stored token is still deleted on our side.
  }
}
