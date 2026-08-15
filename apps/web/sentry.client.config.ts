// This file configures the initialization of Sentry on the client (browser).
// The config here runs whenever a user loads the app in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Sentry's free tier is capped by event volume, not time — sampling at
  // 100% during early development, low-traffic use is fine and gives full
  // visibility. Lower this once real traffic makes the free tier's monthly
  // cap a concern.
  tracesSampleRate: 1.0,

  // Session Replay: capture a low background rate always, but record every
  // session that actually hits an error, so an error report comes with a
  // replay to see exactly what the user did.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [Sentry.replayIntegration()],

  // No DSN configured yet (see NEXT_PUBLIC_SENTRY_DSN in .env.example) — the
  // SDK is a safe no-op without one, so this doesn't break anything if unset.
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
