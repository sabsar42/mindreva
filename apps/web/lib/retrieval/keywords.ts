/**
 * Turning a chat question into keyword-search input. Pure, unit-tested in
 * keywords.test.ts.
 *
 * - phrases: text in quotes, and runs of Capitalised words (names, places)
 *   that aren't just the first word of the sentence. Matched literally.
 * - terms: the remaining content words, lowercased, stop words removed,
 *   OR'd in full-text search so the question needn't contain every word.
 *
 * Words include combining marks (\p{M}): Bangla and Urdu vowel signs are
 * marks, not letters, and Postgres's 'simple' parser keeps them inside the
 * word — so must we, or "নদীর" would be cut into fragments.
 */

// English function words only: Bangla/Urdu questions keep all their words,
// which the 'simple' text-search config also leaves unstemmed.
const STOP_WORDS = new Set(
  `a about above after again all am an and any are as at be because been
  before being below between both but by can could did do does doing down
  during each few for from further had has have having he her here hers him
  his how i if in into is it its itself just me more most my myself no nor
  not now of off on once only or other our ours out over own same she should
  so some such than that the their theirs them then there these they this
  those through to too under until up very was we were what when where which
  while who whom why will with would you your yours yourself last next ever
  tell remember write wrote written say said think thought feel felt anything
  something everything thing things time times day days week weeks month
  months year years today yesterday`.split(/\s+/),
);

// Question openers that are capitalised only because they start a sentence.
const NOT_NAMES = new Set(
  `What When Where Who Whom Why How Which Did Do Does Was Were Is Are Am Have
  Has Had Can Could Would Should Will Tell Remind Show Give I I'm I've I'd
  The A An My In On At Last This That`.split(/\s+/),
);

const MAX_TERMS = 12;
const MAX_PHRASES = 6;

export interface KeywordQuery {
  terms: string[];
  phrases: string[];
}

function quotedPhrases(question: string): string[] {
  const out: string[] = [];
  // Double quotes, straight or curly.
  for (const m of question.matchAll(/["“]([^"“”]{2,80})["”]/gu)) {
    out.push(m[1]!.trim());
  }
  // Single quotes only when they wrap a phrase at word boundaries, so the
  // apostrophes in I'm or Priya's are never read as quotes.
  for (const m of question.matchAll(
    /(?:^|\s)['‘]([^'‘’]{2,80})['’](?=$|[\s?.!,;:])/gu,
  )) {
    out.push(m[1]!.trim());
  }
  return out.filter(Boolean);
}

function capitalisedRuns(question: string): string[] {
  const words = question.split(/\s+/).filter(Boolean);
  const runs: string[] = [];
  let run: { word: string; atSentenceStart: boolean }[] = [];
  const flush = () => {
    // A lone capitalised word at the start of a sentence is probably only
    // capitalised for that reason; it is still searched as a plain term.
    if (run.length > 1 || (run.length === 1 && !run[0]!.atSentenceStart)) {
      runs.push(run.map((r) => r.word).join(" "));
    }
    run = [];
  };
  words.forEach((raw, i) => {
    const word = raw
      .replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}']+$/gu, "")
      .replace(/'s$/u, "");
    const isCap = /^\p{Lu}[\p{L}\p{M}\p{N}'-]+$/u.test(word);
    const atSentenceStart = i === 0 || /[.!?]$/.test(words[i - 1]!);
    if (isCap && !NOT_NAMES.has(word)) {
      run.push({ word, atSentenceStart: atSentenceStart && run.length === 0 });
    } else {
      flush();
    }
    if (/[,.!?;:]$/.test(raw)) flush();
  });
  flush();
  return runs;
}

export function extractKeywordQuery(question: string): KeywordQuery {
  const phrases = [
    ...new Set([...quotedPhrases(question), ...capitalisedRuns(question)]),
  ].slice(0, MAX_PHRASES);

  const terms: string[] = [];
  for (const m of question.toLowerCase().matchAll(/[\p{L}\p{M}\p{N}]+/gu)) {
    const t = m[0];
    if (t.length < 2 || STOP_WORDS.has(t) || terms.includes(t)) continue;
    terms.push(t);
    if (terms.length >= MAX_TERMS) break;
  }
  return { terms, phrases };
}

/**
 * Which query terms a chunk actually contains, using the same rule as the
 * SQL (prefix match for terms of 4+ letters, whole word otherwise). Used to
 * decide whether a keyword hit is real evidence or one stray common word.
 */
export function matchedTerms(content: string, terms: string[]): string[] {
  const words = content.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  return terms.filter((t) =>
    words.some((w) => (t.length >= 4 ? w.startsWith(t) : w === t)),
  );
}
