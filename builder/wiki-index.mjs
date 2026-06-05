#!/usr/bin/env node
// builder/wiki-index.mjs — CLI: GitHub-wiki Markdown → self-describing v1 index.
//
//   node builder/wiki-index.mjs [--wiki ./wiki] [--out <path>]
//        [--url-template <tpl>] [--name "<site name>"]
//        [--repo owner/repo] [--stdout]
//
// With neither --url-template nor --repo, it infers owner/repo from the wiki
// dir's git origin (…/<owner>/<repo>.wiki.git) and builds the GitHub template.
// Default --out is <wiki>/search-index.json (the index is hosted from the wiki).

import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildIndex } from './lib/build-index.mjs';

const run = promisify(execFile);

const BOOLEAN_FLAGS = new Set(['stdout']);

// Accept both --key=value and --key value; flags in BOOLEAN_FLAGS (and a --key
// followed by another --flag or nothing) are valueless booleans.
const parseArgs = argv => {
  const args = {};
  for (let i = 0; i < argv.length; ++i) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(argv[i]);
    if (!m) continue;
    const key = m[1];
    if (m[2] !== undefined) { args[key] = m[2]; continue; }
    const next = argv[i + 1];
    if (!BOOLEAN_FLAGS.has(key) && next !== undefined && !next.startsWith('--')) args[key] = argv[++i];
    else args[key] = true;
  }
  return args;
};

// owner/repo from the wiki clone's origin, tolerating the …/.wiki.git suffix.
const inferRepo = async wikiDir => {
  try {
    const { stdout } = await run('git', ['-C', wikiDir, 'remote', 'get-url', 'origin']);
    const m = /[/:]([^/]+)\/([^/]+?)(?:\.wiki)?\.git$/.exec(stdout.trim());
    return m ? `${m[1]}/${m[2]}` : null;
  } catch {
    return null;
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const wikiDir = resolve(args.wiki || './wiki');

  let repo = args.repo || null;
  if (!args['url-template'] && !repo) repo = await inferRepo(wikiDir);

  const urlTemplate = args['url-template'] || (repo && `https://github.com/${repo}/wiki/{page}`);
  if (!urlTemplate) {
    console.error('wiki-index: need --url-template or --repo owner/repo (could not infer from git origin).');
    process.exit(2);
  }
  const siteName = args.name || (repo ? `${repo.split('/')[1]} wiki` : 'wiki');

  const index = await buildIndex({ wikiDir, urlTemplate, siteName });
  const json = JSON.stringify(index, null, 2) + '\n';

  if (args.stdout) { process.stdout.write(json); return; }

  const out = resolve(args.out || join(wikiDir, 'search-index.json'));
  await writeFile(out, json);
  const pages = new Set(index.docs.map(d => d.page)).size;
  console.error(`wiki-index: ${index.docs.length} sections from ${pages} page(s) → ${out}`);
  console.error(`            site "${siteName}" · ${urlTemplate}`);
};

main();
