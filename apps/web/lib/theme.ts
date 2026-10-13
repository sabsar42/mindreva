export const THEME_STORAGE_KEY = "mindreva:theme";

export type ThemeChoice = "light" | "dark";

/**
 * Runs in <head> before first paint (see app/layout.tsx), so the page never
 * flashes the wrong theme. No saved choice means follow the OS setting.
 * Kept as a string because it must execute before React hydrates.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

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
