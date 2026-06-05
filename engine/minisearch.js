// engine/minisearch.js — the app's search engine, backed by vendored MiniSearch
// (engine/vendor/minisearch.mjs). Same { buildIndex, query, ENGINE_NAME }
// interface as engine/search.js, which stays as a zero-dependency fallback.
//
// Chosen over the hand-rolled ranker by the S3 A/B (spikes/s3/NOTES.md) for
// clearly better relevance on conceptual, multi-word queries.

import MiniSearch from './vendor/minisearch.mjs';

export const ENGINE_NAME = 'minisearch';

export const buildIndex = docs => {
  const ms = new MiniSearch({
    fields: ['title', 'heading', 'text'],                        // searched
    storeFields: ['page', 'title', 'heading', 'anchor', 'text'], // returned
    searchOptions: { boost: { title: 3, heading: 2 }, prefix: true, fuzzy: 0.2 },
  });
  ms.addAll(docs);
  return ms;
};

export const query = (ms, q, { limit = 20 } = {}) =>
  ms.search(q).slice(0, limit).map(h => {
    const text = h.text || '';
    const phrase = pickPhrase(text, q);
    return {
      doc: { id: h.id, page: h.page, title: h.title, heading: h.heading, anchor: h.anchor, text },
      score: h.score,
      phrase,
      snippet: snippetAround(text, phrase),
    };
  });

// Exact substring of the section text for a :~:text= highlight — the whole query
// if it appears verbatim, else the longest query word that does.
const pickPhrase = (text, q) => {
  const hay = text.toLowerCase();
  const whole = q.trim().toLowerCase();
  if (whole && hay.includes(whole)) {
    const at = hay.indexOf(whole);
    return text.slice(at, at + whole.length);
  }
  const words = [...new Set(q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1))]
    .sort((a, b) => b.length - a.length);
  for (const w of words) {
    const i = hay.indexOf(w);
    if (i >= 0) return text.slice(i, i + w.length);
  }
  return null;
};

// A short display window around the matched phrase (mirrors engine/search.js).
const snippetAround = (text, phrase) => {
  if (!phrase) return text.slice(0, 160);
  const at = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (at < 0) return text.slice(0, 160);
  const start = Math.max(0, at - 60);
  const end = Math.min(text.length, at + phrase.length + 100);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
};
