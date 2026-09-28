"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** false during SSR and the hydration render, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
