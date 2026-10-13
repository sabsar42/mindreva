"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";

const TAB_ORDER = ["/journal", "/chat", "/integrations"];
const SWIPE_THRESHOLD = 60;
const LOCK_RATIO = 1.5;

// Horizontal gestures that start here belong to the element itself (row
// swipe actions, text selection/caret movement), not to tab switching.
const IGNORE_SELECTOR =
  "[data-swipeable-row], input, textarea, select, [contenteditable='true'], [role='dialog']";

export function SwipeNav({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

  const currentIdx = TAB_ORDER.findIndex((h) => pathname === h);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    const target = e.target as Element | null;
    if (!t || target?.closest(IGNORE_SELECTOR)) {
      touchStartRef.current = null;
      return;
    }
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchStartRef.current || currentIdx === -1) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dy) * LOCK_RATIO > Math.abs(dx)) return;

    const nextIdx = dx < 0 ? currentIdx + 1 : currentIdx - 1;
    const nextHref = TAB_ORDER[nextIdx];
    if (!nextHref) return;
    router.push(nextHref);
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="contents"
    >
      {children}
    </div>
  );
}
