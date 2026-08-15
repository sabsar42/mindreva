import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Lazy Drizzle client. The connection is created on first use, not at import
 * time, so building without DATABASE_URL (e.g. CI, or a page that never touches
 * the DB) doesn't fail.
 *
 * IMPORTANT: this connects as the service role and BYPASSES Row Level Security.
 * Repositories are the only code allowed to import this, and every repository
 * method must scope its queries by the caller's userId. RLS remains enabled as
 * defense-in-depth for any access that goes through the Supabase client instead.
 */
let dbSingleton: PostgresJsDatabase<typeof schema> | undefined;

// TEMPORARY DIAGNOSTIC — module load timestamp + a per-process random id, so
// Vercel's function logs show whether getDb() is reusing the same module
// instance across requests (singleton working) or re-evaluating this file
// fresh each time (singleton defeated by the platform's instance lifecycle).
// Remove once the question is answered — see docs/KNOWN-ISSUES.md.
const MODULE_INSTANCE_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let getDbCallCount = 0;

export function getDb(): PostgresJsDatabase<typeof schema> {
  getDbCallCount++;
  const wasAlreadyInitialized = !!dbSingleton;
  if (!dbSingleton) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Add it to your environment (Supabase transaction pooler string).",
      );
    }
    // prepare:false is required for Supabase's transaction-mode pooler (6543).
    const client = postgres(connectionString, { prepare: false });
    dbSingleton = drizzle(client, { schema });
  }
  console.log(
    `[getDb diagnostic] moduleInstance=${MODULE_INSTANCE_ID} callCount=${getDbCallCount} reusedExistingConnection=${wasAlreadyInitialized}`,
  );
  return dbSingleton;
}
