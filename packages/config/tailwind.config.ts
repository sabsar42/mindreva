import type { Config } from "tailwindcss";

/**
 * Base Tailwind config shared across the monorepo. Tailwind v4 is CSS-first
 * (theme lives in packages/ui/src/styles/tokens.css from Phase 2 onward via
 * `@theme`), so this file only holds the handful of settings that still need
 * a JS/TS config: content globs and plugin registration. Consumers extend
 * this rather than redefining it.
 */
const baseConfig: Partial<Config> = {
  content: [],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default baseConfig;
