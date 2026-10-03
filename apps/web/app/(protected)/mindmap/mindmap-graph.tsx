"use client";

import * as React from "react";
import { cn } from "@mindreva/ui";

export interface MindmapNode {
  id: string;
  label: string;
  entryCount: number;
  firstSeenAt: string;
}

export interface MindmapLink {
  source: string;
  target: string;
  weight: number;
}

/** Radius scales with entry count — bigger clusters are visibly larger. */
function radiusFor(entryCount: number): number {
  return Math.min(66, Math.max(34, 22 + Math.sqrt(entryCount) * 18));
}

/** Darker fill for clusters with more entries, lighter for fewer. */
function tintForCount(
  entryCount: number,
  maxCount: number,
): { fill: string; text: string } {
  const ratio = maxCount <= 1 ? 1 : entryCount / maxCount;
  if (ratio >= 0.75)
    return { fill: "var(--color-mint-700)", text: "var(--color-mint-50)" };
  if (ratio >= 0.4)
    return { fill: "var(--color-mint-500)", text: "var(--color-mint-50)" };
  if (ratio >= 0.2)
    return { fill: "var(--color-mint-300)", text: "var(--color-mint-900)" };
  return { fill: "var(--color-mint-100)", text: "var(--color-mint-800)" };
}

/** Split label into at most 2 lines so it fits inside the circle. */
function wrapLabel(label: string): string[] {
  const words = label.split(" ");
  if (words.length === 1) return [label];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

interface Positioned extends MindmapNode {
  x: number;
  y: number;
  r: number;
}

/**
 * Golden-angle spiral layout with a repulsion pass to eliminate overlaps.
 * Largest nodes sit nearer the centre; smaller ones spiral outward.
 * Fully deterministic — no random numbers — so the map looks the same every visit.
 */
function layout(
  nodes: MindmapNode[],
  width: number,
): { positioned: Positioned[]; height: number } {
  const n = nodes.length;
  if (n === 0) return { positioned: [], height: 320 };

  const cx = width / 2;
  // Start with a generous canvas so repulsion has room to work
  const initHeight = Math.max(460, width * 1.1);
  const cy = initHeight * 0.47;
  const maxSpread = Math.min(cx - 80, cy - 80) * 0.75;

  const sorted = [...nodes].sort((a, b) => b.entryCount - a.entryCount);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  const positioned: Positioned[] = sorted.map((node, i) => {
    const r = radiusFor(node.entryCount);
    const t = n <= 1 ? 0 : i / (n - 1);
    const dist = i === 0 ? 0 : maxSpread * (0.35 + 0.65 * t);
    const angle = i * goldenAngle - Math.PI / 2;
    return {
      ...node,
      x: cx + dist * Math.cos(angle),
      y: cy + dist * Math.sin(angle),
      r,
    };
  });

  // Repulsion — push overlapping circles apart until none touch.
  // 40 iterations is enough for up to ~20 nodes at this density.
  const GAP = 12;
  for (let iter = 0; iter < 40; iter++) {
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const a = positioned[i]!;
        const b = positioned[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const minD = a.r + b.r + GAP;
        if (d < minD) {
          const push = (minD - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }

  // Clamp horizontally so no circle bleeds off the edge
  for (const node of positioned) {
    node.x = Math.max(node.r + 8, Math.min(width - node.r - 8, node.x));
    node.y = Math.max(node.r + 8, node.y);
  }

  // Height fits all nodes with a bottom margin
  const maxY = Math.max(...positioned.map((p) => p.y + p.r));
  const height = maxY + 24;

  return { positioned, height };
}

export function MindmapGraph({
  nodes,
  links,
  newSince,
  onSelect,
}: {
  nodes: MindmapNode[];
  links: MindmapLink[];
  /** Nodes first seen after this timestamp fade in gently. */
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

  const { positioned, height } = React.useMemo(
    () => layout(nodes, width),
    [nodes, width],
  );

  const byId = React.useMemo(
    () => new Map(positioned.map((n) => [n.id, n])),
    [positioned],
  );

  const maxCount = React.useMemo(
    () => Math.max(1, ...nodes.map((n) => n.entryCount)),
    [nodes],
  );

  // Proximity links: connect each node to its 2 nearest neighbours so the
  // graph always shows a web even when no clusters share entries. Data-driven
  // links (shared entries) get a slightly heavier stroke to show semantic ties.
  const proximityLinks = React.useMemo(() => {
    const seen = new Set<string>();
    const result: { source: string; target: string; semantic: boolean }[] = [];

    const semanticKeys = new Set(
      links.map((l) => [l.source, l.target].sort().join("::")),
    );

    for (const a of positioned) {
      const nearest = [...positioned]
        .filter((b) => b.id !== a.id)
        .sort(
          (b, c) =>
            Math.hypot(b.x - a.x, b.y - a.y) - Math.hypot(c.x - a.x, c.y - a.y),
        )
        .slice(0, 2);

      for (const b of nearest) {
        const key = [a.id, b.id].sort().join("::");
        if (!seen.has(key)) {
          seen.add(key);
          result.push({
            source: a.id,
            target: b.id,
            semantic: semanticKeys.has(key),
          });
        }
      }
    }
    return result;
  }, [positioned, links]);

  return (
    <div ref={containerRef} className="w-full">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="Mindmap of your themes"
        className="block"
      >
        {/* Links — behind nodes */}
        <g>
          {proximityLinks.map((link) => {
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
                stroke="var(--color-mint-300)"
                strokeWidth={link.semantic ? 2 : 1.5}
                strokeLinecap="round"
                opacity={0.65}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {positioned.map((node) => {
            const tint = tintForCount(node.entryCount, maxCount);
            const isNew =
              newSince !== null &&
              new Date(node.firstSeenAt).getTime() > newSince;
            const lines = wrapLabel(node.label);
            const fontSize =
              node.label.length > 11 ? 10 : node.label.length > 7 ? 11 : 12;
            const lineH = fontSize + 3;
            // Centre the block of lines vertically inside the circle
            const blockTop = node.y - ((lines.length - 1) * lineH) / 2;

            return (
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`${node.label}, ${node.entryCount} ${node.entryCount === 1 ? "entry" : "entries"}`}
                onClick={() => onSelect(node.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(node.id);
                  }
                }}
                className={cn(
                  "focus-visible:outline-none",
                  isNew && "animate-node-emerge",
                )}
                style={{
                  cursor: "pointer",
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
              >
                <circle cx={node.x} cy={node.y} r={node.r} fill={tint.fill} />
                {lines.map((line, li) => (
                  <text
                    key={li}
                    x={node.x}
                    y={blockTop + li * lineH}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={tint.text}
                    fontSize={fontSize}
                    fontWeight="600"
                    className="pointer-events-none select-none"
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
