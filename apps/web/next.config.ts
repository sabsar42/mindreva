import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Security headers for every response. The CSP allows exactly what the app
 * loads: its own origin, and the Supabase project (sign-in calls, signed
 * photo/audio URLs, realtime), plus SupportKori for the optional tip widget on
 * the Account screen (its script, and the panel it opens in a frame). 'unsafe-inline' scripts are needed for Next's
 * inline bootstrap and the pre-paint theme script (no nonce plumbing yet);
 * everything else is locked: no framing (clickjacking), no plugins, no
 * foreign forms, no other origins. 'unsafe-eval' only in development (React
 * dev tooling needs it).
 */
function securityHeaders() {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : "";
  const supabaseWs = supabase.replace(/^http/, "ws");
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://www.supportkori.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase}`,
    `media-src 'self' blob: ${supabase}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${supabaseWs}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "frame-src https://supportkori.com https://www.supportkori.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    // The microphone is used by this site only; nothing else is.
    {
      key: "Permissions-Policy",
      value: "microphone=(self), camera=(), geolocation=(), payment=(), usb=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(dev
      ? []
      : [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ]),
  ];
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
  transpilePackages: [
    "@mindreva/types",
    "@mindreva/ui",
    "@mindreva/auth",
    "@mindreva/database",
    "@mindreva/asr",
    "@mindreva/llm",
  ],
  experimental: {
    // Next.js 15's own default for dynamic routes (journal/notes/entry
    // detail/etc — anything reading cookies per-request) is staleTimes.dynamic
    // = 0, meaning the Router Cache is effectively off for them: EVERY
    // client-side navigation to a dynamic route, including router.back() and
    // the browser's own back button, re-runs the full server component. That
    // was the real cause of "back into journal reloads from scratch, but the
    // browser's native back is instant" — the browser's back button can use
    // its own bfcache (a full page snapshot), which Next's Router Cache has
    // no default equivalent for at 0s.
    //
    // 30s is a deliberate tradeoff: every mutation that needs fresh data
    // already calls router.refresh() explicitly (archive/trash/restore,
    // a memory finishing forming — see those call sites), which bypasses this
    // cache regardless of its duration. So the only thing this affects is
    // pure back/forward navigation with no mutation involved, which is
    // exactly the case that should be instant.
    staleTimes: {
      dynamic: 30,
    },
  },
};

// withSentryConfig wraps the build to upload source maps (via the sentry-cli
// binary installed by @sentry/cli's postinstall script) so stack traces in
// Sentry point at real TypeScript source, not minified bundle code. It's a
// safe no-op locally without SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT set
// — only CI/Vercel builds need those, to actually upload maps.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  // Route Sentry's own tunneling through the app to avoid ad-blockers
  // dropping error reports client-side.
  tunnelRoute: "/monitoring",
  // disableLogger is deprecated in this SDK version; this is its replacement.
  webpack: { treeshake: { removeDebugLogging: true } },
});
