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

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!dbSingleton) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Add it to your environment (Supabase transaction pooler string).",
      );
    }
    if (/:5432\//.test(connectionString)) {
      console.warn(
        "DATABASE_URL points at the direct connection (5432). Runtime queries should use the transaction pooler (6543); keep 5432 for migrations only.",
      );
    }
    // Supabase transaction-mode pooler (6543):
    // - prepare:false is required: pooled backends can't keep prepared
    //   statements between transactions.
    // - max:1 keeps each serverless instance to a single pooler connection,
    //   Supabase's guidance for serverless. Queries from one request queue on
    //   that connection, and with prepare:false each parameterised query is
    //   two round trips, so this is only cheap because the function runs in
    //   the database's own region (vercel.json "icn1", same as Supabase
    //   ap-northeast-2). DATABASE_POOL_MAX can raise it without a code change.
    // - idle_timeout closes the connection once the instance goes quiet.
    const client = postgres(connectionString, {
      prepare: false,
      max: Number(process.env.DATABASE_POOL_MAX) || 1,
      idle_timeout: 20,
    });
    dbSingleton = drizzle(client, { schema });
  }
  return dbSingleton;
}
