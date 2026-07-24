import baseConfig from "@mindreva/config/eslint/base.mjs";

const eslintConfig = [
  ...baseConfig,
  {
    ignores: ["node_modules/**", "migrations/**", "scripts/**"],
  },
  {
    // Enforce the architectural rule: only repositories may import Drizzle.
    // Everything else in this package (and its consumers) must go through the
    // repository layer.
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "drizzle-orm",
              message:
                "Only files in src/repositories may import Drizzle. Use a repository.",
            },
            {
              name: "postgres",
              message:
                "Only src/client.ts may create the Postgres connection. Use a repository.",
            },
          ],
          patterns: [
            {
              group: ["drizzle-orm/*", "**/client", "**/schema"],
              message:
                "Only files in src/repositories may import Drizzle/client/schema. Use a repository.",
            },
          ],
        },
      ],
    },
  },
  {
    // Repositories and the client/schema themselves are the sanctioned owners.
    files: [
      "src/repositories/**/*.ts",
      "src/client.ts",
      "src/schema.ts",
      "src/index.ts",
      "drizzle.config.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
