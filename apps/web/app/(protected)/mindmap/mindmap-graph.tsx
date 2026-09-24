"use client";

import * as React from "react";
import { cn } from "@mindreva/ui";

export interface MindmapNode {
  id: string;
  label: string;
  month: string;
  entryCount: number;
  colorIndex: number;
  firstSeenAt: string;
}

export interface MindmapLink {
  source: string;
  target: string;
  weight: number;
}

/**
 * Mint-scale tints for the mindmap — alternating dark/light stops so adjacent
 * nodes stay visually distinct while staying on brand.
 */
const MINDMAP_TINTS = [
  { fill: "var(--color-mint-700)", text: "var(--color-mint-50)" },
  { fill: "var(--color-mint-200)", text: "var(--color-mint-900)" },
  { fill: "var(--color-mint-500)", text: "var(--color-mint-50)" },
  { fill: "var(--color-mint-100)", text: "var(--color-mint-800)" },
  { fill: "var(--color-mint-900)", text: "var(--color-mint-100)" },
  { fill: "var(--color-mint-300)", text: "var(--color-mint-900)" },
] as const;

/** Node radius from entry count — area-proportional so a 4x cluster doesn't read as 4x wide. */
function radiusFor(entryCount: number): number {
  return Math.min(38, Math.max(18, 14 + Math.sqrt(entryCount) * 6));
}

function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

interface Positioned extends MindmapNode {
  x: number;
  y: number;
  r: number;
}

/**
 * Deterministic layout: months form columns left-to-right, clusters stack
 * within their month. Precomputed geometry rather than a force simulation —
 * at this app's scale a physics layout would add a dependency and a frame
 * loop to solve a problem we don't have, and a stable position per node also
 * means the map looks the same each time you open it.
 */
function layout(
  nodes: MindmapNode[],
  width: number,
): { positioned: Positioned[]; height: number } {
  const months = [...new Set(nodes.map((n) => n.month))].sort();
  const columnWidth = Math.max(110, width / Math.max(months.length, 1));
  const rowHeight = 104;

  const positioned: Positioned[] = [];
  let maxRows = 0;

  months.forEach((month, colIdx) => {
    const inMonth = nodes
      .filter((n) => n.month === month)
      .sort((a, b) => b.entryCount - a.entryCount);
    maxRows = Math.max(maxRows, inMonth.length);

    inMonth.forEach((node, rowIdx) => {
      positioned.push({
        ...node,
        x: colIdx * columnWidth + columnWidth / 2,
        // Stagger alternate columns so neighbouring nodes don't line up in a
        // rigid grid — it should feel organic, not like a spreadsheet.
        y: 70 + rowIdx * rowHeight + (colIdx % 2 === 0 ? 0 : 26),
        r: radiusFor(node.entryCount),
      });
    });
  });

  return {
    positioned,
    height: 70 + maxRows * rowHeight + 60,
  };
}

export function MindmapGraph({
  nodes,
  links,
  newSince,
  onSelect,
}: {
  nodes: MindmapNode[];
  links: MindmapLink[];
  /** Nodes whose firstSeenAt is after this fade in gently rather than appearing instantly. */
  newSince: number | null;
  onSelect: (nodeId: string) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(360);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const months = React.useMemo(
    () => [...new Set(nodes.map((n) => n.month))].sort(),
    [nodes],
  );

  const { positioned, height } = React.useMemo(() => {
    const monthCount = Math.max(months.length, 1);
    // Let the canvas grow past the viewport and scroll horizontally rather
    // than cramming every month into one screen width.
    const canvasWidth = Math.max(width, monthCount * 130);
    return layout(nodes, canvasWidth);
  }, [nodes, months.length, width]);

  const byId = React.useMemo(
    () => new Map(positioned.map((n) => [n.id, n])),
    [positioned],
  );

  const canvasWidth = Math.max(width, months.length * 130);
  const columnWidth = Math.max(110, canvasWidth / Math.max(months.length, 1));

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <svg
        width={canvasWidth}
        height={height}
        viewBox={`0 0 ${canvasWidth} ${height}`}
        role="group"
        aria-label="Mindmap of your themes over time"
        className="block"
      >
        {/* Month column headers */}
        {months.map((month, i) => (
          <text
            key={month}
            x={i * columnWidth + columnWidth / 2}
            y={26}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px]"
          >
            {monthLabel(month)}
          </text>
        ))}

        {/* Links behind nodes */}
        <g>
          {links.map((link) => {
            const a = byId.get(link.source);
            const b = byId.get(link.target);
            if (!a || !b) return null;
            return (
              <line
                key={`${link.source}-${link.target}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--color-border)"
                strokeWidth={Math.min(3, 1 + link.weight * 0.5)}
                strokeLinecap="round"
                opacity={0.7}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {positioned.map((node) => {
            const tint = MINDMAP_TINTS[node.colorIndex % MINDMAP_TINTS.length]!;
            const isNew =
              newSince !== null &&
              new Date(node.firstSeenAt).getTime() > newSince;

            return (
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`${node.label}, ${node.entryCount} ${node.entryCount === 1 ? "entry" : "entries"}, ${monthLabel(node.month)}`}
                onClick={() => onSelect(node.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(node.id);
                  }
                }}
                className={cn(
                  "focus-visible:outline-none",
                  // New nodes ease in rather than popping — revisiting this map
                  // over months should feel like watching history grow.
                  isNew && "animate-node-emerge",
                )}
                style={{
                  cursor: "pointer",
                  // Without these the scale in node-emerge would originate at
                  // the SVG's top-left corner, so the node would slide in from
                  // off-frame instead of easing up in place.
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
              >
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r}
                  fill={tint.fill}
                  className="transition-[r] duration-200"
                />
                <text
                  x={node.x}
                  y={node.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={tint.text}
                  className="pointer-events-none text-[10px] font-semibold"
                >
                  {node.entryCount}
                </text>
                <text
                  x={node.x}
                  y={node.y + node.r + 14}
                  textAnchor="middle"
                  className="fill-foreground pointer-events-none text-[11px] font-medium"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
