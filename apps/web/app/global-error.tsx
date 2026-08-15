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
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "1.5rem",
          textAlign: "center",
          color: "#1a1712",
          background: "#faf9f6",
        }}
      >
        <p style={{ fontSize: "1.125rem", fontWeight: 600 }}>
          Something went wrong.
        </p>
        <p
          style={{ fontSize: "0.875rem", color: "#635c4d", maxWidth: "24rem" }}
        >
          The error has been reported. Try reloading the page.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 1.25rem",
            borderRadius: "0.625rem",
            border: "none",
            background: "#26623f",
            color: "#ffffff",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
