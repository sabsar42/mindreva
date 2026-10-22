/**
 * Phase 2 retrieval eval: 10 synthetic entries, 10 questions, one auditable
 * table. Uses a throwaway user (created and deleted here; no real data) and
 * the real indexer, retrieval and answer prompt.
 *
 *   cd apps/web
 *   node --conditions=react-server --import tsx scripts/eval-retrieval.mts
 *
 * Costs ~20 OpenRouter free requests (10 entry embeddings + 10 question
 * embeddings; answers fall back to Groq when OpenRouter is exhausted), so it
 * checks the remaining daily quota first and refuses to start without it.
 * Writes docs/eval/retrieval-eval.md (overwritten each run).
 *
 * The PASS/FAIL column is mechanical (expected entries retrieved and cited;
 * no-record exactly when expected). Whether every claim in an answer is
 * supported by a retrieved chunk is marked NEEDS-REVIEW for a human; the
 * script never claims to have judged that.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const env = fs.readFileSync(path.join(ROOT, "apps/web/.env.local"), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]!] ??= m[2]!.replace(/^["']|["']$/g, "");
}

const { getDb } = await import("../../../packages/database/src/client.ts");
const { sql } = await import(
  "../../../packages/database/node_modules/drizzle-orm/index.js"
);
const { indexEntry } = await import("../lib/services/embedding-index.service.ts");
const { retrieveChunks } = await import("../lib/retrieval/retrieve.ts");
const { citationsFor } = await import("../lib/retrieval/fuse.ts");
const { getLLMProvider, buildPersonaChatMessages, NO_RECORD_REPLY, isNoRecordReply } =
  await import("../../../packages/llm/src/index.ts");

const NEEDED_REQUESTS = 22;
const OUT = path.join(ROOT, "docs/eval/retrieval-eval.md");

// ---- fixture ---------------------------------------------------------------
const longTrip = [
  "Priya came over after work and we finally sat down to plan the trip. We have been talking about Lisbon for almost a year, and tonight it stopped being a someday thing. We put the dates in the calendar: the last week of May, flying out on a Saturday morning.",
  "We argued a little about where to stay. Priya wants Alfama because of the old streets and the trams, and I want somewhere quieter near Príncipe Real. We settled on splitting the week, three nights in each. She is going to look at small guesthouses and I will compare the train prices to Sintra.",
  "Money is the part that makes me nervous. I added it up twice: flights, rooms and food come to more than I expected, so I am going to stop buying lunch at the office for the next two months and put that aside instead. Priya laughed and said I plan holidays like a budget meeting.",
  "Things we want to do: a day in Sintra, the tile museum, a fado evening if we can find one that isn't only for tourists, and one completely empty day with no plans at all. I wrote the list on the back of an envelope and stuck it on the fridge so we don't lose it.",
  "Before she left we booked nothing, but it felt real anyway. I went to bed thinking about the light on the river in the photos she showed me.",
].join("\n\n");

const longWork = [
  "The Atlas migration finally has a date. Rafael told the team this morning that we cut over on the fourteenth of July, which gives us five weeks to move every customer report off the old system. Nobody said much in the meeting, but you could feel the room tighten.",
  "My part is the billing exports. They are the oldest code in the whole system and half of the rules only live in people's heads. I spent the afternoon writing down every special case I could find, and the list is already two pages long.",
  "Rafael asked me to run a dry run every Friday so we find the surprises early. I said yes, and then worried all the way home that the first dry run will be a disaster. I think it probably will be, and that is the point of doing it.",
  "Small good thing: the new person on the team asked smart questions about the export rules and I realised I actually know this system well. I am more ready than I feel.",
  "Plan for tomorrow: finish the special-case list, ask finance which reports they truly need, and block Friday afternoons in my calendar for the dry runs.",
].join("\n\n");

interface FixtureEntry { key: string; date: string; text: string }
const entries: FixtureEntry[] = [
  { key: "E1-lisbon-plan", date: "2025-03-14", text: longTrip },
  { key: "E2-atlas-work", date: "2025-06-02", text: longWork },
  { key: "E3-dentist", date: "2025-03-20", text: "The dentist moved my appointment to Thursday at nine. I need to leave early and take the bus, not the car." },
  { key: "E4-notebook", date: "2025-09-05", text: "Bought a blue notebook at Café Rumi this afternoon. It has thick cream pages, and I am going to use it only for ideas, nothing about work." },
  { key: "E5a-run-april", date: "2025-04-10", text: "First proper run in months: a slow 5k around the park, walking twice. My legs felt heavy but I finished, and I promised myself three runs a week." },
  { key: "E5b-run-august", date: "2025-08-15", text: "Ran 10k without stopping for the first time. In April I couldn't do 5k without walking. I kept the three runs a week almost every week since then." },
  { key: "E6-okonkwo", date: "2025-05-12", text: "Okonkwo from the data team spent an hour with me untangling the report queries. He drew the whole flow on the whiteboard and suddenly it made sense. I owe him a coffee." },
  { key: "E7-sreemangal", date: "2025-07-20", text: "We reached Sreemangal in the afternoon. The tea gardens go on forever, green hill after green hill, and it rained softly the whole evening. We drank seven-layer tea at a little stall and nobody wanted to go back to the city." },
  { key: "E8-gratitude", date: "2025-10-01", text: "**Grateful today:**\n\n- _Mum's_ phone call in the morning\n- the **quiet** train home\n- finishing the book I started in *summer*" },
  { key: "E9-move-anxiety", date: "2025-11-11", text: "Boxes everywhere. The move is in nine days and I keep waking up at four, running through everything that could go wrong. I don't know anyone in the new neighbourhood yet. I'm trying to tell myself it's normal to feel unmoored." },
];

interface Question {
  q: string;
  expected: string;
  /** Entry keys that should be retrieved and cited; empty = no-record. */
  expectedKeys: string[];
  range: [string, string];
}
const ALL: [string, string] = ["2025-01-01", "2025-12-31"];
const questions: Question[] = [
  { q: "Where were Priya and I planning to travel?", expected: "Lisbon, from E1", expectedKeys: ["E1-lisbon-plan"], range: ALL },
  { q: "What did I write about in March?", expected: "Date-scoped: E1 and E3 only", expectedKeys: ["E1-lisbon-plan", "E3-dentist"], range: ["2025-03-01", "2025-03-31"] },
  { q: "What did Okonkwo help me with?", expected: "Exact name: report queries, E6", expectedKeys: ["E6-okonkwo"], range: ALL },
  { q: "What was it like at Sreemangal?", expected: "Exact place: tea gardens, rain, E7", expectedKeys: ["E7-sreemangal"], range: ALL },
  { q: 'Where did I buy the "blue notebook"?', expected: "Exact phrase: Café Rumi, E4", expectedKeys: ["E4-notebook"], range: ALL },
  { q: "How did my running change between April and August?", expected: "Spans two entries: 5k with walking -> 10k, E5a+E5b", expectedKeys: ["E5a-run-april", "E5b-run-august"], range: ALL },
  { q: "What was weighing on me before the move?", expected: "Vague/emotional: anxiety about the move, E9", expectedKeys: ["E9-move-anxiety"], range: ALL },
  { q: "What was I grateful for in October?", expected: "Formatted entry, plain text only: Mum's call, quiet train, book, E8", expectedKeys: ["E8-gratitude"], range: ["2025-10-01", "2025-10-31"] },
  { q: "What did I say about my sister's wedding?", expected: "Not written anywhere: honest no-record", expectedKeys: [], range: ALL },
  { q: "What did Priya say when we arrived in Lisbon?", expected: "TRAP: the trip was only planned, never described: no-record", expectedKeys: [], range: ALL },
];

// ---- helpers ---------------------------------------------------------------
const db = getDb();
const rows = (r: unknown) => (Array.isArray(r) ? r : (r as { rows: unknown[] }).rows) as Record<string, unknown>[];
const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n+/g, " ");

async function remainingFreeRequests(): Promise<number | null> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    });
    const data = (await res.json()) as { data?: { free_model_daily_requests?: { remaining?: number } } };
    return data.data?.free_model_daily_requests?.remaining ?? null;
  } catch {
    return null;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };

// ---- run -------------------------------------------------------------------
const remaining = await remainingFreeRequests();
if (remaining !== null && remaining < NEEDED_REQUESTS && !process.argv.includes("--force")) {
  console.error(`Only ${remaining} OpenRouter free requests left today; the eval needs ~${NEEDED_REQUESTS}. Run after 00:00 UTC (or pass --force).`);
  process.exit(1);
}

const created = await (await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST", headers: H,
  body: JSON.stringify({ email: `eval-${Date.now()}@example.com`, password: crypto.randomUUID(), email_confirm: true }),
})).json() as { id: string };
const userId = created.id;
const keyById = new Map<string, string>();
const lines: string[] = [];

try {
  await db.execute(sql`update profiles set languages = 'en', timezone = 'UTC', timezone_synced_at = now() where id = ${userId}`);
  for (const e of entries) {
    const [row] = rows(await db.execute(sql`insert into entries (user_id, type, source, entry_date)
      values (${userId}, 'journal', 'text', ${e.date}) returning id`));
    const id = String(row!.id);
    keyById.set(id, e.key);
    await db.execute(sql`insert into transcripts (entry_id, raw_text, status) values (${id}, ${e.text}, 'done')`);
    const outcome = await indexEntry(id, userId, { refreshMindmap: false });
    console.log(`indexed ${e.key}: ${JSON.stringify(outcome)}`);
  }

  const chunkRows = rows(await db.execute(sql`select entry_id, chunk_index, token_count, content from entry_chunks where user_id = ${userId} order by entry_id, chunk_index`));
  const formattingLeak = chunkRows.some((c) => /\*\*|(^|\s)_\S|\*[^*\s]/.test(String(c.content)));

  const provider = getLLMProvider();
  const answerableTop: number[] = [];
  const unanswerableTop: number[] = [];
  const results: string[] = [];

  for (const [i, item] of questions.entries()) {
    let queryVector: number[] | null = null;
    try { queryVector = await provider.embed(item.q); } catch (err) { console.error("query embed failed:", String(err).slice(0, 120)); }
    const r = await retrieveChunks({ userId, question: item.q, dateFrom: item.range[0], dateTo: item.range[1], queryVector });
    const top = Math.max(0, ...r.debug.vector.map((v) => v.similarity));
    (item.expectedKeys.length ? answerableTop : unanswerableTop).push(top);

    let answer: string;
    let model = "(no model call: no evidence)";
    if (r.chunks.length === 0) {
      answer = NO_RECORD_REPLY;
    } else {
      const completion = await provider.complete(buildPersonaChatMessages({
        startDate: item.range[0], endDate: item.range[1],
        excerpts: r.chunks.map((c) => ({ entryId: c.entryId, entryDate: c.entryDate, text: c.content })),
        conversationHistory: [], question: item.q,
      }));
      answer = completion.text;
      model = `${completion.provider}/${completion.model}`;
    }
    const noRecord = isNoRecordReply(answer);
    const cites = noRecord ? [] : citationsFor(r.chunks);
    const citedKeys = cites.map((c) => keyById.get(c.entryId) ?? "?");
    const passedKeys = [...new Set(r.chunks.map((c) => keyById.get(c.entryId) ?? "?"))];

    let verdict: string;
    if (item.expectedKeys.length === 0) {
      verdict = noRecord ? "PASS" : "FAIL (answered an unanswerable question: check for INVENTED claims)";
    } else {
      const missing = item.expectedKeys.filter((k) => !citedKeys.includes(k));
      const extraOutOfRange = passedKeys.filter((k) => {
        const e = entries.find((x) => x.key === k);
        return e && (e.date < item.range[0] || e.date > item.range[1]);
      });
      verdict = noRecord ? "FAIL (no-record for an answerable question)"
        : missing.length ? `FAIL (not cited: ${missing.join(", ")})`
        : extraOutOfRange.length ? `FAIL (out-of-range context: ${extraOutOfRange.join(", ")})`
        : "NEEDS-REVIEW (retrieval correct; check every claim against the chunks)";
    }

    const chunkDetail = r.chunks.map((c) => {
      const k = keyById.get(c.entryId) ?? "?";
      const kw = r.debug.keyword.findIndex((x) => x.chunkId === c.chunkId);
      return `${k} #${c.chunkIndex} (${c.entryDate}) sim=${c.similarity?.toFixed(3) ?? "n/a"} kw=${kw >= 0 ? `yes r${kw + 1}` : "no"} [${c.source}]`;
    });
    results.push(`| ${i + 1} | ${esc(item.q)} | ${esc(item.expected)} | ${esc(answer)} | ${esc(chunkDetail.join("; ") || "none")} | ${esc(passedKeys.join(", ") || "none")} | ${esc(citedKeys.join(", ") || "none")} | ${esc(model)} | ${esc(verdict)} |`);
    console.log(`Q${i + 1}: ${verdict.split(" ")[0]} | top vector similarity ${top.toFixed(3)}`);
  }

  const fmt = (xs: number[]) => xs.map((x) => x.toFixed(3)).sort().join(", ");
  lines.push(
    `# Retrieval eval — ${new Date().toISOString()}`,
    "",
    `Throwaway user, 10 synthetic entries (${chunkRows.length} chunks; multi-chunk: ${[...new Set(chunkRows.filter((c) => Number(c.chunk_index) > 0).map((c) => keyById.get(String(c.entry_id))))].join(", ") || "none"}), similarity threshold ${(await import("../lib/retrieval/retrieve.ts")).minSimilarity()}.`,
    `Formatting markers in stored chunk text: ${formattingLeak ? "FOUND (stripFormatting problem)" : "none (stripFormatting OK)"}.`,
    "",
    "| # | Question | Expected | Answer | Retrieved chunks (entry, chunk, date, vector sim, keyword hit/rank, source) | Passed to model | Citation chips | Model | Verdict |",
    "|---|---|---|---|---|---|---|---|---|",
    ...results,
    "",
    "## Top vector similarity per question",
    "",
    `- Answerable: ${fmt(answerableTop)}`,
    `- Unanswerable: ${fmt(unanswerableTop)}`,
    "",
    "A threshold belongs between the unanswerable maximum and the answerable minimum; where they overlap, the keyword-evidence rule and the model's grounding instructions are what keep unanswerable questions honest.",
  );
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join("\n") + "\n");
  console.log(`\nWrote ${path.relative(ROOT, OUT)}`);
} finally {
  await fetch(`${url}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: H });
  const [left] = rows(await db.execute(sql`select (select count(*) from entries where user_id = ${userId})::int e, (select count(*) from entry_chunks where user_id = ${userId})::int c`));
  console.log(`cleanup: throwaway user deleted (entries=${left!.e}, chunks=${left!.c} left)`);
  process.exit(0);
}
