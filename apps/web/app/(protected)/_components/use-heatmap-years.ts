"use client";

import * as React from "react";
import type { HeatmapDay } from "@mindreva/ui";
import type { EntryType } from "@mindreva/database";

export interface HeatmapYearData {
  days: Record<string, HeatmapDay>;
  currentStreak: number;
}

export interface InitialHeatmap extends HeatmapYearData {
  year: number;
  /** Signed-in user's id; the cache is dropped when it changes. */
  ownerId: string;
}

// Module-level so the cache survives leaving and re-entering Journal within
// a session; keyed by entry type + year. Sign-out is a client-side redirect,
// not a reload, so the owner check keeps one account's data from showing
// for the next account signed in on the same tab.
const yearCache = new Map<string, HeatmapYearData>();
const yearInflight = new Map<string, Promise<HeatmapYearData | null>>();
let cacheOwner: string | null = null;
const EMPTY_YEAR: HeatmapYearData = { days: {}, currentStreak: 0 };

/**
 * Year-by-year activity data with a session cache. The server provides the
 * current year, neighbouring years are prefetched once the browser is idle,
 * and a year change swaps synchronously when the year is already cached — so
 * stepping between years never flashes a skeleton. An uncached year keeps the
 * previous grid on screen (marked pending) until its data lands.
 */
export function useHeatmapYears(
  type: EntryType,
  initial: InitialHeatmap | null,
  refreshKey: unknown,
) {
  const thisYear = new Date().getFullYear();
  const maxYear = thisYear + 1;
  // The server render is always the freshest copy of its year.
  const seeded = React.useRef(false);
  if (initial && !seeded.current) {
    seeded.current = true;
    if (cacheOwner !== initial.ownerId) {
      yearCache.clear();
      yearInflight.clear();
      cacheOwner = initial.ownerId;
    }
    yearCache.set(`${type}:${initial.year}`, {
      days: initial.days,
      currentStreak: initial.currentStreak,
    });
  }
  const cache = React.useMemo(
    () => ({
      get: (y: number) =>
        y > thisYear ? EMPTY_YEAR : yearCache.get(`${type}:${y}`),
      has: (y: number) => y > thisYear || yearCache.has(`${type}:${y}`),
      set: (y: number, v: HeatmapYearData) => yearCache.set(`${type}:${y}`, v),
    }),
    [type, thisYear],
  );

  const [year, setYear] = React.useState(initial?.year ?? thisYear);
  const [view, setView] = React.useState<{
    year: number;
    data: HeatmapYearData;
  } | null>(() =>
    initial
      ? {
          year: initial.year,
          data: { days: initial.days, currentStreak: initial.currentStreak },
        }
      : null,
  );

  const load = React.useCallback(
    (y: number, force = false): Promise<HeatmapYearData | null> => {
      const hit = cache.get(y);
      if (hit && (!force || y > thisYear)) return Promise.resolve(hit);
      const key = `${type}:${y}`;
      const pending = yearInflight.get(key);
      if (pending && !force) return pending;
      const p = fetch(`/api/entries/heatmap?type=${type}&year=${y}`)
        .then((res) => (res.ok ? res.json() : null))
        .then(
          (
            d: {
              days: Record<string, HeatmapDay>;
              currentStreak: number;
            } | null,
          ) => {
            if (!d) return null;
            const value = { days: d.days, currentStreak: d.currentStreak };
            cache.set(y, value);
            return value;
          },
        )
        .catch(() => null)
        .finally(() => yearInflight.delete(key));
      yearInflight.set(key, p);
      return p;
    },
    [type, cache, thisYear],
  );

  const changeYear = React.useCallback(
    (y: number) => {
      if (y > maxYear) return;
      setYear(y);
      const hit = cache.get(y);
      // Same event batch as setYear: the label and grid swap in one frame.
      if (hit) setView({ year: y, data: hit });
    },
    [maxYear, cache],
  );

  React.useEffect(() => {
    let alive = true;
    if (!cache.has(year)) {
      void load(year).then((d) => {
        if (alive && d) setView({ year, data: d });
      });
    }
    const idle = setTimeout(() => {
      for (const y of [year - 1, year + 1]) if (!cache.has(y)) void load(y);
    }, 400);
    return () => {
      alive = false;
      clearTimeout(idle);
    };
  }, [year, load, cache]);

  // A new recording (router.refresh() → new entries) can change this year's
  // cells; refetch it in place, without a skeleton.
  const firstRefresh = React.useRef(true);
  React.useEffect(() => {
    if (firstRefresh.current) {
      firstRefresh.current = false;
      return;
    }
    void load(thisYear, true).then((d) => {
      if (d)
        setView((v) =>
          v && v.year === thisYear ? { year: thisYear, data: d } : v,
        );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  return {
    year,
    maxYear,
    changeYear,
    days: view?.data.days ?? null,
    currentStreak: view && view.year === year ? view.data.currentStreak : 0,
    pending: !view || view.year !== year,
  };
}
