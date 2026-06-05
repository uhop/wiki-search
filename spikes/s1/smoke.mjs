#!/usr/bin/env node
// spikes/s1/smoke.mjs — headless evidence for S1's search path.
//
// The engine is pure JS (no DOM), so we can exercise it outside the browser:
// load the sample index, build the engine index, run queries, and print the
// ranked hits plus the exact result URLs (with Text Fragment directives) that
// the app would emit. This proves the fetch→validate→search→link chain short
// of the browser-only window.open step (which S1's manual run covers).
//
//   node spikes/s1/smoke.mjs [query...]

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, query, ENGINE_NAME } from '../../engine/search.js';

const here = dirname(fileURLToPath(import.meta.url));
const index = JSON.parse(await readFile(resolve(here, 'sample-index.json'), 'utf8'));
const handle = buildIndex(index.docs);
const SITE = index.site;

// Mirror app.js resultUrl()/encodeTextDirective() so the printed URLs match.
const resultUrl = (doc, phrase) => {
  const base = SITE.urlTemplate.replace('{page}', encodeURIComponent(doc.page));
  const anchor = doc.anchor ? String(doc.anchor) : '';
  const textDir = SITE.fragments !== false && phrase
    ? `:~:text=${encodeURIComponent(phrase).replace(/-/g, '%2D')}` : '';
  return (!anchor && !textDir) ? base : `${base}#${anchor}${textDir}`;
};

const queries = process.argv.slice(2).length
  ? [process.argv.slice(2).join(' ')]
  : ['back-pressure large array', 'newline delimited json', 'redact sensitive fields', 'validate input'];

console.log(`engine: ${ENGINE_NAME} · ${index.docs.length} sections · ${SITE.name}\n`);
for (const q of queries) {
  console.log(`▸ "${q}"`);
  const hits = query(handle, q, { limit: 3 });
  if (!hits.length) { console.log('   (no matches)\n'); continue; }
  for (const { doc, score, phrase } of hits) {
    console.log(`   [${score.toFixed(1)}] ${doc.title} › ${doc.heading}`);
    console.log(`         ${resultUrl(doc, phrase)}`);
  }
  console.log('');
}
