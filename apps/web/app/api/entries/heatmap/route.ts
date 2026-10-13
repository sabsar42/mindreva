import { NextResponse } from "next/server";
import { getUser } from "@mindreva/auth/server";
import {
  getMyEntriesForDay,
  getMyMonthHeatmap,
  getMyYearHeatmap,
} from "@/lib/services/heatmap.service";
import type { EntryType } from "@mindreva/database";

function parseType(value: string | null): EntryType | undefined {
  return value === "journal" || value === "note" ? value : undefined;
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One route, three shapes, picked by which param is present — the compact
 * monthly grid, the expanded full-year grid, and the inline day-detail
 * panel's entries. Keeping them on one route (rather than three) matches the
 * existing day-thumbnails route's one-concern-one-route style while still
 * letting each view fetch only what it needs.
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = parseType(searchParams.get("type"));
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const date = searchParams.get("date");

  try {
    if (date) {
      if (!DATE_PATTERN.test(date)) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      }
      const entries = await getMyEntriesForDay(date, type);
      return NextResponse.json({ entries });
    }

    if (year) {
      const y = Number(year);
      if (!Number.isInteger(y) || y < 1900 || y > 2100) {
        return NextResponse.json({ error: "Invalid year" }, { status: 400 });
      }
      const data = await getMyYearHeatmap(y, type);
      return NextResponse.json(data);
    }

    if (month) {
      if (!MONTH_PATTERN.test(month)) {
        return NextResponse.json({ error: "Invalid month" }, { status: 400 });
      }
      const days = await getMyMonthHeatmap(month, type);
      return NextResponse.json({ days });
    }

    return NextResponse.json(
      { error: "Pass month, year, or date" },
      { status: 400 },
    );
  } catch (err) {
    console.error("GET /api/entries/heatmap failed:", err);
    return NextResponse.json(
      { error: "Failed to load heatmap data" },
      { status: 500 },
    );
  }
}
