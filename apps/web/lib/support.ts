/**
 * Mindreva is free. Supporting it is entirely voluntary and unlocks nothing:
 * no feature, limit or content anywhere in the app depends on it.
 *
 * The link target comes from NEXT_PUBLIC_SUPPORT_URL (a Ko-fi, Buy Me a Coffee
 * or similar page), so it can change without a code change. Empty or invalid
 * means there is no support link at all.
 */
export function supportUrl(): string | null {
  const raw = (process.env.NEXT_PUBLIC_SUPPORT_URL ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    // Only ever a secure web page: never http:, javascript:, data: or similar.
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** An address for privacy and deletion requests, shown only when set. */
export function contactEmail(): string | null {
  const raw = (process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : null;
}
