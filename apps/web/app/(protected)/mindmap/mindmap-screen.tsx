"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Network } from "lucide-react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTitle,
  Button,
} from "@mindreva/ui";
import {
  MindmapGraph,
  type MindmapLink,
  type MindmapNode,
} from "./mindmap-graph";

/**
 * Remembers when this user last opened the map, so nodes formed since then can
 * fade in on arrival. Kept in localStorage rather than the database: it's a
 * per-device presentation detail, not user data worth syncing.
 */
const LAST_VIEWED_KEY = "mindreva:mindmap-last-viewed";

interface ClusterEntry {
  entryId: string;
  entryDate: string | null;
  title: string | null;
  snippet: string | null;
}

function formatDate(date: string | null): string {
  if (!date) return "Undated";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function MindmapScreen({
  nodes,
  links,
}: {
  nodes: MindmapNode[];
  links: MindmapLink[];
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [cluster, setCluster] = React.useState<{
    label: string;
    entries: ClusterEntry[];
  } | null>(null);
  const [loadingCluster, setLoadingCluster] = React.useState(false);

  // Read once on mount, before writing the new timestamp — otherwise every
  // node would always look "already seen".
  const [newSince, setNewSince] = React.useState<number | null>(null);
  React.useEffect(() => {
    const previous = window.localStorage.getItem(LAST_VIEWED_KEY);
    setNewSince(previous ? Number(previous) : null);
    window.localStorage.setItem(LAST_VIEWED_KEY, String(Date.now()));
  }, []);

  async function handleSelect(nodeId: string) {
    setSelectedId(nodeId);
    setCluster(null);
    setLoadingCluster(true);
    try {
      const res = await fetch(`/api/mindmap/clusters/${nodeId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as {
        label: string;
        entries: ClusterEntry[];
      };
      setCluster(data);
    } catch {
      setCluster(null);
    } finally {
      setLoadingCluster(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-12 pt-6">
      <header className="flex items-center gap-3">
        <Link
          href="/journal"
          aria-label="Back"
          className="text-foreground hover:bg-warm-100 -ml-2 rounded-full p-2 transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
      </header>

      <h1 className="text-foreground mt-4 font-serif text-3xl font-bold leading-tight tracking-tight">
        Your mindmap
      </h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Themes drawn from what you&apos;ve written, grouped by month. Tap a
        circle to see the entries inside it.
      </p>

      {nodes.length === 0 ? (
        <div className="border-border bg-card mt-8 rounded-lg border p-6 text-center">
          <Network className="text-muted-foreground mx-auto size-6" />
          <p className="text-foreground mt-3 text-sm font-medium">
            Your map is still empty
          </p>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            Themes appear here once you&apos;ve written a few entries and
            they&apos;ve been summarized. Come back after a few more.
          </p>
          <Button asChild variant="secondary" className="mt-4">
            <Link href="/record">Record an entry</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6">
          <MindmapGraph
            nodes={nodes}
            links={links}
            newSince={newSince}
            onSelect={(id) => void handleSelect(id)}
          />
        </div>
      )}

      <BottomSheet
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setCluster(null);
          }
        }}
      >
        <BottomSheetContent>
          <BottomSheetTitle>
            {cluster?.label ?? (loadingCluster ? "Loading…" : "Theme")}
          </BottomSheetTitle>

          {loadingCluster ? (
            <div className="flex justify-center py-8">
              <Loader2 className="text-muted-foreground size-5 animate-spin" />
            </div>
          ) : cluster && cluster.entries.length > 0 ? (
            <div className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto pb-2">
              {cluster.entries.map((entry) => (
                <Link
                  key={entry.entryId}
                  href={`/entries/${entry.entryId}`}
                  className="border-border bg-card hover:bg-warm-50 block rounded-lg border p-3.5 transition-colors"
                >
                  <p className="text-muted-foreground text-xs">
                    {formatDate(entry.entryDate)}
                  </p>
                  <p className="text-foreground mt-0.5 text-sm font-medium">
                    {entry.title ?? "Untitled"}
                  </p>
                  {entry.snippet && (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-relaxed">
                      {entry.snippet}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Couldn&apos;t load the entries for this theme.
            </p>
          )}
        </BottomSheetContent>
      </BottomSheet>
    </main>
  );
}
