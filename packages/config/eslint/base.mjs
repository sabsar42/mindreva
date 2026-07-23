import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

/**
 * Base flat ESLint config shared by every app and package in the monorepo.
 * Framework-specific rules (e.g. next/core-web-vitals) are added by the
 * consumer on top of this.
 */
const baseConfig = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default baseConfig;
