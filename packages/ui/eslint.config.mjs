import baseConfig from "@mindreva/config/eslint/base.mjs";

const eslintConfig = [
  ...baseConfig,
  {
    ignores: ["node_modules/**", "dist/**"],
  },
];

export default eslintConfig;
