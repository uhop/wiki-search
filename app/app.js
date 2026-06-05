// app/app.js — the popup search app for the S1 spike.
//
// Path P thesis (what S1 proves): when this page is opened via a bookmarklet's
// window.open() from a GitHub wiki page, it is a *new top-level browsing
// context on its own origin*, so the wiki page's CSP does not govern it. It can
// fetch an index (cross-origin under CORS, or same-origin) and run a search
// engine freely — none of which is possible inline on the CSP-locked wiki page.
//
// It loads a self-describing, versioned index, validates it (verify-or-explain
// — every failure produces a specific message, never a blank box), searches,
// and renders results as real <a> links carrying Text Fragment directives.

import { buildIndex, query, ENGINE_NAME } from '../engine/search.js';

const SUPPORTED_VERSIONS = [1];
const DEFAULT_WIKI_INDEX_FILE = 'search-index.json'; // convention used only by the ?wiki shortcut (open decision, S1)
const SPIKE_FALLBACK_INDEX = '../spikes/s1/sample-index.json';

const els = {
  q: document.getElementById('q'),
  status: document.getElementById('status'),
  results: document.getElementById('results'),
  engine: document.getElementById('engine'),
};

let SITE = null;
let HANDLE = null;

main();

async function main() {
  els.engine.textContent = ENGINE_NAME;
  const params = new URLSearchParams(location.search);

  const { url, note } = resolveIndexUrl(params);
  setStatus(note ? note + ' — loading index…' : 'Loading index…');

  let index;
  try {
    index = await loadIndex(url);
  } catch (err) {
    return fail(err.message);
  }

  SITE = index.site;
  HANDLE = buildIndex(index.docs);
  setStatus(`${SITE.name} · ${index.docs.length} sections indexed${note ? ' · ' + note : ''}`);

  els.q.addEventListener('input', debounce(run, 90));
  const initial = params.get('q');
  if (initial) { els.q.value = initial; run(); }
}

// Resolve which index to load, in priority order:
//   ?index=<url>            general — any JSON anywhere; its metadata says how to link.
//   ?wiki=<owner>/<repo>    GitHub convenience — derive the raw index URL.
//   (neither)               spike fallback: the bundled stream-json sample.
function resolveIndexUrl(params) {
  const index = params.get('index');
  if (index) return { url: index, note: null };

  const wiki = params.get('wiki');
  if (wiki) {
    const m = /^([^/]+)\/([^/]+)$/.exec(wiki.trim());
    if (!m) return { url: null, note: `bad ?wiki value "${wiki}" (want owner/repo)` };
    const file = params.get('file') || DEFAULT_WIKI_INDEX_FILE;
    return {
      url: `https://raw.githubusercontent.com/wiki/${m[1]}/${m[2]}/${file}`,
      note: null,
    };
  }

  return { url: SPIKE_FALLBACK_INDEX, note: 'spike: bundled sample index' };
}

// Fetch + validate. Each failure throws an Error with a specific, human message.
async function loadIndex(url) {
  if (!url) throw new Error('No index specified. Add ?index=<url> or ?wiki=<owner>/<repo> to the URL.');

  let res;
  try {
    res = await fetch(url, { mode: 'cors' });
  } catch (e) {
    throw new Error(`Couldn't load the index at\n${url}\nNetwork error (offline, blocked, or no CORS header).`);
  }
  if (!res.ok) throw new Error(`Couldn't load the index at\n${url}\nServer returned ${res.status} ${res.statusText}.`);

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(`The index at\n${url}\nisn't valid JSON.`);
  }

  if (!SUPPORTED_VERSIONS.includes(data.v)) {
    throw new Error(`Index format v${data.v ?? '?'} isn't supported by this app (it understands v${SUPPORTED_VERSIONS.join(', v')}). One of them is out of date.`);
  }
  const site = data.site;
  if (!site || typeof site.urlTemplate !== 'string' || !site.urlTemplate.includes('{page}')) {
    throw new Error('Index is missing site.urlTemplate (or it has no {page} placeholder) — result links can\'t be built.');
  }
  if (!Array.isArray(data.docs) || data.docs.length === 0) {
    throw new Error('Index has no docs to search.');
  }
  const bad = data.docs.find(d => d == null || d.page == null || d.title == null || d.text == null);
  if (bad) throw new Error('Index has a doc missing a required field (page, title, text).');

  return data;
}

function run() {
  const q = els.q.value.trim();
  els.results.replaceChildren();
  if (!q) return;

  const hits = query(HANDLE, q, { limit: 25 });
  if (!hits.length) {
    const empty = el('div', 'empty', `No matches for “${q}”.`);
    els.results.append(empty);
    return;
  }
  for (const hit of hits) els.results.append(renderHit(hit));
}

function renderHit({ doc, phrase, snippet }) {
  const a = document.createElement('a');
  a.className = 'hit';
  a.href = resultUrl(doc, phrase);
  a.target = '_blank';          // new tab: text fragments require user-initiated navigation,
  a.rel = 'noopener';           // which a real <a> click (not JS location=) provides.

  const title = el('div', 'title', doc.heading ? `${doc.title} › ${doc.heading}` : doc.title);
  const crumb = el('div', 'crumb', doc.page);
  const snip = el('div', 'snippet');
  markSnippet(snip, snippet, phrase);

  a.append(title, crumb, snip);
  return a;
}

// Build the result URL purely from the index's own metadata + a Text Fragment.
// No hardcoded github.com — a non-GitHub site just ships a different urlTemplate.
function resultUrl(doc, phrase) {
  const base = SITE.urlTemplate.replace('{page}', encodeURIComponent(doc.page));
  const anchor = doc.anchor ? String(doc.anchor) : '';
  const wantText = SITE.fragments !== false && phrase;
  const textDir = wantText ? `:~:text=${encodeTextDirective(phrase)}` : '';
  if (!anchor && !textDir) return base;
  return `${base}#${anchor}${textDir}`;
}

// Text Fragment terms must percent-encode &, comma, and the directive separators.
// encodeURIComponent covers &/,/% and spaces (%20); we additionally encode '-'
// defensively so it is never mistaken for a prefix/suffix separator.
function encodeTextDirective(s) {
  return encodeURIComponent(s).replace(/-/g, '%2D');
}

function markSnippet(node, snippet, phrase) {
  if (!phrase) { node.textContent = snippet; return; }
  const i = snippet.toLowerCase().indexOf(phrase.toLowerCase());
  if (i < 0) { node.textContent = snippet; return; }
  node.append(
    document.createTextNode(snippet.slice(0, i)),
    el('mark', null, snippet.slice(i, i + phrase.length)),
    document.createTextNode(snippet.slice(i + phrase.length)),
  );
}

function setStatus(text) { els.status.className = 'status'; els.status.textContent = text; }
function fail(text) { els.status.className = 'status error'; els.status.textContent = text; }
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
