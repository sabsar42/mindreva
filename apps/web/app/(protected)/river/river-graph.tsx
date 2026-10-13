"use client";

import * as React from "react";
import type {
  RiverData,
  RiverIntersection,
  RiverTheme,
} from "@/lib/services/mindmap.service";

/** Distinct muted shades drawn from the app's own mint scale, one per theme (by hashed label), matching the old bubble map's tint strategy. */
const RIVER_TINTS = [
  "var(--color-mint-700)",
  "var(--color-mint-500)",
  "var(--color-mint-400)",
  "var(--color-mint-600)",
  "var(--color-mint-800)",
  "var(--color-mint-300)",
];

const MONTH_WIDTH_COMPACT = 40;
const MONTH_WIDTH_FULL = 68;
const LANE_HEIGHT_COMPACT = 34;
const LANE_HEIGHT_FULL = 48;
/** Rough px-per-character for the inline theme labels, so the label gutter can be sized to fit the longest one without guessing per-render. */
const LABEL_CHAR_WIDTH_COMPACT = 5.2;
const LABEL_CHAR_WIDTH_FULL = 6.6;

function monthLabel(month: string, withYear: boolean): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y!, (m ?? 1) - 1, 1);
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: withYear ? "numeric" : undefined,
  });
}

/** Line thickness for a month point: gentle, area-like scaling so a theme with 4x the entries doesn't read as 4x as tall. */
function thicknessFor(
  entryCount: number,
  maxCount: number,
  compact: boolean,
): number {
  const base = compact ? 4 : 5;
  const span = compact ? 8 : 16;
  const ratio = maxCount <= 1 ? 1 : entryCount / maxCount;
  return base + Math.sqrt(ratio) * span;
}

interface LaidOutPoint {
  month: string;
  x: number;
  y: number;
  thickness: number;
  entryCount: number;
}

interface LaidOutTheme extends RiverTheme {
  lane: number;
  tint: string;
  points: LaidOutPoint[];
  /** Contiguous runs of points, split at a calendar gap, so the path never draws a straight line across a silent stretch. */
  segments: LaidOutPoint[][];
}

/**
 * Builds a smooth path through a theme's monthly points using Catmull-Rom ->
 * cubic Bezier conversion, so the river reads as organic flowing curves
 * rather than straight connected segments.
 */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function tintFor(colorIndex: number): string {
  return RIVER_TINTS[colorIndex % RIVER_TINTS.length]!;
}

function layout(
  data: RiverData,
  months: string[],
  compact: boolean,
  minWidth: number,
): {
  themes: LaidOutTheme[];
  width: number;
  height: number;
  monthX: Map<string, number>;
  labelGutter: number;
} {
  const monthWidth = compact ? MONTH_WIDTH_COMPACT : MONTH_WIDTH_FULL;
  const laneHeight = compact ? LANE_HEIGHT_COMPACT : LANE_HEIGHT_FULL;
  const rightPad = compact ? 16 : 28;
  const topPad = compact ? 18 : 32;
  const charWidth = compact ? LABEL_CHAR_WIDTH_COMPACT : LABEL_CHAR_WIDTH_FULL;

  // Reserve real space for each theme's inline label before the time axis
  // starts, sized to the longest label actually present — otherwise a label
  // drawn to the left of month 1 has nowhere to go but off the canvas.
  const longestLabel = Math.max(0, ...data.themes.map((t) => t.label.length));
  const labelGutter =
    longestLabel === 0
      ? 0
      : Math.ceil(longestLabel * charWidth) + (compact ? 10 : 16);

  const timelineWidth = Math.max(0, months.length - 1) * monthWidth;
  const contentWidth = labelGutter + timelineWidth + rightPad;
  const width = Math.max(minWidth, contentWidth);
  // Months are laid out right-aligned within the available width, so a
  // short history (few months) still reaches the right edge rather than
  // leaving a dead gap — the river always "arrives" at the present.
  const monthsStartX =
    width - rightPad - timelineWidth < labelGutter
      ? labelGutter
      : width - rightPad - timelineWidth;

  const monthX = new Map(
    months.map((m, i) => [m, monthsStartX + i * monthWidth]),
  );
  const maxCount = Math.max(
    1,
    ...data.themes.flatMap((t) => t.months.map((m) => m.entryCount)),
  );

  const themes: LaidOutTheme[] = data.themes.map((theme, laneIndex) => {
    const y = topPad + laneIndex * laneHeight;
    const points: LaidOutPoint[] = theme.months
      .filter((m) => monthX.has(m.month))
      .map((m) => ({
        month: m.month,
        x: monthX.get(m.month)!,
        y,
        thickness: thicknessFor(m.entryCount, maxCount, compact),
        entryCount: m.entryCount,
      }));

    // Split into contiguous segments: a theme's line only connects months
    // with no calendar gap between them, so a quiet stretch reads as the path
    // actually vanishing rather than a straight line glossing over silence.
    const segments: LaidOutPoint[][] = [];
    let current: LaidOutPoint[] = [];
    for (const p of points) {
      if (current.length > 0) {
        const prevMonth = current[current.length - 1]!.month;
        const [py, pm] = prevMonth.split("-").map(Number);
        const [cy, cm] = p.month.split("-").map(Number);
        const contiguous = py! * 12 + pm! + 1 === cy! * 12 + cm!;
        if (!contiguous) {
          segments.push(current);
          current = [];
        }
      }
      current.push(p);
    }
    if (current.length > 0) segments.push(current);

    return {
      ...theme,
      lane: laneIndex,
      tint: tintFor(theme.colorIndex),
      points,
      segments,
    };
  });

  const height =
    topPad + Math.max(1, themes.length) * laneHeight + (compact ? 10 : 22);

  return { themes, width, height, monthX, labelGutter };
}

export interface RiverSelection {
  kind: "theme" | "milestone" | "intersection";
  themeId?: string;
  entryId?: string;
  intersection?: RiverIntersection;
}

export function RiverGraph({
  data,
  months,
  compact = false,
  onSelect,
}: {
  data: RiverData;
  /** Months to actually render, already filtered to the active time range. */
  months: string[];
  compact?: boolean;
  onSelect: (selection: RiverSelection) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(320);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { themes, width, height, monthX, labelGutter } = React.useMemo(
    () => layout(data, months, compact, containerWidth),
    [data, months, compact, containerWidth],
  );

  // Scroll to the most recent months, not the earliest — the latest writing
  // is what someone most likely wants to see first. Only relevant when the
  // content is actually wider than the container (a long "All time" history).
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [width]);

  const visibleIntersections = React.useMemo(
    () => data.intersections.filter((x) => monthX.has(x.month)),
    [data.intersections, monthX],
  );

  const laneByLabel = new Map(themes.map((t) => [t.label, t]));

  return (
    <div ref={containerRef} className="w-full">
      <div ref={scrollRef} className="w-full overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-label="River of memories: your recurring themes over time"
          className="block"
        >
          {/* Month gridlines + labels along the bottom, standing in for a legend — themes are labeled on their own paths instead. */}
          <g aria-hidden>
            {months.map((m, i) => {
              const x = monthX.get(m)!;
              const showYear = i === 0 || m.endsWith("-01");
              return (
                <g key={m}>
                  <line
                    x1={x}
                    y1={compact ? 4 : 10}
                    x2={x}
                    y2={height - (compact ? 10 : 18)}
                    stroke="var(--color-border)"
                    strokeWidth={1}
                    opacity={0.4}
                  />
                  {!compact && (
                    <text
                      x={x}
                      y={height - 4}
                      textAnchor="middle"
                      fontSize={10}
                      fill="var(--color-muted-foreground)"
                    >
                      {monthLabel(m, showYear)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Theme paths */}
          {themes.map((theme) => (
            <g key={theme.id}>
              {theme.segments.map((segment, si) => {
                const avgThickness =
                  segment.reduce((n, p) => n + p.thickness, 0) / segment.length;
                // A theme active in only one month of the visible range still
                // needs to read as present, not invisible — draw it as a
                // short stub rather than a zero-length line.
                if (segment.length === 1) {
                  const p = segment[0]!;
                  return (
                    <line
                      key={si}
                      x1={p.x - 6}
                      y1={p.y}
                      x2={p.x + 6}
                      y2={p.y}
                      stroke={theme.tint}
                      strokeWidth={avgThickness}
                      strokeLinecap="round"
                      opacity={0.82}
                      className="cursor-pointer transition-opacity duration-200 hover:opacity-100"
                      onClick={() =>
                        onSelect({ kind: "theme", themeId: theme.id })
                      }
                    />
                  );
                }
                return (
                  <path
                    key={si}
                    d={smoothPath(segment)}
                    fill="none"
                    stroke={theme.tint}
                    strokeWidth={avgThickness}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.82}
                    className="cursor-pointer transition-opacity duration-200 hover:opacity-100"
                    onClick={() =>
                      onSelect({ kind: "theme", themeId: theme.id })
                    }
                  />
                );
              })}

              {/* Inline label in the reserved gutter, left of the timeline — never off-canvas, since the gutter is sized to fit it. */}
              {theme.points[0] && labelGutter > 0 && (
                <text
                  x={labelGutter - (compact ? 8 : 12)}
                  y={theme.points[0].y + (compact ? 3 : 4)}
                  textAnchor="end"
                  fontSize={compact ? 10 : 12}
                  fontWeight={600}
                  fill="var(--color-foreground)"
                  className="pointer-events-none select-none"
                >
                  {theme.label}
                </text>
              )}

              {/* Milestones: one dot per real journal entry, with a background-colored halo so they read clearly on top of a thick line. */}
              {!compact &&
                theme.milestones
                  .filter((m) => monthX.has(m.month))
                  .map((m) => {
                    const point = theme.points.find((p) => p.month === m.month);
                    if (!point) return null;
                    const isNotable = m.isFirstAppearance || m.isReturnAfterGap;
                    const r = isNotable ? 6 : 3.5;
                    return (
                      <g key={m.entryId}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={r + 2}
                          fill="var(--color-card)"
                        />
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={r}
                          fill={isNotable ? "var(--color-card)" : theme.tint}
                          stroke={theme.tint}
                          strokeWidth={isNotable ? 2.5 : 0}
                          className="cursor-pointer transition-transform duration-150 hover:scale-125"
                          style={{
                            transformBox: "fill-box",
                            transformOrigin: "center",
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={
                            m.isFirstAppearance
                              ? `${theme.label}: first appearance, ${monthLabel(m.month, true)}`
                              : m.isReturnAfterGap
                                ? `${theme.label}: returned in ${monthLabel(m.month, true)} after a gap`
                                : `${theme.label} entry, ${monthLabel(m.month, true)}`
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect({
                              kind: "milestone",
                              themeId: theme.id,
                              entryId: m.entryId,
                            });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onSelect({
                                kind: "milestone",
                                themeId: theme.id,
                                entryId: m.entryId,
                              });
                            }
                          }}
                        />
                      </g>
                    );
                  })}
            </g>
          ))}

          {/* Intersections: a small marker where two themes' paths share entries in the same month. */}
          {!compact &&
            visibleIntersections.map((x, i) => {
              const a = laneByLabel.get(x.themeA);
              const b = laneByLabel.get(x.themeB);
              const ay = a?.points.find((p) => p.month === x.month)?.y;
              const by = b?.points.find((p) => p.month === x.month)?.y;
              if (ay === undefined || by === undefined) return null;
              const ax = monthX.get(x.month)!;
              const my = (ay + by) / 2;
              return (
                <g key={`${x.month}-${x.themeA}-${x.themeB}-${i}`}>
                  <line
                    x1={ax}
                    y1={ay}
                    x2={ax}
                    y2={by}
                    stroke="var(--color-mint-400)"
                    strokeWidth={1.5}
                    strokeDasharray="2 3"
                    opacity={0.7}
                  />
                  <circle
                    cx={ax}
                    cy={my}
                    r={6}
                    fill="var(--color-card)"
                    stroke="var(--color-mint-500)"
                    strokeWidth={2}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={`${x.themeA} and ${x.themeB} connect in ${monthLabel(x.month, true)}`}
                    onClick={() =>
                      onSelect({ kind: "intersection", intersection: x })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect({ kind: "intersection", intersection: x });
                      }
                    }}
                  />
                </g>
              );
            })}
        </svg>
      </div>
    </div>
  );
}
