import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for OAuth refresh tokens at rest. Output format:
 * "v1.<iv>.<tag>.<ciphertext>" (base64url parts). The key is 32 bytes,
 * given as base64 in CALENDAR_TOKEN_KEY. A wrong key or a tampered value
 * fails authentication and throws; tokens are never logged.
 */
const VERSION = "v1";

export function parseKey(base64: string | undefined): Buffer | null {
  if (!base64) return null;
  try {
    const key = Buffer.from(base64, "base64");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

export function encryptToken(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ct]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

export function decryptToken(sealed: string, key: Buffer): string {
  const [version, iv, tag, ct] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !ct) {
    throw new Error("Unrecognised token format");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ct, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
