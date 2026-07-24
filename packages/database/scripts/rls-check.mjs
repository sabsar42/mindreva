/**
 * RLS smoke test. Proves the database itself denies cross-user reads — the
 * single highest-stakes guarantee for a journaling app.
 *
 * Run AFTER migrations are applied, with these env vars set (from .env):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 *   node packages/database/scripts/rls-check.mjs
 *
 * It creates two throwaway users, has user A insert an entry, then confirms
 * user B cannot see it through the RLS-enforced Supabase client. Cleans up after.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// Read the single env file the Next app uses (apps/web/.env.local).
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../apps/web/.env.local") });

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !service) {
  console.error(
    "Missing env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stamp = Date.now();
const userA = { email: `rls-a-${stamp}@example.com`, password: "Test-pw-123456" };
const userB = { email: `rls-b-${stamp}@example.com`, password: "Test-pw-123456" };
let idA, idB;

async function createUser(u) {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

async function signedInClient(u) {
  const client = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword(u);
  if (error) throw error;
  return client;
}

async function main() {
  let failures = 0;
  try {
    idA = await createUser(userA);
    idB = await createUser(userB);

    const clientA = await signedInClient(userA);
    const clientB = await signedInClient(userB);

    // A inserts an entry (RLS should allow inserting its own row).
    const { data: inserted, error: insErr } = await clientA
      .from("entries")
      .insert({ user_id: idA, type: "note", source: "text", title: "A private" })
      .select()
      .single();
    if (insErr) throw new Error(`A could not insert its own entry: ${insErr.message}`);
    console.log(`PASS  user A inserted its own entry (${inserted.id})`);

    // B tries to read A's entry by id — must get nothing.
    const { data: leaked } = await clientB
      .from("entries")
      .select("*")
      .eq("id", inserted.id);
    if (leaked && leaked.length > 0) {
      failures++;
      console.log("FAIL  user B could read user A's entry (RLS leak!)");
    } else {
      console.log("PASS  user B cannot read user A's entry by id");
    }

    // B lists entries — must not include A's.
    const { data: bList } = await clientB.from("entries").select("id");
    if ((bList ?? []).some((r) => r.id === inserted.id)) {
      failures++;
      console.log("FAIL  user A's entry appeared in user B's list (RLS leak!)");
    } else {
      console.log("PASS  user A's entry does not appear in user B's list");
    }
  } finally {
    // Cleanup: deleting the auth users cascades to their rows.
    if (idA) await admin.auth.admin.deleteUser(idA).catch(() => {});
    if (idB) await admin.auth.admin.deleteUser(idB).catch(() => {});
  }

  console.log(failures === 0 ? "\nALL PASS ✅" : `\n${failures} FAILURE(S) ❌`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
