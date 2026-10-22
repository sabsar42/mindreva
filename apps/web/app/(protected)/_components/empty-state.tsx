import * as React from "react";
import { IconTile, cn } from "@mindreva/ui";

interface EmptyStateProps {
  message: string;
  /** Optional bold line above the message. */
  title?: string;
  /** Optional icon; shown in a soft mint tile above the text. */
  icon?: React.ReactNode;
  /** Optional call to action rendered below the message. */
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  message,
  title,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border bg-card shadow-subtle flex flex-col items-center rounded-2xl border px-6 py-10 text-center",
        className,
      )}
    >
      {icon && <IconTile size="lg">{icon}</IconTile>}
      {title && (
        <p
          className={cn(
            "text-foreground text-base font-semibold",
            icon && "mt-4",
          )}
        >
          {title}
        </p>
      )}
      <p
        className={cn(
          "text-muted-foreground max-w-xs text-sm leading-relaxed",
          (icon || title) && "mt-1.5",
        )}
      >
        {message}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
