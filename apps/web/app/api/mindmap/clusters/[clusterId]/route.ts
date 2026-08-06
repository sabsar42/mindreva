import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { stripFormatting } from "@mindreva/types";
import { getMyCluster } from "@/lib/services/mindmap.service";

const SNIPPET_LENGTH = 160;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clusterId: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { clusterId } = await params;
  try {
    const cluster = await getMyCluster(clusterId);
    if (!cluster) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      label: cluster.label,
      month: cluster.month,
      entries: cluster.entries.map((e) => ({
        entryId: e.entryId,
        entryDate: e.entryDate,
        title: e.title,
        // Stripped before it reaches a plain-text display — the stored text is
        // the editor's Markdown.
        snippet: e.snippet
          ? stripFormatting(e.snippet).trim().slice(0, SNIPPET_LENGTH)
          : null,
      })),
    });
  } catch (err) {
    console.error("GET /api/mindmap/clusters/[clusterId] failed:", err);
    return NextResponse.json(
      { error: "Failed to load cluster" },
      { status: 500 },
    );
  }
}
