// builder/lib/build-index.mjs — assemble a self-describing v1 index from a
// directory of GitHub-wiki Markdown files.
//
// Deterministic by construction: pages sorted by filename, sections in document
// order, sequential ids, no timestamps — so a CI `git diff --exit-code` can gate
// a stale committed index.

import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {splitSections, decodeEntities} from './markdown.mjs';
import {createSlugger} from './slug.mjs';

// GitHub stores page "Foo Bar" as Foo-Bar.md and special pages (_Sidebar,
// _Footer, …) start with an underscore — those are chrome, not content.
const isContentPage = name => name.endsWith('.md') && !name.startsWith('_');

// Entity-decoded so a title carrying e.g. &amp; displays the glyph, matching
// splitSections' headings (see decodeEntities).
const firstH1 = md => {
  const m = /^#\s+(.+?)\s*#*\s*$/m.exec(md);
  return m ? decodeEntities(m[1]).trim() : null;
};

export const buildIndex = async ({wikiDir, urlTemplate, siteName, fragments = true}) => {
  const files = (await readdir(wikiDir)).filter(isContentPage).sort();
  const docs = [];
  let id = 0;

  for (const file of files) {
    const page = file.slice(0, -3); // URL segment: Foo-Bar.md → {page}=Foo-Bar → /wiki/Foo-Bar
    const md = await readFile(join(wikiDir, file), 'utf8');
    const title = firstH1(md) || page.replace(/-/g, ' ');
    const slug = createSlugger();
    for (const sec of splitSections(md)) {
      docs.push({
        id: id++,
        page,
        title,
        heading: sec.heading ?? title,
        anchor: sec.heading ? slug(sec.heading) : '', // preamble → page top (no anchor)
        text: sec.text || sec.heading || title
      });
    }
  }

  return {v: 1, site: {name: siteName, urlTemplate, fragments}, docs};
};
