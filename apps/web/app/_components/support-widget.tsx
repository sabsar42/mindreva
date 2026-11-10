"use client";

import * as React from "react";
import { SUPPORT_WIDGET_SCRIPT, type SupportWidgetConfig } from "@/lib/support";

/** Everything the third-party script adds to the page, so it can be undone. */
function removeWidgetElements() {
  document
    .querySelectorAll(".sk-widget-btn, .sk-widget-iframe-container")
    .forEach((el) => el.remove());
  document.head.querySelectorAll("style").forEach((el) => {
    if (el.textContent?.includes(".sk-widget-btn")) el.remove();
  });
}

/**
 * The voluntary "Support Mindreva" tip widget (SupportKori): a floating button
 * that opens a payment panel. It is only mounted on the Account screen. The
 * script appends its button and panel to <body> and never removes them, so
 * this loads it on mount and takes everything back out on unmount; otherwise
 * the button would follow the user to every screen after a visit here.
 * Renders nothing itself.
 */
export function SupportWidget({ id, message, color }: SupportWidgetConfig) {
  React.useEffect(() => {
    let cancelled = false;
    const script = document.createElement("script");
    script.src = SUPPORT_WIDGET_SCRIPT;
    // Dynamic scripts run in insertion order when not async, so a stale one
    // from a quick unmount/remount can't run after the new one.
    script.async = false;
    script.dataset.id = id;
    script.dataset.message = message;
    script.dataset.color = color;
    script.dataset.position = "right";
    // If we were unmounted before it finished loading, undo what it just did.
    script.onload = () => {
      if (cancelled) removeWidgetElements();
    };
    document.body.appendChild(script);
    return () => {
      cancelled = true;
      script.remove();
      removeWidgetElements();
    };
  }, [id, message, color]);
  return null;
}
