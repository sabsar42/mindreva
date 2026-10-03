/**
 * Dev seed script — run with:
 *   node_modules/.bin/tsx --env-file=.env scripts/seed-dev.ts
 */

import path from "path";
// Use the postgres package directly from the pnpm store path.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const postgres = require(
  path.join(
    __dirname,
    "..",
    "node_modules",
    ".pnpm",
    "postgres@3.4.9",
    "node_modules",
    "postgres",
    "cjs",
    "index.js",
  ),
) as typeof import("postgres");

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

async function main() {
  // ── 1. Resolve user id ──────────────────────────────────────────────────
  const BASE = process.env.SUPABASE_URL!;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const usersRes = await fetch(`${BASE}/auth/v1/admin/users?per_page=1000`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const usersData = (await usersRes.json()) as {
    users: { id: string; email: string }[];
  };
  const user = usersData.users.find(
    (u) => u.email === "naifhaiderchowdhury5@gmail.com",
  );
  if (!user) throw new Error("User not found");
  const uid = user.id;
  console.log("User found:", uid);

  // ── 2. Soft-delete existing active entries ─────────────────────────────
  await sql`UPDATE entries SET deleted_at = NOW() WHERE user_id = ${uid} AND deleted_at IS NULL`;
  console.log("Existing entries soft-deleted.");

  // ── 3. Entry definitions ───────────────────────────────────────────────
  const entries = [
    {
      title: "Morning run & the Q3 pitch",
      type: "journal",
      source: "voice",
      entry_date: "2026-09-26",
      created_at: "2026-09-26T07:42:00+00:00",
      transcript:
        "Ran the lake loop before work. Somewhere around the second kilometre the pitch clicked: lead with the customer story, not the numbers. I need to send Maya the new deck and book the room for Thursday.",
      summary:
        "A clarifying run reframed the Q3 pitch around one customer story. Next up: share the updated deck and lock in Thursday's rehearsal.",
      tasks: [
        { text: "Send Maya the updated deck", is_done: true },
        { text: "Book the room for Thursday", is_done: true },
        { text: "Rehearse the customer story", is_done: false },
      ],
    },
    {
      title: "Weekly review",
      type: "journal",
      source: "voice",
      entry_date: "2026-09-22",
      created_at: "2026-09-22T18:10:00+00:00",
      transcript:
        "Three things went well this week: shipped the search feature, had a good sync with the design team, and cleared out the backlog. One thing that did not go well: I let the status meeting run too long and lost the afternoon. Next week I want to block deep work time in the mornings.",
      summary:
        "A productive week on the product side, with the search feature shipped and backlog cleared. The main thing to fix next week is protecting morning focus time from meetings.",
      tasks: [
        { text: "Block 9 to 12 for deep work every weekday", is_done: false },
        { text: "Cap the status meeting at 30 minutes", is_done: false },
      ],
    },
    {
      title: "Coffee chat with Arif",
      type: "journal",
      source: "voice",
      entry_date: "2026-09-19",
      created_at: "2026-09-19T11:30:00+00:00",
      transcript:
        "Met Arif at the usual place. He is moving to a product role at a fintech startup. We talked about the early-stage grind and how to keep energy up through the chaotic months. His advice: pick one metric and ignore everything else until it moves. I think that applies to what I am building too.",
      summary:
        "An energising conversation about early-stage focus. The key takeaway: choose one north-star metric and guard it ruthlessly.",
      tasks: [],
    },
    {
      title: "Reading notes: Thinking Fast and Slow",
      type: "note",
      source: "text",
      entry_date: "2026-09-17",
      created_at: "2026-09-17T21:05:00+00:00",
      transcript:
        "System 1 vs System 2. System 1 is fast, automatic, emotional. System 2 is slow, deliberate, logical. Most of our decisions are System 1, dressed up as System 2 after the fact. The anchoring effect is striking: the number you see first, even if irrelevant, pulls your estimate toward it. Practical takeaway: when making important decisions, write down your reasoning before you see any numbers.",
      summary:
        "Core insight: most decisions are post-hoc rationalisations of System 1 instincts. Anchoring bias is the most immediately applicable finding.",
      tasks: [
        {
          text: "Use the pre-mortem technique on the next big decision",
          is_done: false,
        },
      ],
    },
    {
      title: "First day with the new workflow",
      type: "journal",
      source: "voice",
      entry_date: "2026-09-14",
      created_at: "2026-09-14T19:55:00+00:00",
      transcript:
        "Tried the time-blocking system today for the first time. Morning block from 9 to 12 was genuinely focused, got the data pipeline refactor done without a single interruption. Afternoon was a bit messier because I had not blocked it properly. The key insight: it is not just about blocking the time, it is about telling people in advance so they stop booking over it.",
      summary:
        "Morning time-blocking worked well for the refactor. The lesson: communicate the new schedule to the team so meetings stop landing in focus blocks.",
      tasks: [
        { text: "Update the shared calendar with focus blocks", is_done: true },
        {
          text: "Tell the team about the new morning schedule",
          is_done: false,
        },
      ],
    },
    {
      title: "Late night idea dump",
      type: "journal",
      source: "voice",
      entry_date: "2026-09-11",
      created_at: "2026-09-11T23:40:00+00:00",
      transcript:
        "Could not sleep. The idea about using embeddings to surface forgotten memories keeps nagging at me. What if the app could proactively surface a relevant memory from a year ago, unprompted? Like a quiet notification: you wrote about this exact thing 14 months ago. That would be genuinely useful, not just a gimmick. Need to think about the cold-start problem though, you need enough data before it works.",
      summary:
        "An idea for proactive memory surfacing: the app noticing when a current theme echoes something from a year ago. Cold-start is the main constraint to solve first.",
      tasks: [
        {
          text: "Sketch the notification UX for memory surfacing",
          is_done: false,
        },
        {
          text: "Research minimum data threshold for reliable embedding retrieval",
          is_done: false,
        },
      ],
    },
    {
      title: "Team offsite retrospective",
      type: "journal",
      source: "voice",
      entry_date: "2026-09-08",
      created_at: "2026-09-08T17:20:00+00:00",
      transcript:
        "Two-day offsite is done. The best session was the one where we mapped out all the things slowing us down, it turned into a genuine list of bets to make, not just complaints. The worst session was the vision exercise, which ran too abstract. Concrete feedback for next time: start with the real constraints, not the imagined future.",
      summary:
        "The friction-mapping session was the most valuable part of the offsite. Next time, anchor vision discussions in real constraints from day one.",
      tasks: [
        { text: "Write up the top three bets from the offsite", is_done: true },
        { text: "Share the friction map with the wider team", is_done: false },
      ],
    },
    {
      title: "On feeling overwhelmed",
      type: "journal",
      source: "voice",
      entry_date: "2026-09-04",
      created_at: "2026-09-04T20:15:00+00:00",
      transcript:
        "Hard day. Too many things happening at once and none of them finished. The feeling is familiar, it is not really about the volume of work, it is about the lack of a clear next action on each thread. When I listed everything out and picked just one thing to finish before the day ended, the feeling started to lift. Finished the API integration. That felt good.",
      summary:
        "A difficult day resolved by reducing to a single concrete action. The pattern: overwhelm comes from open loops, not from total workload.",
      tasks: [],
    },
    {
      title: "Podcast notes: Acquired, Stripe episode",
      type: "note",
      source: "text",
      entry_date: "2026-09-01",
      created_at: "2026-09-01T14:00:00+00:00",
      transcript:
        "Stripe's early bet was on making the developer experience so good that the first integration would take 7 lines of code. Everyone else at the time thought payments were a commodity. Stripe bet that the experience of integrating payments was the product. The lesson that keeps landing: the interface is the product. How something is used is as important as what it does.",
      summary:
        "Stripe's insight: the integration experience is the product, not the payment rails. The interface is the product.",
      tasks: [
        {
          text: "Review our own onboarding integration experience end-to-end",
          is_done: false,
        },
      ],
    },
    {
      title: "Walk along the waterfront",
      type: "journal",
      source: "voice",
      entry_date: "2026-08-28",
      created_at: "2026-08-28T17:30:00+00:00",
      transcript:
        "Took a long walk after the deadline. The city looks different at 5pm on a Thursday when you are not in a hurry. I have been inside too much this month. Note to self: the work does not get better when you grind harder into it. The walk produced two ideas that the all-nighter did not.",
      summary:
        "Rest and movement produced better ideas than grinding. A reminder to build walks into the schedule as work, not as a reward for finishing.",
      tasks: [],
    },
    {
      title: "Quarterly goals check-in",
      type: "journal",
      source: "voice",
      entry_date: "2026-08-25",
      created_at: "2026-08-25T09:00:00+00:00",
      transcript:
        "Q3 goals review. Goal 1: Ship search, done. Goal 2: Reduce load time under 2 seconds, partially done, at 2.4 seconds. Goal 3: Reach 500 active users, not there yet, at 312. The load time one is frustrating because I know exactly what is causing it but it keeps getting deprioritised. Setting a hard decision: next sprint, load time fix is the only thing.",
      summary:
        "Two out of three Q3 goals are progressing. Load time is the one clear bottleneck. Decision: treat the fix as non-negotiable for the next sprint.",
      tasks: [
        {
          text: "Fix the Storage call waterfall causing the 2.4s load time",
          is_done: true,
        },
        {
          text: "Protect next sprint from any non-load-time work",
          is_done: false,
        },
      ],
    },
    {
      title: "Brainstorm: what makes a great journal app",
      type: "note",
      source: "text",
      entry_date: "2026-08-20",
      created_at: "2026-08-20T16:45:00+00:00",
      transcript:
        "Quick capture has to be frictionless. The moment you add a login step or a what-category-is-this prompt, you lose the thought. The replay experience matters too, re-reading old entries should feel like meeting a younger version of yourself, not filing a report. Summaries help because raw voice notes are hard to read back. And the data has to feel private, not private like a legal statement, private like a diary.",
      summary:
        "Three pillars for a great journal app: frictionless capture, meaningful replay, and felt privacy. All three have to work together.",
      tasks: [
        {
          text: "Audit the current capture flow for friction points",
          is_done: false,
        },
      ],
    },
  ];

  // ── 4. Insert each entry ────────────────────────────────────────────────
  for (const def of entries) {
    const [entry] = await sql`
      INSERT INTO entries (user_id, type, source, title, entry_date, created_at, updated_at)
      VALUES (${uid}, ${def.type}, ${def.source}, ${def.title}, ${def.entry_date}, ${def.created_at}, ${def.created_at})
      RETURNING id
    `;
    const entryId = (entry as { id: string }).id;

    await sql`
      INSERT INTO transcripts (entry_id, raw_text, edited_text, status, provider, language)
      VALUES (${entryId}, ${def.transcript}, ${def.transcript}, 'done', 'groq', 'en')
    `;

    await sql`
      INSERT INTO summaries (entry_id, summary_text, prompt_version, provider)
      VALUES (${entryId}, ${def.summary}, 'v3', 'openrouter')
    `;

    for (const task of def.tasks) {
      await sql`
        INSERT INTO entry_tasks (entry_id, text, is_done)
        VALUES (${entryId}, ${task.text}, ${task.is_done})
      `;
    }

    console.log("Inserted:", def.title);
  }

  await sql.end();
  console.log("\nSeed complete. 12 entries inserted.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
