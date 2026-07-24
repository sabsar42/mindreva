import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { Toaster } from "@mindreva/ui/toast";
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${serifLogotype.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
