"use client";

import * as React from "react";
import { Moon } from "lucide-react";
import { IconTile, Switch } from "@mindreva/ui";
import { applyTheme, isDarkNow } from "@/lib/theme";

/**
 * The dark-mode switch. The saved choice (light if none is saved — the app
 * does not follow the OS setting) is applied by a script in <head> before
 * first paint; this just reflects it and changes it.
 */
export function ThemeSwitchRow() {
  // null until mounted: the real theme is only known in the browser (it comes
  // from localStorage / the OS), so SSR renders the switch off and disabled.
  const [dark, setDark] = React.useState<boolean | null>(null);
  React.useEffect(() => setDark(isDarkNow()), []);

  return (
    <div className="flex items-center gap-3 px-1 py-1">
      <IconTile size="sm" tone="neutral">
        <Moon />
      </IconTile>
      <span className="text-foreground flex-1 text-sm font-semibold">
        Dark mode
      </span>
      <Switch
        aria-label="Dark mode"
        checked={dark ?? false}
        disabled={dark === null}
        onCheckedChange={(next) => {
          setDark(next);
          applyTheme(next ? "dark" : "light");
        }}
      />
    </div>
  );
}
