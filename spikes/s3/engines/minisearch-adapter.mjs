// spikes/s3/engines/minisearch-adapter.mjs — wraps vendored MiniSearch in the
// engine interface ({ buildIndex, query, ENGINE_NAME }) so the A/B harness can
// drive it interchangeably with engine/search.js.
//
// Eval-only: MiniSearch is NOT a dependency of the shipped app. Adopting it
// would mean bundling/vendoring it into the static app — a separate decision the
// A/B informs (see ../NOTES.md).

import MiniSearch from '../vendor/minisearch.mjs';

export const ENGINE_NAME = 'minisearch';

export const buildIndex = docs => {
  const ms = new MiniSearch({
    fields: ['title', 'heading', 'text'],                          // searched
    storeFields: ['page', 'title', 'heading', 'anchor', 'text'],   // returned
    searchOptions: { boost: { title: 3, heading: 2 }, prefix: true, fuzzy: 0.2 },
  });
  ms.addAll(docs);
  return ms;
};

export const query = (ms, q, { limit = 20 } = {}) =>
  ms.search(q).slice(0, limit).map(h => ({
    doc: { id: h.id, page: h.page, title: h.title, heading: h.heading, anchor: h.anchor, text: h.text },
    score: h.score,
    phrase: pickPhrase(h.text || '', q),
    snippet: null,
  }));

// Pick an exact substring of the section text for a :~:text= highlight — the
// whole query if present, else the longest query word that appears verbatim.
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
