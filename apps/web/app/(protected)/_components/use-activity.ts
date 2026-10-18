"use client";

import * as React from "react";
import type { HeatmapDay } from "@mindreva/ui";
import type { EntryType } from "@mindreva/database";

interface YearData {
  days: Record<string, HeatmapDay>;
  currentStreak: number;
}

/** The current year as the server saw it, so the first paint is complete. */
export interface InitialActivity extends YearData {
  year: number;
  /** Signed-in user's id; the cache is dropped when it changes. */
  ownerId: string;
}

// Module-level so the cache survives leaving and re-entering Journal within a
// session; keyed by entry type + year. Sign-out is a client-side redirect, not
// a reload, so the owner check keeps one account's data from showing for the
// next account signed in on the same tab.
const yearCache = new Map<string, YearData>();
const inflight = new Map<string, Promise<void>>();
let cacheOwner: string | null = null;

/**
 * Activity per day, across years, for the week strip and the full graph. Years
 * load on demand as the user moves through time (the previous year is fetched
 * once the browser is idle), land in a session cache, and the lookup changes
 * identity whenever new data arrives so consumers repaint.
 */
export function useActivity(
  type: EntryType,
  initial: InitialActivity | null,
  refreshKey: unknown,
) {
  const thisYear = new Date().getFullYear();
  const keyFor = React.useCallback((year: number) => `${type}:${year}`, [type]);

  // The server render is always the freshest copy of its year.
  const seeded = React.useRef(false);
  if (initial && !seeded.current) {
    seeded.current = true;
    if (cacheOwner !== initial.ownerId) {
      yearCache.clear();
      inflight.clear();
      cacheOwner = initial.ownerId;
    }
    yearCache.set(keyFor(initial.year), {
      days: initial.days,
      currentStreak: initial.currentStreak,
    });
  }

  const [version, setVersion] = React.useState(0);
  // The streak always describes today, whichever week is on screen.
  const [streak, setStreak] = React.useState(
    () => yearCache.get(keyFor(thisYear))?.currentStreak ?? 0,
  );

  const load = React.useCallback(
    (year: number, force = false): Promise<void> => {
      const key = keyFor(year);
      if (!force && yearCache.has(key)) return Promise.resolve();
      const pending = inflight.get(key);
      if (pending && !force) return pending;
      const p = fetch(`/api/entries/heatmap?type=${type}&year=${year}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: YearData | null) => {
          if (!data) return;
          yearCache.set(key, {
            days: data.days,
            currentStreak: data.currentStreak,
          });
          if (year === thisYear) setStreak(data.currentStreak);
          setVersion((v) => v + 1);
        })
        .catch(() => {})
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
      return p;
    },
    [type, keyFor, thisYear],
  );

  const ensureYear = React.useCallback(
    (year: number) => {
      // Future years are empty by definition.
      if (year > thisYear) return;
      void load(year);
    },
    [load, thisYear],
  );

  const getDay = React.useMemo(() => {
    void version; // new identity whenever data lands
    return (key: string): HeatmapDay | undefined =>
      yearCache.get(keyFor(+key.slice(0, 4)))?.days[key];
  }, [version, keyFor]);

  // Weeks near January reach into the previous year: have it ready.
  React.useEffect(() => {
    const id = setTimeout(() => ensureYear(thisYear - 1), 600);
    return () => clearTimeout(id);
  }, [ensureYear, thisYear]);

  // A new recording (router.refresh() -> new entries) can change this year's
  // cells; refetch it in place, without anything flashing.
  const firstRefresh = React.useRef(true);
  React.useEffect(() => {
    if (firstRefresh.current) {
      firstRefresh.current = false;
      return;
    }
    void load(thisYear, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  return { getDay, ensureYear, streak };
}
