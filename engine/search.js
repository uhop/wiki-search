// engine/search.js — minimal, dependency-free ranked search. Kept as the
// zero-dependency fallback / reference; the app uses engine/minisearch.js by
// default (chosen by the S3 A/B).
//
// The interface is deliberately tiny so engines are interchangeable:
//
//     buildIndex(docs)            -> handle
//     query(handle, q, {limit})   -> [{ doc, score, phrase, snippet }]
//     ENGINE_NAME                  -> string (shown in the status line)
//
// `doc` is one entry from index.docs: { id, page, title, heading, anchor, text }.
// Phrase + snippet come from the shared engine/phrase.js, so links and highlights
// match the MiniSearch engine.

import { pickPhrase, snippetAround } from './phrase.js';

export const ENGINE_NAME = 'spike/hand-rolled';

const WORD = /[^\p{L}\p{N}]+/u;

// Tiny stoplist — enough to keep one-letter/glue tokens from dominating the
// spike's tiny corpus. Not load-bearing; a real engine brings its own.
const STOP = new Set('a an and are as at be by for from in is of on or the to with'.split(' '));

const tokenize = s =>
  String(s || '')
    .toLowerCase()
    .split(WORD)
    .filter(t => t.length > 1 && !STOP.has(t));

// Field weights: a hit in the title beats a hit in a heading beats body text.
const FIELD_WEIGHT = { title: 4, heading: 3, text: 1 };

export const buildIndex = docs => {
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
};

export const query = (handle, q, { limit = 20 } = {}) => {
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
    const { doc } = entry;
    const phrase = pickPhrase(doc.text || '', q, doc.heading || '');
    scored.push({ doc, score, phrase, snippet: snippetAround(doc.text || '', phrase) });
  }

  scored.sort((a, b) => b.score - a.score || a.doc.id - b.doc.id);
  return scored.slice(0, limit);
};
