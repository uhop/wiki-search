// engine/search.js — minimal, dependency-free ranked search for the S1 spike.
//
// The interface is deliberately tiny so a real engine (MiniSearch / Orama) can
// replace it wholesale at S3/Phase 1 without the app caring:
//
//     buildIndex(docs)            -> handle
//     query(handle, q, {limit})   -> [{ doc, score, phrase, snippet }]
//     ENGINE_NAME                  -> string (shown in the status line)
//
// `doc` is one entry from index.docs: { id, page, title, heading, anchor, text }.
// `phrase` is an exact substring of doc.text suitable for a `:~:text=` directive
// (or null). `snippet` is a short display window around the match.

export const ENGINE_NAME = 'spike/hand-rolled';

const WORD = /[^\p{L}\p{N}]+/u;

// Tiny stoplist — enough to keep one-letter/glue tokens from dominating the
// spike's tiny corpus. Not load-bearing; a real engine brings its own.
const STOP = new Set('a an and are as at be by for from in is of on or the to with'.split(' '));

function tokenize(s) {
  return String(s || '')
    .toLowerCase()
    .split(WORD)
    .filter(t => t.length > 1 && !STOP.has(t));
}

// Field weights: a hit in the title beats a hit in a heading beats body text.
const FIELD_WEIGHT = { title: 4, heading: 3, text: 1 };

export function buildIndex(docs) {
  const entries = docs.map(doc => {
    // Accumulate a term -> weight map across the doc's weighted fields.
    const weights = new Map();
    for (const [field, w] of Object.entries(FIELD_WEIGHT)) {
      for (const term of tokenize(doc[field])) {
        weights.set(term, (weights.get(term) || 0) + w);
      }
    }
    return { doc, weights };
  });
  return { entries };
}

export function query(handle, q, { limit = 20 } = {}) {
  const terms = tokenize(q);
  if (!terms.length) return [];
  const uniq = [...new Set(terms)];

  const scored = [];
  for (const entry of handle.entries) {
    let score = 0;
    let matched = 0;
    for (const term of uniq) {
      const w = entry.weights.get(term) || 0;
      if (w > 0) { score += w; ++matched; }
    }
    if (!score) continue;
    // AND-bonus: reward docs that cover every query term.
    if (matched === uniq.length && uniq.length > 1) score *= 1.5;
    const { phrase, snippet } = locate(entry.doc.text || '', q, uniq);
    scored.push({ doc: entry.doc, score, phrase, snippet });
  }

  scored.sort((a, b) => b.score - a.score || a.doc.id - b.doc.id);
  return scored.slice(0, limit);
}

// Find an exact substring of `text` to drive the text-fragment highlight, and a
// short display snippet around it. Prefers the whole query phrase if it appears
// verbatim; otherwise the longest single query term that does.
function locate(text, rawQuery, terms) {
  const hay = text.toLowerCase();
  const whole = rawQuery.trim().toLowerCase();

  let at = whole ? hay.indexOf(whole) : -1;
  let len = whole.length;

  if (at < 0) {
    for (const term of [...terms].sort((a, b) => b.length - a.length)) {
      const i = hay.indexOf(term);
      if (i >= 0) { at = i; len = term.length; break; }
    }
  }

  if (at < 0) return { phrase: null, snippet: text.slice(0, 160) };

  const phrase = text.slice(at, at + len); // exact-cased, as it appears on the page
  const start = Math.max(0, at - 60);
  const end = Math.min(text.length, at + len + 100);
  const snippet = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
  return { phrase, snippet };
}
