import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import { getMyMindmap } from "@/lib/services/mindmap.service";

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    return NextResponse.json(await getMyMindmap());
  } catch (err) {
    console.error("GET /api/mindmap failed:", err);
    return NextResponse.json(
      { error: "Failed to load mindmap" },
      { status: 500 },
    );
  }
}
