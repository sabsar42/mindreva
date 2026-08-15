import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
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
    // transcription-watcher — see those call sites), which bypasses this
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
