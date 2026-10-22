"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@mindreva/ui";
import { requestOk, restoreRemoved } from "@/lib/optimistic";

/**
 * Remove-from-this-list mutations (archive, unarchive, trash, restore) that
 * feel instant: the row leaves the list on tap, the request runs behind it,
 * and if it fails the row slides back into its old place with a clear
 * message. On success the server list is refreshed so other screens agree.
 */
export function useOptimisticRemove<T extends { id: string }>(
  items: T[],
  setItems: React.Dispatch<React.SetStateAction<T[]>>,
) {
  const router = useRouter();
  // The latest list, read at call time (not the render the handler closed
  // over), so two quick swipes each restore against the right snapshot.
  const latest = React.useRef(items);
  latest.current = items;

  return React.useCallback(
    async (
      id: string,
      request: { url: string; method: "POST" | "DELETE" },
      copy: { done: string; failed: string },
    ) => {
      const snapshot = latest.current;
      setItems((prev) => prev.filter((e) => e.id !== id));
      const ok = await requestOk(request.url, { method: request.method });
      if (!ok) {
        setItems((prev) => restoreRemoved(snapshot, prev, id));
        toast.error(copy.failed);
        return;
      }
      toast.success(copy.done);
      router.refresh();
    },
    [router, setItems],
  );
}
