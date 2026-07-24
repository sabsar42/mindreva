import baseConfig from "@mindreva/config/eslint/base.mjs";

/**
 * Root-level config so `eslint` run from the repo root (e.g. the pre-commit
 * hook via lint-staged) can find a config file. This is a fast baseline only
 * (TS recommended + Prettier compat) — framework-specific rules (Next.js,
 * the Drizzle-import restriction) live in each package's own eslint.config.mjs
 * and run via `pnpm lint` (turbo), which is the source of truth for CI.
 */
const eslintConfig = [
  ...baseConfig,
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/dist/**",
      "**/migrations/**",
      "pnpm-lock.yaml",
    ],
  },
];

export default eslintConfig;
