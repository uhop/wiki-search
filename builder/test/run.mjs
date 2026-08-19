#!/usr/bin/env node
// builder/test/run.mjs — assertions for the Phase-1 builder over fixture pages.
// Run: node builder/test/run.mjs

import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {cp, mkdtemp, readFile, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {buildIndex, relativeFilePage} from '../lib/build-index.mjs';
import {toPlainText, headingToText} from '../lib/markdown.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const opts = {
  wikiDir: join(here, 'fixtures'),
  urlTemplate: 'https://example.test/wiki/{page}',
  siteName: 'test'
};

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
assert.ok(
  byPage.Parser.some(d => d.anchor === 'parser' && /byte stream/i.test(d.text)),
  'H1 → its own anchor'
);

// Duplicate "Options" heading disambiguates to options / options-1.
const anchors = byPage.Parser.map(d => d.anchor);
assert.ok(anchors.includes('options'), 'first Options → options');
assert.ok(anchors.includes('options-1'), 'second Options → options-1');

// `#` inside a code fence is NOT a heading (no stray section).
assert.ok(!anchors.includes('this'), 'code-fence # ignored');

// Punctuation drops from slugs: "Pick: by path" → pick-by-path.
assert.ok(
  byPage.Filters.some(d => d.anchor === 'pick-by-path'),
  'colon dropped from slug'
);

// A removed char between spaces yields a double hyphen, matching github-slugger:
// "Replace — in place" → replace--in-place.
assert.ok(
  byPage.Filters.some(d => d.anchor === 'replace--in-place'),
  'em-dash → double hyphen'
);

// A heading written with the &mdash; ENTITY must slug like GitHub: the entity is
// decoded to — before slugging (verified live: GitHub emits #422--2026-05-29 for
// "## 4.2.2 &mdash; 2026-05-29"), not the junk slug 422-mdash-2026-05-29.
const entityHeading = byPage.Filters.find(d => d.anchor === '422--2026-05-29');
assert.ok(entityHeading, 'entity heading slugs like GitHub (422--2026-05-29)');
assert.ok(
  !byPage.Filters.some(d => d.anchor === '422-mdash-2026-05-29'),
  'entity name does not leak into the slug'
);
// The stored display heading is the decoded glyph, not the literal "&mdash;".
assert.equal(entityHeading.heading, '4.2.2 — 2026-05-29', 'heading display text is decoded');
assert.ok(!/&mdash;/.test(entityHeading.heading), 'no literal entity in heading text');

// Heading-level Markdown is reduced to the text GitHub slugs against. A LINK
// contributes only its text (the URL must not leak into the slug).
assert.equal(headingToText('See the [docs](https://x/y) page'), 'See the docs page');
assert.equal(headingToText('A [ref link][r] here'), 'A ref link here');
const docsLink = byPage.Filters.find(d => d.anchor === 'see-the-docs-page');
assert.ok(docsLink, 'link heading slugs from link text (see-the-docs-page)');
assert.equal(docsLink.heading, 'See the docs page', 'link heading display drops the URL');
assert.ok(
  !byPage.Filters.some(d => /shields|example\.test|https?/.test(d.anchor)),
  'no URL/href leaks into any Filters anchor'
);

// An IMAGE contributes no text (GitHub excludes it from the anchor); a badge —
// image-in-link — at the end of a heading leaves a trailing space that becomes an
// edge hyphen, matching GitHub (e.g. "node-re2 [![…]…]" → node-re2-). Verified
// live against uhop/node-re2's rendered README.
assert.equal(
  headingToText('Tool [![NPM version][i]][u]'),
  'Tool ',
  'badge dropped, trailing space kept'
);
assert.equal(
  headingToText('![logo](x) Title'),
  ' Title',
  'leading image dropped, leading space kept'
);
const badge = byPage.Filters.find(d => d.anchor === 'build-');
assert.ok(badge, 'badge-ending heading keeps the edge hyphen in the slug (build-)');
assert.equal(badge.heading, 'Build', 'badge heading display is trimmed (no trailing space)');

// Inline code, * / ~ emphasis, and bare [brackets] already slug correctly via
// slug.mjs, so the reducer leaves them (only unwraps inline code for a clean
// display); underscores must survive (snake_case is not emphasis).
assert.equal(headingToText('The `exec` method'), 'The exec method', 'inline code unwrapped');
assert.equal(
  headingToText('keep snake_case_name'),
  'keep snake_case_name',
  'underscores untouched'
);

// Plain text is stripped of markdown + wiki link syntax.
const pick = byPage.Filters.find(d => d.anchor === 'pick-by-path');
assert.ok(
  /\bfilter\b/.test(pick.text) && !/\]\(/.test(pick.text),
  'markdown link reduced to its text'
);
assert.ok(
  /\bParser\b/.test(pick.text) &&
    /\bthe parser options\b/.test(pick.text) &&
    !/\[\[/.test(pick.text),
  'wiki links reduced to display text'
);

// HTML entities are decoded so they don't survive as junk index terms. Typographic
// entities become punctuation the tokenizer discards; numeric entities decode
// generally (preserving genuine letters); unknown named entities drop to a space.
assert.equal(toPlainText('a &mdash; b'), 'a — b', 'named entity → glyph');
assert.equal(toPlainText('see &#128269; here'), 'see 🔍 here', 'decimal numeric entity decoded');
assert.equal(toPlainText('hex &#x1F50D; mark'), 'hex 🔍 mark', 'hex numeric entity decoded');
assert.equal(toPlainText('alpha &#945; kept'), 'alpha α kept', 'entity-encoded letter preserved');
assert.equal(toPlainText('a&amp;b'), 'a&b', 'amp decoded');
assert.equal(toPlainText('gone &nosuchthing; here'), 'gone here', 'unknown named entity dropped');
assert.ok(!/\bmdash\b/.test(toPlainText('x &mdash; y')), 'no "mdash" junk term');
assert.ok(!/128269/.test(toPlainText('x &#128269; y')), 'no numeric junk term');

// Ids are sequential and the build is deterministic.
assert.deepEqual(
  index.docs.map(d => d.id),
  index.docs.map((_, i) => i),
  'sequential ids'
);
const again = await buildIndex(opts);
assert.equal(JSON.stringify(index), JSON.stringify(again), 'deterministic output');

// --- Folding in non-wiki files (variant D): a relative {page} pointing out of
// the wiki, so a repo file like README.md can be indexed alongside the wiki.
assert.equal(
  relativeFilePage('README.md', 'main'),
  '../blob/main/README.md',
  'file → relative page'
);
assert.equal(
  relativeFilePage('./docs/Guide.md', 'dev'),
  '../blob/dev/docs/Guide.md',
  'subdir path, leading ./ stripped'
);

// Fold a fixture in as if it were the repo README (reuse Parser.md as the source).
const mixed = await buildIndex({
  ...opts,
  files: [
    {
      absPath: join(here, 'fixtures', 'Parser.md'),
      page: relativeFilePage('README.md', 'main'),
      titleFallback: 'README'
    }
  ]
});
const fileDocs = mixed.docs.filter(d => d.page === '../blob/main/README.md');
assert.ok(fileDocs.length > 0, 'folded file produces docs');
assert.equal(fileDocs[0].title, 'Parser', 'folded file title comes from its own H1');
assert.ok(
  fileDocs.some(d => d.anchor === 'parser'),
  'folded file anchors are computed'
);

// Folded docs come AFTER the wiki pages, and ids stay sequential across both.
assert.ok(
  mixed.docs.findIndex(d => d.page === '../blob/main/README.md') >
    mixed.docs.findIndex(d => d.page === 'Parser'),
  'folded files appended after wiki pages'
);
assert.deepEqual(
  mixed.docs.map(d => d.id),
  mixed.docs.map((_, i) => i),
  'sequential ids across wiki + files'
);

// Adding files must not perturb the wiki docs — the prefix is byte-identical, so
// the committed-index diff-gate on a wiki-only build still holds.
assert.equal(
  JSON.stringify(mixed.docs.slice(0, index.docs.length)),
  JSON.stringify(index.docs),
  'wiki docs unchanged when files are folded in'
);

// CLI surface: --help / --version / bad arguments must exit before the default
// action, which writes <cwd>/wiki/search-index.json. Run from a scratch cwd that
// HAS a wiki/ dir, so any fall-through would leave a file behind.
{
  const cli = join(here, '..', 'wiki-index.mjs');
  const cwd = await mkdtemp(join(tmpdir(), 'wiki-index-cli-'));
  await cp(join(here, 'fixtures'), join(cwd, 'wiki'), {recursive: true});
  const out = join(cwd, 'wiki', 'search-index.json');
  const invoke = argv =>
    promisify(execFile)(process.execPath, [cli, ...argv], {cwd}).then(
      r => ({code: 0, ...r}),
      e => ({code: e.code, stdout: e.stdout, stderr: e.stderr})
    );
  try {
    const pkgVersion = JSON.parse(
      await readFile(join(here, '..', '..', 'package.json'), 'utf8')
    ).version;

    let r = await invoke(['--version']);
    assert.equal(r.code, 0, '--version exits 0');
    assert.equal(r.stdout.trim(), pkgVersion, '--version prints package.json version');
    assert.ok(!existsSync(out), '--version writes nothing');

    r = await invoke(['--help']);
    assert.equal(r.code, 0, '--help exits 0');
    assert.match(r.stdout, /^Usage: wiki-search-index/, '--help prints usage');
    assert.ok(!existsSync(out), '--help writes nothing');

    r = await invoke(['--bogus']);
    assert.equal(r.code, 2, 'unknown flag exits 2');
    assert.match(r.stderr, /unrecognized argument: --bogus/, 'unknown flag is named');
    assert.match(r.stderr, /Usage: wiki-search-index/, 'unknown flag prints usage');
    assert.ok(!existsSync(out), 'unknown flag writes nothing');

    r = await invoke(['--wiki', 'wiki', 'stray']);
    assert.equal(r.code, 2, 'stray positional exits 2');
    assert.match(r.stderr, /unrecognized argument: stray/, 'stray positional is named');
    assert.ok(!existsSync(out), 'stray positional writes nothing');

    r = await invoke(['--version', 'x', '--wiki=nope']);
    assert.equal(r.code, 0, '--version/--help win over stray or bad arguments');
    assert.equal(r.stdout.trim(), pkgVersion, '--version does not consume a following token');

    r = await invoke(['--wiki', 'wiki', '--repo', 'o/r']);
    assert.equal(r.code, 0, 'a valid invocation still builds');
    assert.ok(existsSync(out), 'a valid invocation writes the index');
  } finally {
    await rm(cwd, {recursive: true, force: true});
  }
}

console.log(
  `ok — ${index.docs.length} sections, anchors: ${anchors.filter(Boolean).join(', ')} | ${byPage.Filters.map(
    d => d.anchor
  )
    .filter(Boolean)
    .join(', ')}`
);
