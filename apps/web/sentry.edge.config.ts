// This file configures the initialization of Sentry for edge runtime
// (middleware, edge routes). Next.js runs middleware.ts on the edge
// runtime, which can't use the Node SDK — this separate, smaller config
// is what Sentry's Next.js integration requires for that runtime.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  enabled: !!(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
});
