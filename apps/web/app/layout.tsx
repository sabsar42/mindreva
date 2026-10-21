import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import { Toaster } from "@mindreva/ui/toast";
import { THEME_COLOR, THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Sans and mono are the system stacks (San Francisco on Apple devices, see
// tokens.css), so nothing is downloaded for them and text never swaps fonts.
// Serif logotype only — everything else is sans. See docs/design-reference.
const serifLogotype = Fraunces({
  variable: "--font-serif-logotype",
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mindreva",
  description:
    "Voice journaling and notetaking. Tap to record; keep a readable note.",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Before the theme script, which retints it for dark mode. */}
        <meta
          name="theme-color"
          content={THEME_COLOR.light}
          suppressHydrationWarning
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${serifLogotype.variable} antialiased`}>
        {/* The whole app is one phone-width column. On a wide screen it sits
            centred on a white canvas with hairline sides, so the web version
            looks and behaves exactly like the phone version. */}
        <div className="app-frame">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
