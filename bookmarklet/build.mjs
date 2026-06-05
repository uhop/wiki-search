#!/usr/bin/env node
// bookmarklet/build.mjs — inline the app URL into stub.js and minify it into a
// drag-to-bookmarks `javascript:` URL. Dependency-free.
//
//   node bookmarklet/build.mjs [--app=<url>] [--out=<file>]
//
// Defaults to the local spike app so S1 is runnable with no arguments.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBookmarklet } from './build-core.js';

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }),
);

const appUrl = args.app || 'http://localhost:8080/app/';
const outFile = args.out || resolve(here, 'dist/bookmarklet.txt');

const src = await readFile(resolve(here, 'stub.js'), 'utf8');

const bookmarklet = buildBookmarklet(src, appUrl);

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, bookmarklet + '\n');

process.stdout.write(`app URL : ${appUrl}\n`);
process.stdout.write(`written : ${outFile} (${bookmarklet.length} chars)\n\n`);
process.stdout.write(bookmarklet + '\n');
