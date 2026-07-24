import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

// Read the single env file the Next app uses, so migrations and the app share
// one source of secrets (apps/web/.env.local).
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../apps/web/.env.local") });

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // We hand-author RLS policies, the pgvector extension, the profile trigger,
  // and the HNSW index in migrations, so let drizzle-kit manage table DDL only.
  verbose: true,
  strict: true,
});
