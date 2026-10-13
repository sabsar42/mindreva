import baseConfig from "@mindreva/config/eslint/base.mjs";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * Root-level config so `eslint` run from the repo root (e.g. the pre-commit
 * hook via lint-staged) can find a config file. ESLint's flat config resolves
 * a single config from the CWD for all passed files — it does NOT walk up to
 * each file's own package config — so this is genuinely what lint-staged uses,
 * not just a fallback. It applies the TS recommended + Prettier baseline,
 * Next's recommended rules, and react-hooks (needed so
 * `eslint-disable-next-line react-hooks/*` comments don't hard-fail here with
 * "rule not found"). The Drizzle-import restriction still lives in each
 * package's own eslint.config.mjs and runs via `pnpm lint` (turbo).
 */
const eslintConfig = [
  ...baseConfig,
  {
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
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
