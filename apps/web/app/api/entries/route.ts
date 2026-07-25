import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import {
  createTextEntry,
  listMyEntries,
  searchMyEntries,
} from "@/lib/services/entries.service";
import type { EntryType } from "@mindreva/database";

function parseType(value: string | null): EntryType | undefined {
  return value === "journal" || value === "note" ? value : undefined;
}

/** Used by the list screens' live search box. Plain listing also supported. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = parseType(searchParams.get("type"));
  const q = searchParams.get("q");

  try {
    const entries = q
      ? await searchMyEntries(q, type)
      : await listMyEntries({ type });
    return NextResponse.json({ entries });
  } catch (err) {
    console.error("GET /api/entries failed:", err);
    return NextResponse.json(
      { error: "Failed to list entries" },
      { status: 500 },
    );
  }
}

/** The typed-note compose screen's write path. */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const text = body?.text;
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Invalid text" }, { status: 400 });
  }
  const type = parseType(body?.type) ?? "note";

  try {
    const { entryId } = await createTextEntry({ text, type });
    return NextResponse.json({ entryId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/entries failed:", err);
    return NextResponse.json(
      { error: "Failed to create entry" },
      { status: 500 },
    );
  }
}
