#!/usr/bin/env node
// builder/test/run.mjs — assertions for the Phase-1 builder over fixture pages.
// Run: node builder/test/run.mjs

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildIndex } from '../lib/build-index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const opts = { wikiDir: join(here, 'fixtures'), urlTemplate: 'https://example.test/wiki/{page}', siteName: 'test' };

const index = await buildIndex(opts);
const byPage = index.docs.reduce((m, d) => ((m[d.page] ??= []).push(d), m), {});

assert.equal(index.v, 1, 'format version');
assert.deepEqual(Object.keys(byPage).sort(), ['Filters', 'Parser'], 'both content pages indexed');

// Page title comes from the first H1.
assert.equal(byPage.Parser[0].title, 'Parser');

// Text above any heading indexes against the page top (empty anchor).
const preamble = byPage.Parser.find(d => d.anchor === '');
assert.ok(preamble && /page top/i.test(preamble.text), 'preamble section present');

// An H1 becomes its own section/anchor; the intro under it lives there.
assert.ok(byPage.Parser.some(d => d.anchor === 'parser' && /byte stream/i.test(d.text)), 'H1 → its own anchor');

// Duplicate "Options" heading disambiguates to options / options-1.
const anchors = byPage.Parser.map(d => d.anchor);
assert.ok(anchors.includes('options'), 'first Options → options');
assert.ok(anchors.includes('options-1'), 'second Options → options-1');

// `#` inside a code fence is NOT a heading (no stray section).
assert.ok(!anchors.includes('this'), 'code-fence # ignored');

// Punctuation drops from slugs: "Pick: by path" → pick-by-path.
assert.ok(byPage.Filters.some(d => d.anchor === 'pick-by-path'), 'colon dropped from slug');

// Plain text is stripped of markdown link syntax.
const pick = byPage.Filters.find(d => d.anchor === 'pick-by-path');
assert.ok(/\bfilter\b/.test(pick.text) && !/\]\(/.test(pick.text), 'link reduced to its text');

// Ids are sequential and the build is deterministic.
assert.deepEqual(index.docs.map(d => d.id), index.docs.map((_, i) => i), 'sequential ids');
const again = await buildIndex(opts);
assert.equal(JSON.stringify(index), JSON.stringify(again), 'deterministic output');

console.log(`ok — ${index.docs.length} sections, anchors: ${anchors.filter(Boolean).join(', ')} | ${byPage.Filters.map(d => d.anchor).filter(Boolean).join(', ')}`);
