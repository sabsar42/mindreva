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

/** Where the optional SupportKori tip widget is served from (see SupportWidget). */
export const SUPPORT_WIDGET_SCRIPT = "https://www.supportkori.com/widget.js";

export interface SupportWidgetConfig {
  id: string;
  message: string;
  color: string;
}

/**
 * The SupportKori "tip jar" widget: a small floating button on the Account
 * screen that opens a payment panel. Like the support link it is voluntary and
 * unlocks nothing. NEXT_PUBLIC_SUPPORT_WIDGET_ID picks the creator handle
 * (default: the project's own); set it to "off" to hide the widget entirely.
 */
export function supportWidget(): SupportWidgetConfig | null {
  const raw = (process.env.NEXT_PUBLIC_SUPPORT_WIDGET_ID ?? "").trim();
  if (raw.toLowerCase() === "off") return null;
  const id = raw || "shakibabsar";
  // A handle only: letters, digits, dashes and underscores.
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return null;
  return { id, message: "Support Mindreva", color: "#10B981" };
}
