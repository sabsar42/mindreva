-- Mindreva dev seed — paste into the Supabase SQL editor and run.
-- 1. Soft-deletes all existing entries for naifhaiderchowdhury@gmail.com.
-- 2. Inserts 12 realistic journal/note entries with transcripts, summaries, and tasks.
-- Embeddings and mindmap clusters are recomputed automatically in the background
-- after you open each entry and regenerate its summary in the app.

DO $$
DECLARE
  v_uid uuid;
  e1  uuid; e2  uuid; e3  uuid; e4  uuid;
  e5  uuid; e6  uuid; e7  uuid; e8  uuid;
  e9  uuid; e10 uuid; e11 uuid; e12 uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'naifhaiderchowdhury@gmail.com';
  IF v_uid IS NULL THEN RAISE EXCEPTION 'User not found: naifhaiderchowdhury@gmail.com'; END IF;

  -- ── 1. Soft-delete all existing active entries ──────────────────────────
  UPDATE entries SET deleted_at = NOW() WHERE user_id = v_uid AND deleted_at IS NULL;

  -- ── 2. Insert entries ────────────────────────────────────────────────────

  INSERT INTO entries (user_id, type, source, title, entry_date, created_at, updated_at)
  VALUES (v_uid, 'journal', 'voice', 'Morning run & the Q3 pitch', '2026-09-26',
          '2026-09-26 07:42:00+00', '2026-09-26 07:42:00+00')
  RETURNING id INTO e1;

  INSERT INTO entries (user_id, type, source, title, entry_date, created_at, updated_at)
  VALUES (v_uid, 'journal', 'voice', 'Weekly review', '2026-09-22',
          '2026-09-22 18:10:00+00', '2026-09-22 18:10:00+00')
  RETURNING id INTO e2;

  INSERT INTO entries (user_id, type, source, title, entry_date, created_at, updated_at)
  VALUES (v_uid, 'journal', 'voice', 'Coffee chat with Arif', '2026-09-19',
          '2026-09-19 11:30:00+00', '2026-09-19 11:30:00+00')
  RETURNING id INTO e3;

  INSERT INTO entries (user_id, type, source, title, entry_date, created_at, updated_at)
  VALUES (v_uid, 'note', 'text', 'Reading notes: Thinking Fast and Slow', '2026-09-17',
          '2026-09-17 21:05:00+00', '2026-09-17 21:05:00+00')
  RETURNING id INTO e4;

  INSERT INTO entries (user_id, type, source, title, entry_date, created_at, updated_at)
  VALUES (v_uid, 'journal', 'voice', 'First day with the new workflow', '2026-09-14',
          '2026-09-14 19:55:00+00', '2026-09-14 19:55:00+00')
  RETURNING id INTO e5;

  INSERT INTO entries (user_id, type, source, title, entry_date, created_at, updated_at)
  VALUES (v_uid, 'journal', 'voice', 'Late night idea dump', '2026-09-11',
          '2026-09-11 23:40:00+00', '2026-09-11 23:40:00+00')
  RETURNING id INTO e6;

  INSERT INTO entries (user_id, type, source, title, entry_date, created_at, updated_at)
  VALUES (v_uid, 'journal', 'voice', 'Team offsite retrospective', '2026-09-08',
          '2026-09-08 17:20:00+00', '2026-09-08 17:20:00+00')
  RETURNING id INTO e7;

  INSERT INTO entries (user_id, type, source, title, entry_date, created_at, updated_at)
  VALUES (v_uid, 'journal', 'voice', 'On feeling overwhelmed', '2026-09-04',
          '2026-09-04 20:15:00+00', '2026-09-04 20:15:00+00')
  RETURNING id INTO e8;

  INSERT INTO entries (user_id, type, source, title, entry_date, created_at, updated_at)
  VALUES (v_uid, 'note', 'text', 'Podcast notes: Acquired — Stripe episode', '2026-09-01',
          '2026-09-01 14:00:00+00', '2026-09-01 14:00:00+00')
  RETURNING id INTO e9;

  INSERT INTO entries (user_id, type, source, title, entry_date, created_at, updated_at)
  VALUES (v_uid, 'journal', 'voice', 'Walk along the waterfront', '2026-08-28',
          '2026-08-28 17:30:00+00', '2026-08-28 17:30:00+00')
  RETURNING id INTO e10;

  INSERT INTO entries (user_id, type, source, title, entry_date, created_at, updated_at)
  VALUES (v_uid, 'journal', 'voice', 'Quarterly goals check-in', '2026-08-25',
          '2026-08-25 09:00:00+00', '2026-08-25 09:00:00+00')
  RETURNING id INTO e11;

  INSERT INTO entries (user_id, type, source, title, entry_date, created_at, updated_at)
  VALUES (v_uid, 'note', 'text', 'Brainstorm: what makes a great journal app', '2026-08-20',
          '2026-08-20 16:45:00+00', '2026-08-20 16:45:00+00')
  RETURNING id INTO e12;

  -- ── 3. Transcripts ───────────────────────────────────────────────────────

  INSERT INTO transcripts (entry_id, raw_text, edited_text, status, provider, language)
  VALUES (e1,
    'Ran the lake loop before work. Somewhere around the second kilometre the pitch clicked: lead with the customer story, not the numbers. I need to send Maya the new deck and book the room for Thursday.',
    'Ran the lake loop before work. Somewhere around the second kilometre the pitch clicked: lead with the customer story, not the numbers. I need to send Maya the new deck and book the room for Thursday.',
    'done', 'groq', 'en');

  INSERT INTO transcripts (entry_id, raw_text, edited_text, status, provider, language)
  VALUES (e2,
    'Three things went well this week: shipped the search feature, had a good sync with the design team, and cleared out the backlog. One thing that did not go well: I let the status meeting run too long and lost the afternoon. Next week I want to block deep work time in the mornings.',
    'Three things went well this week: shipped the search feature, had a good sync with the design team, and cleared out the backlog. One thing that did not go well: I let the status meeting run too long and lost the afternoon. Next week I want to block deep work time in the mornings.',
    'done', 'groq', 'en');

  INSERT INTO transcripts (entry_id, raw_text, edited_text, status, provider, language)
  VALUES (e3,
    'Met Arif at the usual place. He is moving to a product role at a fintech startup. We talked about the early-stage grind and how to keep energy up through the chaotic months. His advice: pick one metric and ignore everything else until it moves. I think that applies to what I am building too.',
    'Met Arif at the usual place. He is moving to a product role at a fintech startup. We talked about the early-stage grind and how to keep energy up through the chaotic months. His advice: pick one metric and ignore everything else until it moves. I think that applies to what I am building too.',
    'done', 'groq', 'en');

  INSERT INTO transcripts (entry_id, raw_text, edited_text, status, provider, language)
  VALUES (e4,
    'System 1 vs System 2. System 1 is fast, automatic, emotional. System 2 is slow, deliberate, logical. Most of our decisions are System 1, dressed up as System 2 after the fact. The anchoring effect is striking — the number you see first, even if irrelevant, pulls your estimate toward it. Practical takeaway: when making important decisions, write down your reasoning before you see any numbers.',
    'System 1 vs System 2. System 1 is fast, automatic, emotional. System 2 is slow, deliberate, logical. Most of our decisions are System 1, dressed up as System 2 after the fact. The anchoring effect is striking — the number you see first, even if irrelevant, pulls your estimate toward it. Practical takeaway: when making important decisions, write down your reasoning before you see any numbers.',
    'done', 'groq', 'en');

  INSERT INTO transcripts (entry_id, raw_text, edited_text, status, provider, language)
  VALUES (e5,
    'Tried the time-blocking system today for the first time. Morning block from 9 to 12 was genuinely focused — got the data pipeline refactor done without a single interruption. Afternoon was a bit messier because I had not blocked it properly. The key insight: it is not just about blocking the time, it is about telling people in advance so they stop booking over it.',
    'Tried the time-blocking system today for the first time. Morning block from 9 to 12 was genuinely focused — got the data pipeline refactor done without a single interruption. Afternoon was a bit messier because I had not blocked it properly. The key insight: it is not just about blocking the time, it is about telling people in advance so they stop booking over it.',
    'done', 'groq', 'en');

  INSERT INTO transcripts (entry_id, raw_text, edited_text, status, provider, language)
  VALUES (e6,
    'Could not sleep. The idea about using embeddings to surface forgotten memories keeps nagging at me. What if the app could proactively surface a relevant memory from a year ago, unprompted? Like a quiet notification: you wrote about this exact thing 14 months ago. That would be genuinely useful, not just a gimmick. Need to think about the cold-start problem though — you need enough data before it works.',
    'Could not sleep. The idea about using embeddings to surface forgotten memories keeps nagging at me. What if the app could proactively surface a relevant memory from a year ago, unprompted? Like a quiet notification: you wrote about this exact thing 14 months ago. That would be genuinely useful, not just a gimmick. Need to think about the cold-start problem though — you need enough data before it works.',
    'done', 'groq', 'en');

  INSERT INTO transcripts (entry_id, raw_text, edited_text, status, provider, language)
  VALUES (e7,
    'Two-day offsite is done. The best session was the one where we mapped out all the things slowing us down — it turned into a genuine list of bets to make, not just complaints. The worst session was the vision exercise, which ran too abstract. Concrete feedback for next time: start with the real constraints, not the imagined future.',
    'Two-day offsite is done. The best session was the one where we mapped out all the things slowing us down — it turned into a genuine list of bets to make, not just complaints. The worst session was the vision exercise, which ran too abstract. Concrete feedback for next time: start with the real constraints, not the imagined future.',
    'done', 'groq', 'en');

  INSERT INTO transcripts (entry_id, raw_text, edited_text, status, provider, language)
  VALUES (e8,
    'Hard day. Too many things happening at once and none of them finished. The feeling is familiar — it is not really about the volume of work, it is about the lack of a clear next action on each thread. When I listed everything out and picked just one thing to finish before the day ended, the feeling started to lift. Finished the API integration. That felt good.',
    'Hard day. Too many things happening at once and none of them finished. The feeling is familiar — it is not really about the volume of work, it is about the lack of a clear next action on each thread. When I listed everything out and picked just one thing to finish before the day ended, the feeling started to lift. Finished the API integration. That felt good.',
    'done', 'groq', 'en');

  INSERT INTO transcripts (entry_id, raw_text, edited_text, status, provider, language)
  VALUES (e9,
    'Stripe''s early bet was on making the developer experience so good that the first integration would take 7 lines of code. Everyone else at the time thought payments were a commodity — Stripe bet that the experience of integrating payments was the product. The lesson that keeps landing: the interface is the product. How something is used is as important as what it does.',
    'Stripe''s early bet was on making the developer experience so good that the first integration would take 7 lines of code. Everyone else at the time thought payments were a commodity — Stripe bet that the experience of integrating payments was the product. The lesson that keeps landing: the interface is the product. How something is used is as important as what it does.',
    'done', 'groq', 'en');

  INSERT INTO transcripts (entry_id, raw_text, edited_text, status, provider, language)
  VALUES (e10,
    'Took a long walk after the deadline. The city looks different at 5pm on a Thursday when you are not in a hurry. I have been inside too much this month. Note to self: the work does not get better when you grind harder into it. The walk produced two ideas that the all-nighter did not.',
    'Took a long walk after the deadline. The city looks different at 5pm on a Thursday when you are not in a hurry. I have been inside too much this month. Note to self: the work does not get better when you grind harder into it. The walk produced two ideas that the all-nighter did not.',
    'done', 'groq', 'en');

  INSERT INTO transcripts (entry_id, raw_text, edited_text, status, provider, language)
  VALUES (e11,
    'Q3 goals review. Goal 1: Ship search — done. Goal 2: Reduce load time under 2 seconds — partially done, at 2.4 seconds. Goal 3: Reach 500 active users — not there yet, at 312. The load time one is frustrating because I know exactly what is causing it but it keeps getting deprioritised. Setting a hard decision: next sprint, load time fix is the only thing.',
    'Q3 goals review. Goal 1: Ship search — done. Goal 2: Reduce load time under 2 seconds — partially done, at 2.4 seconds. Goal 3: Reach 500 active users — not there yet, at 312. The load time one is frustrating because I know exactly what is causing it but it keeps getting deprioritised. Setting a hard decision: next sprint, load time fix is the only thing.',
    'done', 'groq', 'en');

  INSERT INTO transcripts (entry_id, raw_text, edited_text, status, provider, language)
  VALUES (e12,
    'Quick capture has to be frictionless. The moment you add a login step or a what-category-is-this prompt, you lose the thought. The replay experience matters too — re-reading old entries should feel like meeting a younger version of yourself, not filing a report. Summaries help because raw voice notes are hard to read back. And the data has to feel private — not private like a legal statement, private like a diary.',
    'Quick capture has to be frictionless. The moment you add a login step or a what-category-is-this prompt, you lose the thought. The replay experience matters too — re-reading old entries should feel like meeting a younger version of yourself, not filing a report. Summaries help because raw voice notes are hard to read back. And the data has to feel private — not private like a legal statement, private like a diary.',
    'done', 'groq', 'en');

  -- ── 4. Summaries ─────────────────────────────────────────────────────────

  INSERT INTO summaries (entry_id, summary_text, prompt_version, provider)
  VALUES (e1, 'A clarifying run reframed the Q3 pitch around one customer story. Next up: share the updated deck and lock in Thursday''s rehearsal.', 'v3', 'openrouter');

  INSERT INTO summaries (entry_id, summary_text, prompt_version, provider)
  VALUES (e2, 'A productive week on the product side, with the search feature shipped and backlog cleared. The main thing to fix next week is protecting morning focus time from meetings.', 'v3', 'openrouter');

  INSERT INTO summaries (entry_id, summary_text, prompt_version, provider)
  VALUES (e3, 'An energising conversation about early-stage focus. The key takeaway: choose one north-star metric and guard it ruthlessly — everything else is noise until it moves.', 'v3', 'openrouter');

  INSERT INTO summaries (entry_id, summary_text, prompt_version, provider)
  VALUES (e4, 'Core insight: most decisions are post-hoc rationalisations of System 1 instincts. Anchoring bias is the most immediately applicable finding — write your reasoning down before seeing any numbers.', 'v3', 'openrouter');

  INSERT INTO summaries (entry_id, summary_text, prompt_version, provider)
  VALUES (e5, 'Morning time-blocking worked well for the refactor. The lesson: communicate the new schedule to the team so meetings stop landing in focus blocks.', 'v3', 'openrouter');

  INSERT INTO summaries (entry_id, summary_text, prompt_version, provider)
  VALUES (e6, 'An idea for proactive memory surfacing: the app noticing when a current theme echoes something from a year ago. Cold-start is the main constraint to solve first before building the notification layer.', 'v3', 'openrouter');

  INSERT INTO summaries (entry_id, summary_text, prompt_version, provider)
  VALUES (e7, 'The friction-mapping session was the most valuable part of the offsite. Next time, anchor vision discussions in real constraints from day one rather than starting with abstract futures.', 'v3', 'openrouter');

  INSERT INTO summaries (entry_id, summary_text, prompt_version, provider)
  VALUES (e8, 'A difficult day resolved by reducing to a single concrete action. The pattern: overwhelm comes from open loops, not from total workload. Closing one thing is enough to break the spiral.', 'v3', 'openrouter');

  INSERT INTO summaries (entry_id, summary_text, prompt_version, provider)
  VALUES (e9, 'Stripe''s insight: the integration experience is the product, not the payment rails. The interface is the product — how something is used matters as much as what it does.', 'v3', 'openrouter');

  INSERT INTO summaries (entry_id, summary_text, prompt_version, provider)
  VALUES (e10, 'Rest and movement produced better ideas than grinding. A reminder to build walks into the schedule as work, not as a reward for finishing.', 'v3', 'openrouter');

  INSERT INTO summaries (entry_id, summary_text, prompt_version, provider)
  VALUES (e11, 'Two out of three Q3 goals are progressing. Load time is the one clear bottleneck. Decision: treat the fix as non-negotiable for the next sprint and protect it from reprioritisation.', 'v3', 'openrouter');

  INSERT INTO summaries (entry_id, summary_text, prompt_version, provider)
  VALUES (e12, 'Three pillars for a great journal app: frictionless capture, meaningful replay, and felt privacy. All three have to work together — excelling at one while failing another breaks the whole experience.', 'v3', 'openrouter');

  -- ── 5. Tasks ─────────────────────────────────────────────────────────────

  INSERT INTO entry_tasks (entry_id, text, is_done) VALUES
    (e1, 'Send Maya the updated deck', true),
    (e1, 'Book the room for Thursday', true),
    (e1, 'Rehearse the customer story', false);

  INSERT INTO entry_tasks (entry_id, text, is_done) VALUES
    (e2, 'Block 9–12 for deep work every weekday', false),
    (e2, 'Cap the status meeting at 30 minutes', false);

  INSERT INTO entry_tasks (entry_id, text, is_done) VALUES
    (e4, 'Use the pre-mortem technique on the next big decision', false);

  INSERT INTO entry_tasks (entry_id, text, is_done) VALUES
    (e5, 'Update the shared calendar with focus blocks', true),
    (e5, 'Tell the team about the new morning schedule', false);

  INSERT INTO entry_tasks (entry_id, text, is_done) VALUES
    (e6, 'Sketch the notification UX for memory surfacing', false),
    (e6, 'Research minimum data threshold for reliable embedding retrieval', false);

  INSERT INTO entry_tasks (entry_id, text, is_done) VALUES
    (e7, 'Write up the top three bets from the offsite', true),
    (e7, 'Share the friction map with the wider team', false);

  INSERT INTO entry_tasks (entry_id, text, is_done) VALUES
    (e9, 'Review our own onboarding integration experience end-to-end', false);

  INSERT INTO entry_tasks (entry_id, text, is_done) VALUES
    (e11, 'Fix the Storage call waterfall causing the 2.4s load time', true),
    (e11, 'Protect next sprint from any non-load-time work', false);

  INSERT INTO entry_tasks (entry_id, text, is_done) VALUES
    (e12, 'Audit the current capture flow for friction points', false);

  RAISE NOTICE 'Seed complete for user %', v_uid;
END $$;
