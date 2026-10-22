// Next.js's instrumentation hook: register() runs once per server/edge
// process startup, before any request is handled. This is Sentry's current
// recommended entry point for server-side init (replacing manual imports of
// sentry.server.config.ts / sentry.edge.config.ts in older SDK versions).
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    // Fail fast, with a clear message, on a missing required variable.
    const { enforceEnv } = await import("./lib/env-check");
    enforceEnv();
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: typeof import("@sentry/nextjs").captureRequestError =
  (...args) => {
    // Deferred import so this file has no top-level Sentry dependency on the
    // edge runtime before register() has had a chance to configure it.
    void import("@sentry/nextjs").then(({ captureRequestError }) =>
      captureRequestError(...args),
    );
  };
