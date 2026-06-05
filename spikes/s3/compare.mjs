#!/usr/bin/env node
// spikes/s3/compare.mjs — S3 engine A/B: the hand-rolled engine vs MiniSearch
// over the wiki index, side by side, so relevance can be judged. GitHub's native
// wiki search is a manual column (see NOTES.md) — it can't be driven headlessly.
//
//   node spikes/s3/compare.mjs [--index <path>] [--live] [--limit N] ["query one" "query two" …]
//
// Default index: ./wiki/search-index.json. With queries omitted, a built-in set
// of realistic questions runs.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import * as handRolled from '../../engine/search.js';
import * as miniSearch from './engines/minisearch-adapter.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const LIVE_URL = 'https://raw.githubusercontent.com/wiki/uhop/wiki-search/search-index.json';

const DEFAULT_QUERIES = [
  'why not pagefind',
  'self describing index',
  'text fragment highlight same tab',
  'keep wiki open instead of migrating to pages',
  'how does the bookmarklet avoid csp',
  'deterministic builder staleness gate',
  'github anchor slug',
  'verify or explain validation',
];

const parse = argv => {
  const args = { queries: [] };
  for (let i = 0; i < argv.length; ++i) {
    const a = argv[i];
    if (a === '--live') args.live = true;
    else if (a === '--index') args.index = argv[++i];
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else args.queries.push(a);
  }
  return args;
};

const loadIndex = async args => {
  if (args.index) return JSON.parse(await readFile(resolve(args.index), 'utf8'));
  if (args.live) {
    const res = await fetch(LIVE_URL);
    if (!res.ok) throw new Error(`live index fetch failed: HTTP ${res.status}`);
    return res.json();
  }
  return JSON.parse(await readFile(join(here, '../../wiki/search-index.json'), 'utf8'));
};

const W = 44;
const cell = s => (s.length > W ? s.slice(0, W - 1) + '…' : s).padEnd(W);

const main = async () => {
  const args = parse(process.argv.slice(2));
  const limit = args.limit || 3;
  const queries = args.queries.length ? args.queries : DEFAULT_QUERIES;
  const index = await loadIndex(args);

  const engines = [handRolled, miniSearch];
  const handles = engines.map(e => e.buildIndex(index.docs));
  const pages = new Set(index.docs.map(d => d.page)).size;

  console.log(`A/B over "${index.site.name}" — ${index.docs.length} sections, ${pages} pages, top ${limit}\n`);

  let agree = 0;
  for (const q of queries) {
    const cols = engines.map((e, i) =>
      e.query(handles[i], q, { limit }).map(r => `${r.doc.page} › ${r.doc.heading}`));
    if (cols[0][0] && cols[0][0] === cols[1][0]) ++agree;

    console.log(`▸ "${q}"`);
    console.log('  ' + engines.map(e => cell(e.ENGINE_NAME)).join(' '));
    for (let r = 0; r < limit; ++r) {
      console.log('  ' + cols.map(c => cell(c[r] ? `${r + 1}. ${c[r]}` : '·')).join(' '));
    }
    console.log('');
  }

  console.log(`top-hit agreement: ${agree}/${queries.length}`);
};

main();
