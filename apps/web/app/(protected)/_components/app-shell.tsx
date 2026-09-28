"use client";

import { usePathname } from "next/navigation";
import { SideNav } from "./side-nav";
import { BottomNav } from "./bottom-nav";

// Flows with their own exit (Cancel/Back/Save). Nav is hidden here because
// leaving /record through it would unmount the recorder and discard the audio.
const FOCUSED_ROUTES = [
  /^\/record(\/|$)/,
  /^\/notes\/new(\/|$)/,
  /^\/entries\/[^/]+\/review(\/|$)/,
  /^\/chat\/[^/]+/,
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const focused = FOCUSED_ROUTES.some((r) => r.test(pathname));

  if (focused) return <>{children}</>;

  return (
    <>
      <SideNav />
      <div className="md:ml-14 lg:ml-56">{children}</div>
      <BottomNav />
    </>
  );
}
