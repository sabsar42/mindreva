import baseConfig from "@mindreva/config/eslint/base.mjs";

const eslintConfig = [
  ...baseConfig,
  {
    ignores: ["node_modules/**"],
  },
];

export default eslintConfig;
