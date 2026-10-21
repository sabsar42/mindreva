"use client";

import * as React from "react";

const KEY = "mindreva-tz-synced";

/**
 * Tells the server this device's time zone (once per zone per device) so
 * streaks and entry dates follow the user's own midnight, not the server's.
 */
export function TimezoneSync() {
  React.useEffect(() => {
    let tz: string;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz) return;
    try {
      if (localStorage.getItem(KEY) === tz) return;
    } catch {
      /* storage blocked: just sync every time */
    }
    fetch("/api/profile/timezone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    })
      .then((res) => {
        if (!res.ok) return;
        try {
          localStorage.setItem(KEY, tz);
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
  }, []);
  return null;
}
