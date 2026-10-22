/**
 * Backfill retrieval chunks for existing entries (Phase 1, workstream A).
 *
 * It does NOT call the embedding API itself. It arms one embedding job per
 * live entry that has text but no chunks yet; the normal worker then drains
 * them (one per page load, the scheduled /api/cron/embeddings route, or
 * --drain below). That makes the backfill, by construction:
 *   - idempotent and resumable: re-running only arms entries still missing
 *     chunks; jobs already pending are left as they are;
 *   - limit-aware: every job goes through the same per-user daily embedding
 *     limit and rate-limit backoff as live saves;
 *   - isolated per entry: one failing entry is retried/parked on its own.
 *
 *   node scripts/backfill-embeddings.mjs                 # dry run (default)
 *   node scripts/backfill-embeddings.mjs --apply --confirm <project-ref>
 *   node scripts/backfill-embeddings.mjs --drain http://localhost:3000
 *
 * --apply refuses to run unless --confirm matches the database's Supabase
 * project ref, so it can't be pointed at production by accident.
 * --drain calls the cron route (needs CRON_SECRET in apps/web/.env.local and
 * that server running with it) until a run processes nothing.
 * Options: --user <uuid> limits everything to one user; --batch <n> (100).
 */
import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../apps/web/.env.local") });

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (apps/web/.env.local).");
  process.exit(1);
}
// postgres://postgres.<ref>:...@aws-...pooler.supabase.com:6543/postgres
const projectRef =
  url.match(/postgres\.([a-z0-9]{10,})[:@]/)?.[1] ??
  url.match(/db\.([a-z0-9]{10,})\.supabase\.co/)?.[1] ??
  "unknown";
const userId = value("--user") ?? null;
const batch = Number(value("--batch") ?? 100);

const sql = postgres(url, { max: 1, prepare: false });

// Live entries with text and no chunks yet.
async function missing() {
  return sql`
    select e.id, e.user_id
    from entries e
    join transcripts t on t.entry_id = e.id
    where e.deleted_at is null
      and coalesce(nullif(trim(t.edited_text), ''), nullif(trim(t.raw_text), '')) is not null
      and not exists (select 1 from entry_chunks c where c.entry_id = e.id)
      ${userId ? sql`and e.user_id = ${userId}` : sql``}
    order by e.created_at`;
}

async function report(label) {
  const rows = await missing();
  const [jobs] = await sql`
    select count(*) filter (where status = 'pending')::int pending,
           count(*) filter (where status = 'processing')::int processing,
           count(*) filter (where status = 'failed')::int failed,
           count(*) filter (where status = 'done')::int done
    from embedding_jobs ${userId ? sql`where user_id = ${userId}` : sql``}`;
  const users = new Set(rows.map((r) => r.user_id)).size;
  console.log(
    `${label} project=${projectRef}${userId ? ` user=${userId}` : ""}\n` +
      `  entries with text but no chunks: ${rows.length} (across ${users} user(s))\n` +
      `  estimated embedding API calls:   ${rows.length} (one batched call per entry)\n` +
      `  jobs: pending=${jobs.pending} processing=${jobs.processing} done=${jobs.done} failed=${jobs.failed}`,
  );
  return rows;
}

try {
  if (flag("--drain")) {
    const base = value("--drain");
    const secret = process.env.CRON_SECRET;
    if (!base || !secret) {
      console.error("--drain needs a base URL and CRON_SECRET in apps/web/.env.local.");
      process.exit(1);
    }
    for (let run = 1; ; run++) {
      const res = await fetch(`${base}/api/cron/embeddings`, {
        headers: { authorization: `Bearer ${secret}` },
      });
      const body = await res.json().catch(() => ({}));
      console.log(`drain run ${run}: HTTP ${res.status}`, JSON.stringify(body));
      if (!res.ok || !body.processed) break;
    }
    await report("after drain:");
  } else if (flag("--apply")) {
    if (value("--confirm") !== projectRef) {
      console.error(
        `Refusing to write: pass --confirm ${projectRef} to arm jobs on this database.`,
      );
      process.exit(1);
    }
    const rows = await report("before:");
    let armed = 0;
    for (let i = 0; i < rows.length; i += batch) {
      const slice = rows.slice(i, i + batch);
      const result = await sql`
        insert into embedding_jobs (user_id, entry_id, status, attempts, next_attempt_at)
        select x.user_id::uuid, x.id::uuid, 'pending', 0, now()
        from jsonb_to_recordset(${sql.json(slice)}) as x(id text, user_id text)
        on conflict (entry_id) do update
          set status = 'pending', attempts = 0, last_error = null,
              next_attempt_at = now(), updated_at = clock_timestamp()
          where embedding_jobs.status in ('done', 'failed')`;
      armed += result.count;
      console.log(`  armed ${armed}/${rows.length}`);
    }
    await report("after:");
    console.log("Jobs drain on page loads, the daily cron, or with --drain.");
  } else {
    await report("DRY RUN (nothing written):");
    console.log(`To arm the jobs: node scripts/backfill-embeddings.mjs --apply --confirm ${projectRef}`);
  }
} finally {
  await sql.end();
}
