import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { Toaster } from "@mindreva/ui/toast";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Serif logotype only — everything else is sans. See docs/design-reference.
const serifLogotype = Fraunces({
  variable: "--font-serif-logotype",
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal"],
});

export const metadata: Metadata = {
  title: "Mindreva",
  description:
    "Voice journaling and notetaking. Tap to record; keep a readable note.",
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
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${serifLogotype.variable} antialiased`}
      >
        {/* The whole app is one phone-width column. On a wide screen it sits
            centred on a white canvas with hairline sides, so the web version
            looks and behaves exactly like the phone version. */}
        <div className="app-frame">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
