"use client";

// Next.js's last-resort error boundary: catches errors the root layout
// itself throws, which no other error.tsx in the tree can. It replaces the
// entire <html> document, so it must not depend on globals.css or any
// component from @mindreva/ui — none of that is guaranteed to have loaded.
// https://nextjs.org/docs/app/api-reference/file-conventions/error#global-errorjs

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Self-contained styles: the token stylesheet may not be loaded here. The
// variable names and values mirror packages/ui/src/styles/tokens.css, light
// and dark, so this page still looks like the app in both themes.
const STYLES = `
:root {
  --background: #f5f5f7;
  --foreground: #1d1d1f;
  --muted-foreground: #6a6a70;
  --primary: #26623f;
  --primary-foreground: #ffffff;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
    --background: #000000;
    --foreground: #f5f5f7;
    --muted-foreground: #9c9ca3;
    --primary: #b2efce;
    --primary-foreground: #0f2a1b;
  }
}
body {
  margin: 0;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.5rem;
  text-align: center;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, "Helvetica Neue", sans-serif;
  color: var(--foreground);
  background: var(--background);
}
.ge-title { font-size: 1.125rem; font-weight: 600; margin: 0; }
.ge-body { font-size: 0.875rem; color: var(--muted-foreground); max-width: 24rem; margin: 0; }
.ge-button {
  margin-top: 0.5rem;
  min-height: 2.75rem;
  padding: 0 1.5rem;
  border-radius: 9999px;
  border: none;
  background: var(--primary);
  color: var(--primary-foreground);
  font: inherit;
  font-size: 1.0625rem;
  font-weight: 600;
  cursor: pointer;
}
.ge-button:focus-visible { outline: 3px solid var(--primary); outline-offset: 3px; }
`;

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
      <head>
        <style>{STYLES}</style>
      </head>
      <body>
        <p className="ge-title">Something went wrong.</p>
        <p className="ge-body">
          The error has been reported. Try reloading the page.
        </p>
        <button
          type="button"
          className="ge-button"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
