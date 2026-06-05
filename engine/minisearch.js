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
  let at = whole && hay.includes(whole) ? hay.indexOf(whole) : -1;
  let len = whole.length;
  if (at < 0) {
    const words = [...new Set(q.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1))]
      .sort((a, b) => b.length - a.length);
    for (const w of words) {
      const i = hay.indexOf(w);
      if (i >= 0) { at = i; len = w.length; break; }
    }
  }
  if (at < 0) return null;
  // A bare single-word match is ambiguous: a Text Fragment matches the FIRST
  // occurrence document-wide, which may be in another section. Widen short
  // matches to a few neighbouring words so the directive lands in THIS section.
  // The result stays a verbatim slice of the section text, so it still matches
  // the rendered page for prose.
  return len >= 12 ? text.slice(at, at + len) : widen(text, at, len);
};

// Grow [at, at+len) to include up to two preceding whole words (or following
// words when the match is at the start), capped to keep the highlight tight.
const widen = (text, at, len) => {
  let start = at;
  for (let n = 0; n < 2 && start > 0; ++n) {
    let s = start;
    while (s > 0 && /\s/.test(text[s - 1])) --s; // skip the gap
    while (s > 0 && /\S/.test(text[s - 1])) --s; // skip the word
    if (s === start) break;
    start = s;
  }
  let end = at + len;
  for (let n = 0; n < 2 && start === at && end < text.length; ++n) {
    let e = end;
    while (e < text.length && /\s/.test(text[e])) ++e;
    while (e < text.length && /\S/.test(text[e])) ++e;
    if (e === end) break;
    end = e;
  }
  return text.slice(start, end).trim();
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
