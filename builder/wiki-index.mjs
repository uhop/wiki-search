#!/usr/bin/env node
// builder/wiki-index.mjs — CLI: GitHub-wiki Markdown → self-describing v1 index.
//
//   node builder/wiki-index.mjs [--wiki ./wiki] [--out <path>]
//        [--url-template <tpl>] [--name "<site name>"]
//        [--repo owner/repo] [--file <path>]... [--branch <name>] [--stdout]
//
// With neither --url-template nor --repo, it infers owner/repo from the wiki
// dir's git origin (…/<owner>/<repo>.wiki.git) and builds the GitHub template.
// --file folds a repo file (e.g. README.md) into the index alongside the wiki
// pages; its result link is a relative {page} (../blob/<branch>/<path>) the
// browser resolves against the wiki URL. --branch sets the blob branch (default:
// the repo's default branch, inferred from git). Default --out is
// <wiki>/search-index.json (the index is hosted from the wiki).

import {writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {basename, join, resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {buildIndex, relativeFilePage} from './lib/build-index.mjs';

const run = promisify(execFile);

const BOOLEAN_FLAGS = new Set(['stdout']);
// Flags that may be repeated to build a list (e.g. --file a.md --file b.md).
const MULTI_FLAGS = new Set(['file']);

// Accept both --key=value and --key value; flags in BOOLEAN_FLAGS (and a --key
// followed by another --flag or nothing) are valueless booleans. Keys in
// MULTI_FLAGS accumulate into an array across repeats.
const parseArgs = argv => {
  const args = {};
  const set = (k, v) => {
    if (MULTI_FLAGS.has(k)) (args[k] ??= []).push(v);
    else args[k] = v;
  };
  for (let i = 0; i < argv.length; ++i) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(argv[i]);
    if (!m) continue;
    const key = m[1];
    if (m[2] !== undefined) {
      set(key, m[2]);
      continue;
    }
    const next = argv[i + 1];
    if (!BOOLEAN_FLAGS.has(key) && next !== undefined && !next.startsWith('--'))
      set(key, argv[++i]);
    else args[key] = true;
  }
  return args;
};

// owner/repo from the wiki clone's origin, tolerating the …/.wiki.git suffix.
const inferRepo = async wikiDir => {
  try {
    const {stdout} = await run('git', ['-C', wikiDir, 'remote', 'get-url', 'origin']);
    const m = /[/:]([^/]+)\/([^/]+?)(?:\.wiki)?\.git$/.exec(stdout.trim());
    return m ? `${m[1]}/${m[2]}` : null;
  } catch {
    return null;
  }
};

// Best-effort default branch for the repo the --file paths live in: prefer the
// remote's default branch, fall back to the current branch, then to main.
const inferBranch = async dir => {
  for (const gitArgs of [
    ['-C', dir, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'],
    ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD']
  ]) {
    try {
      const {stdout} = await run('git', gitArgs);
      const b = stdout.trim().replace(/^origin\//, '');
      if (b && b !== 'HEAD') return b;
    } catch {
      // try the next strategy
    }
  }
  return 'main';
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  // Wiki source: an explicit --wiki must exist; otherwise default to ./wiki when
  // it's present (a --file-only build needs no wiki dir).
  let wikiDir = null;
  if (args.wiki) {
    wikiDir = resolve(args.wiki);
    if (!existsSync(wikiDir)) {
      console.error(`wiki-index: --wiki dir not found: ${wikiDir}`);
      process.exit(2);
    }
  } else if (existsSync(resolve('./wiki'))) {
    wikiDir = resolve('./wiki');
  }

  const fileArgs = Array.isArray(args.file) ? args.file : [];
  if (!wikiDir && !fileArgs.length) {
    console.error('wiki-index: nothing to index — pass --wiki <dir> and/or --file <path>.');
    process.exit(2);
  }

  let repo = args.repo || null;
  if (!args['url-template'] && !repo && wikiDir) repo = await inferRepo(wikiDir);

  const urlTemplate = args['url-template'] || (repo && `https://github.com/${repo}/wiki/{page}`);
  if (!urlTemplate) {
    console.error(
      'wiki-index: need --url-template or --repo owner/repo (could not infer from git origin).'
    );
    process.exit(2);
  }

  // Resolve --file paths (relative to CWD) into folded-in docs with relative
  // {page} links; those only resolve correctly against the GitHub wiki layout.
  let files = [];
  if (fileArgs.length) {
    if (!urlTemplate.endsWith('/wiki/{page}')) {
      console.error(
        'wiki-index: warning — --file assumes the GitHub wiki URL layout (…/wiki/{page}); ' +
          'its relative links may be wrong with a custom --url-template.'
      );
    }
    const branch = args.branch || (await inferBranch('.'));
    files = fileArgs.map(f => ({
      absPath: resolve(f),
      page: relativeFilePage(f, branch),
      titleFallback: basename(f).replace(/\.md$/i, '')
    }));
    for (const f of files) {
      if (!existsSync(f.absPath)) {
        console.error(`wiki-index: --file not found: ${f.absPath}`);
        process.exit(2);
      }
    }
  }

  const siteName = args.name || (repo ? `${repo.split('/')[1]} wiki` : 'wiki');

  const index = await buildIndex({wikiDir, urlTemplate, siteName, files});
  const json = JSON.stringify(index, null, 2) + '\n';

  if (args.stdout) {
    process.stdout.write(json);
    return;
  }

  const out = resolve(
    args.out || (wikiDir ? join(wikiDir, 'search-index.json') : './search-index.json')
  );
  await writeFile(out, json);
  const pages = new Set(index.docs.map(d => d.page)).size;
  console.error(`wiki-index: ${index.docs.length} sections from ${pages} page(s) → ${out}`);
  console.error(`            site "${siteName}" · ${urlTemplate}`);
};

main();
