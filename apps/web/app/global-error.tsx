"use client";

// Next.js's last-resort error boundary: catches errors the root layout
// itself throws, which no other error.tsx in the tree can. It replaces the
// entire <html> document, so it must not depend on globals.css or any
// component from @mindreva/ui — none of that is guaranteed to have loaded.
// https://nextjs.org/docs/app/api-reference/file-conventions/error#global-errorjs

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, system-ui, "Helvetica Neue", sans-serif',
          display: "flex",
          minHeight: "100dvh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "1.5rem",
          textAlign: "center",
          // Inline on purpose: this replaces the root layout, so the token
          // stylesheet may not be loaded. Values mirror tokens.css (light).
          color: "#1d1d1f",
          background: "#f5f5f7",
        }}
      >
        <p style={{ fontSize: "1.125rem", fontWeight: 600 }}>
          Something went wrong.
        </p>
        <p
          style={{ fontSize: "0.875rem", color: "#6a6a70", maxWidth: "24rem" }}
        >
          The error has been reported. Try reloading the page.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: "0.5rem",
            minHeight: "2.75rem",
            padding: "0 1.5rem",
            borderRadius: "9999px",
            border: "none",
            background: "#26623f",
            color: "#ffffff",
            fontSize: "1.0625rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
