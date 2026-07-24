import baseConfig from "@mindreva/config/eslint/base.mjs";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Root-level config so `eslint` run from the repo root (e.g. the pre-commit
 * hook via lint-staged) can find a config file. ESLint's flat config resolves
 * a single config from the CWD for all passed files — it does NOT walk up to
 * each file's own package config — so this is genuinely what lint-staged uses,
 * not just a fallback. It's a fast baseline (TS recommended + Prettier compat)
 * plus react-hooks (needed so `eslint-disable-next-line react-hooks/*`
 * comments elsewhere in the app don't hard-fail here with "rule not found").
 * The Next.js-specific rules and the Drizzle-import restriction still live in
 * each package's own eslint.config.mjs and run via `pnpm lint` (turbo), which
 * is the source of truth for CI.
 */
const eslintConfig = [
  ...baseConfig,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
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
