// builder/lib/build-index.mjs — assemble a self-describing v1 index from a
// directory of GitHub-wiki Markdown files.
//
// Deterministic by construction: pages sorted by filename, sections in document
// order, sequential ids, no timestamps — so a CI `git diff --exit-code` can gate
// a stale committed index.

import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {splitSections, decodeEntities, headingToText} from './markdown.mjs';
import {createSlugger} from './slug.mjs';

// GitHub stores page "Foo Bar" as Foo-Bar.md and special pages (_Sidebar,
// _Footer, …) start with an underscore — those are chrome, not content.
const isContentPage = name => name.endsWith('.md') && !name.startsWith('_');

// Entity-decoded so a title carrying e.g. &amp; displays the glyph, matching
// splitSections' headings (see decodeEntities).
const firstH1 = md => {
  const m = /^#\s+(.+?)\s*#*\s*$/m.exec(md);
  return m ? headingToText(decodeEntities(m[1])).trim() : null;
};

// A repo file folded into a wiki index points OUTSIDE the wiki via a relative
// {page}: from the canonical .../<owner>/<repo>/wiki/{page}, one `..` escapes
// /wiki/ back to the repo root, then /blob/<branch>/<path> reaches the rendered
// file. The client encodes each segment but keeps `/` and `..` literal, and the
// browser normalizes the dot-segment on navigation. Assumes the GitHub wiki URL
// layout (a custom --url-template would need a different relative prefix).
export const relativeFilePage = (repoPath, branch) =>
  `../blob/${branch}/${repoPath.replace(/^\.?\//, '')}`;

// Append one Markdown document's heading-delimited sections to `docs`, sharing
// the caller's sequential id counter. `page` is the {page} substitution — a wiki
// URL segment, or a relative path (relativeFilePage) for a folded-in file;
// `titleFallback` is used when the document has no H1.
const pushSections = (md, page, titleFallback, docs, nextId) => {
  const title = firstH1(md) || titleFallback;
  const slug = createSlugger();
  for (const sec of splitSections(md)) {
    // sec.heading is reduced but untrimmed: slug it verbatim (edge space → edge
    // hyphen, as GitHub does), but display/search use the trimmed copy.
    const heading = sec.heading?.trim() || title;
    docs.push({
      id: nextId(),
      page,
      title,
      heading,
      anchor: sec.heading ? slug(sec.heading) : '', // preamble → page top (no anchor)
      text: sec.text || heading
    });
  }
};

// `files` (optional) are pre-resolved folded-in documents: {absPath, page,
// titleFallback}. They are indexed after the wiki pages, in the given order.
export const buildIndex = async ({
  wikiDir,
  urlTemplate,
  siteName,
  fragments = true,
  files = []
}) => {
  const docs = [];
  let id = 0;
  const nextId = () => id++;

  // Wiki pages, sorted by filename (Foo-Bar.md → {page}=Foo-Bar → /wiki/Foo-Bar).
  if (wikiDir) {
    const names = (await readdir(wikiDir)).filter(isContentPage).sort();
    for (const name of names) {
      const page = name.slice(0, -3);
      const md = await readFile(join(wikiDir, name), 'utf8');
      pushSections(md, page, page.replace(/-/g, ' '), docs, nextId);
    }
  }

  // Named repo files folded in after the wiki pages, in the order given.
  for (const f of files) {
    const md = await readFile(f.absPath, 'utf8');
    pushSections(md, f.page, f.titleFallback ?? f.page, docs, nextId);
  }

  return {v: 1, site: {name: siteName, urlTemplate, fragments}, docs};
};
