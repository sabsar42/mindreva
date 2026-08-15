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
