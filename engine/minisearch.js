// engine/minisearch.js — the app's search engine, backed by vendored MiniSearch
// (engine/vendor/minisearch.mjs). Same { buildIndex, query, ENGINE_NAME }
// interface as engine/search.js, which stays as a zero-dependency fallback.
//
// Chosen over the hand-rolled ranker by the S3 A/B (spikes/s3/NOTES.md) for
// clearly better relevance on conceptual, multi-word queries. Phrase + snippet
// come from the shared engine/phrase.js.

import MiniSearch from './vendor/minisearch.mjs';
import { pickPhrase, snippetAround } from './phrase.js';

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
    const phrase = pickPhrase(text, q, h.heading);
    return {
      doc: { id: h.id, page: h.page, title: h.title, heading: h.heading, anchor: h.anchor, text },
      score: h.score,
      phrase,
      snippet: snippetAround(text, phrase),
    };
  });
