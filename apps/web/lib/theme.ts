export const THEME_STORAGE_KEY = "mindreva:theme";

export type ThemeChoice = "light" | "dark";

/**
 * Runs in <head> before first paint (see app/layout.tsx), so the page never
 * flashes the wrong theme. Light is the default; dark only applies when the
 * user has explicitly chosen it — the OS setting is deliberately ignored.
 * Kept as a string because it must execute before React hydrates.
 */
export const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark"){document.documentElement.classList.add("dark");var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#000000");}}catch(e){}})();`;

/** The browser chrome color for each theme (matches --background). */
export const THEME_COLOR: Record<ThemeChoice, string> = {
  light: "#f5f5f7",
  dark: "#000000",
};

export function isDarkNow(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function applyTheme(choice: ThemeChoice): void {
  document.documentElement.classList.toggle("dark", choice === "dark");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[choice]);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage blocked: the theme still applies for this visit.
  }
}
