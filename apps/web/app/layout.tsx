import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import { Toaster } from "@mindreva/ui/toast";
import { THEME_COLOR, THEME_INIT_SCRIPT } from "@/lib/theme";
import { siteUrl } from "@/lib/brand-mark";
import "./globals.css";

// Sans and mono are the system stacks (San Francisco on Apple devices, see
// tokens.css), so nothing is downloaded for them and text never swaps fonts.
// The serif is the logotype and the past self's voice only. Everything else
// is sans.
const serifLogotype = Fraunces({
  variable: "--font-serif-logotype",
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal"],
  display: "swap",
});

const DESCRIPTION =
  "Voice journaling and notetaking. Tap to record; keep a readable note.";

export const metadata: Metadata = {
  // Absolute URLs for Open Graph images and canonical links.
  metadataBase: siteUrl(),
  title: { default: "Mindreva", template: "%s · Mindreva" },
  description: DESCRIPTION,
  applicationName: "Mindreva",
  // Added to a home screen, it opens full-screen with its own name.
  appleWebApp: { capable: true, title: "Mindreva", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "Mindreva",
    title: "Mindreva",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Mindreva",
    description: DESCRIPTION,
  },
};

// Edge-to-edge (viewport-fit=cover): the app draws behind the notch and home
// indicator and pads for them itself (env(safe-area-*) in tokens.css). Zoom
// stays allowed for accessibility; inputs are 17px, so iOS doesn't zoom on
// focus. theme-color is rendered in <head> below instead of here, because it
// follows the app's own theme switch, not the OS setting.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the init script adds the `dark` class to
    // <html> before React hydrates, which would otherwise be reported as a
    // mismatch. It only affects this one element's attributes.
    // The font variable lives on <html>, not <body>: tokens.css resolves
    // --font-serif at :root, where a body-scoped variable doesn't exist.
    <html lang="en" className={serifLogotype.variable} suppressHydrationWarning>
      <head>
        {/* Before the theme script, which retints it for dark mode. */}
        <meta
          name="theme-color"
          content={THEME_COLOR.light}
          suppressHydrationWarning
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased">
        {/* The whole app is one phone-width column. On a wide screen it sits
            centred on a white canvas with hairline sides, so the web version
            looks and behaves exactly like the phone version. */}
        <div className="app-frame">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
