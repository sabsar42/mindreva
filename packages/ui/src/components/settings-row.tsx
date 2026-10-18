import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

export interface SettingsRowProps extends Omit<
  React.ComponentProps<"div">,
  "title"
> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Trailing control: a Switch, a text button, etc. Wins over `chevron`. */
  trailing?: React.ReactNode;
  /** Show a navigation chevron on the right (when there's no `trailing`). */
  chevron?: boolean;
}

/**
 * Label + description + trailing toggle/chevron. The repeated row on the
 * account screen. Add `onClick` to make it an interactive navigation row.
 */
const SettingsRow = React.forwardRef<HTMLDivElement, SettingsRowProps>(
  (
    {
      className,
      icon,
      title,
      description,
      trailing,
      chevron,
      onClick,
      ...props
    },
    ref,
  ) => {
    const interactive = Boolean(onClick);
    return (
      <div
        ref={ref}
        onClick={onClick}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        className={cn(
          "flex items-center gap-3 px-4 py-3",
          interactive &&
            "hover:bg-secondary focus-visible:ring-ring cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
          className,
        )}
        {...props}
      >
        {icon && (
          <span className="text-muted-foreground flex size-5 shrink-0 items-center justify-center [&_svg]:size-5">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-foreground text-sm font-semibold">{title}</div>
          {description && (
            <div className="text-muted-foreground mt-0.5 text-sm">
              {description}
            </div>
          )}
        </div>
        {trailing ? (
          <div className="shrink-0">{trailing}</div>
        ) : chevron ? (
          <ChevronRight className="text-muted-foreground size-5 shrink-0" />
        ) : null}
      </div>
    );
  },
);
SettingsRow.displayName = "SettingsRow";

export { SettingsRow };
