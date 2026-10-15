export const THEME_STORAGE_KEY = "mindreva:theme";

export type ThemeChoice = "light" | "dark";

/**
 * Runs in <head> before first paint (see app/layout.tsx), so the page never
 * flashes the wrong theme. Light is the default; dark only applies when the
 * user has explicitly chosen it — the OS setting is deliberately ignored.
 * Kept as a string because it must execute before React hydrates.
 */
export const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")document.documentElement.classList.add("dark");}catch(e){}})();`;

export function isDarkNow(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function applyTheme(choice: ThemeChoice): void {
  document.documentElement.classList.toggle("dark", choice === "dark");
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage blocked: the theme still applies for this visit.
  }
}
