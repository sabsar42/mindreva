"use client";

import * as React from "react";
import { Copy, RefreshCw, RotateCcw } from "lucide-react";
import { cn, toast } from "@mindreva/ui";

export type BubbleStatus = "sent" | "sending" | "failed" | "stopped";

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 8;

/**
 * One chat bubble. The user's are tinted and right-aligned; the past self's
 * sit on a neutral surface on the left, in the serif voice the feature has
 * always used. Consecutive messages from the same side are grouped: only the
 * last one of a run gets the "tail" corner.
 *
 * Long-press (touch) or right-click opens a small menu: Copy, plus
 * Regenerate on the last reply. A failed question shows an inline Retry that
 * resends the same text.
 */
export function MessageBubble({
  role,
  content,
  status = "sent",
  noRecord = false,
  lastInGroup = true,
  canRegenerate = false,
  onRegenerate,
  onRetry,
  children,
}: {
  role: "user" | "assistant";
  content: string;
  status?: BubbleStatus;
  noRecord?: boolean;
  lastInGroup?: boolean;
  canRegenerate?: boolean;
  onRegenerate?: () => void;
  onRetry?: () => void;
  /** Rendered under the bubble (citation chips). */
  children?: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const press = React.useRef<{ x: number; y: number; timer: number } | null>(
    null,
  );
  const isUser = role === "user";

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  React.useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (
        e instanceof PointerEvent &&
        menuRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setMenuOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    window.addEventListener("scroll", close, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("scroll", close);
    };
  }, [menuOpen]);

  async function copy() {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(content);
      toast("Copied");
    } catch {
      // Some browsers refuse the Clipboard API (older iOS, non-https, or a
      // missing permission); the select-and-copy fallback still works there.
      if (copyWithSelection(content)) toast("Copied");
      else toast.error("Couldn't copy that.");
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col",
        isUser ? "items-end" : "items-start",
        lastInGroup ? "mb-3" : "mb-0.5",
      )}
    >
      <div className="relative max-w-[80%]">
        <div
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuOpen(true);
          }}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse") return;
            press.current = {
              x: e.clientX,
              y: e.clientY,
              timer: window.setTimeout(() => {
                setMenuOpen(true);
                navigator.vibrate?.(10);
              }, LONG_PRESS_MS),
            };
          }}
          onPointerMove={(e) => {
            const p = press.current;
            if (
              p &&
              Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOLERANCE_PX
            ) {
              cancelPress();
            }
          }}
          onPointerUp={cancelPress}
          onPointerCancel={cancelPress}
          className={cn(
            "wrap-break-word whitespace-pre-wrap px-4 py-2.5 [-webkit-touch-callout:none]",
            "rounded-xl transition-opacity duration-150",
            isUser
              ? cn(
                  "bg-primary text-primary-foreground text-body",
                  lastInGroup && "rounded-br-md",
                )
              : noRecord
                ? cn(
                    "border-border text-muted-foreground border border-dashed font-serif text-[1.0625rem] italic leading-relaxed",
                    lastInGroup && "rounded-bl-md",
                  )
                : cn(
                    "bg-card text-foreground border-separator border-[0.5px] font-serif text-[1.0625rem] leading-relaxed",
                    lastInGroup && "rounded-bl-md",
                  ),
            status === "sending" && "opacity-70",
            status === "failed" && "opacity-60",
          )}
        >
          {content}
        </div>

        {menuOpen && (
          <div
            ref={menuRef}
            role="menu"
            aria-label="Message actions"
            className={cn(
              // Solid, not translucent: a menu over text must stay readable.
              "bg-popover text-popover-foreground shadow-elevated border-separator motion-safe:animate-scale-in absolute top-full z-20 mt-1.5 min-w-44 overflow-hidden rounded-xl border-[0.5px] py-1",
              isUser ? "right-0 origin-top-right" : "left-0 origin-top-left",
            )}
          >
            <MenuItem icon={<Copy />} label="Copy" onSelect={copy} />
            {canRegenerate && onRegenerate && (
              <MenuItem
                icon={<RefreshCw />}
                label="Regenerate"
                onSelect={() => {
                  setMenuOpen(false);
                  onRegenerate();
                }}
              />
            )}
          </div>
        )}
      </div>

      {status === "failed" && onRetry && (
        <p className="text-destructive text-footnote mt-1 flex items-center gap-1.5 px-1">
          Not sent.
          <button
            type="button"
            onClick={onRetry}
            className="hit-44 text-primary inline-flex items-center gap-1 font-semibold"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Retry
          </button>
        </p>
      )}
      {status === "stopped" && (
        <p className="text-muted-foreground text-caption mt-1 px-1">Stopped</p>
      )}
      {children}
    </div>
  );
}

function copyWithSelection(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

function MenuItem({
  icon,
  label,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="text-foreground text-body hover:bg-secondary focus-visible:bg-secondary flex min-h-11 w-full items-center justify-between gap-6 px-4 text-left focus-visible:outline-none [&_svg]:size-4"
    >
      {label}
      {icon}
    </button>
  );
}
