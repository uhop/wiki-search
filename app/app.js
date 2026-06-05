// app/app.js — the popup search app (S1 + S2 spikes).
//
// Path P thesis (S1): opened via a bookmarklet's window.open() from a GitHub
// wiki page, this is a new top-level context on its own origin, so the wiki
// page's CSP does not govern it. It fetches a self-describing, versioned index,
// validates it (verify-or-explain — every failure produces a specific message,
// never a blank box), searches, and renders results as real <a> links.
//
// Positioning (S2): result links carry Text Fragment directives
// (`#anchor:~:text=phrase`). Three levers, exposed in the settings row so the
// behaviour can be A/B'd on a real GitHub wiki page:
//   - target: new tab | reused named tab | the original (opener) tab
//   - #anchor on/off  (structural scroll fallback)
//   - :~:text= on/off (native highlight; auto-off where unsupported)

import { buildIndex, query, ENGINE_NAME } from '../engine/minisearch.js';

const SUPPORTED_VERSIONS = [1];
const DEFAULT_WIKI_INDEX_FILE = 'search-index.json'; // convention used only by the ?wiki shortcut (open decision, S1)
const SPIKE_FALLBACK_INDEX = '../spikes/s1/sample-index.json';

const els = {
  q: document.getElementById('q'),
  status: document.getElementById('status'),
  results: document.getElementById('results'),
  engine: document.getElementById('engine'),
  target: document.getElementById('m-target'),
  anchor: document.getElementById('m-anchor'),
  text: document.getElementById('m-text'),
  fragSupport: document.getElementById('frag-support'),
};

let SITE = null;
let HANDLE = null;

// Does this browser consume Text Fragment directives? (Document.fragmentDirective)
// Present in Chrome/Edge, Safari 18.2+, Firefox 131+. Detection ≈ support; the
// S2 cross-browser checklist is authoritative, but this is enough to drive the
// anchor-only fallback.
const FRAGMENTS_SUPPORTED = 'fragmentDirective' in document;

// S2 positioning levers. Defaults reproduce S1 (new tab, anchor + text directive).
const MODES = { target: 'new', anchor: true, text: true };

const setStatus = text => { els.status.className = 'status'; els.status.textContent = text; };
const fail = text => { els.status.className = 'status error'; els.status.textContent = text; };

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const debounce = (fn, ms) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

// Resolve which index to load, in priority order:
//   ?index=<url>            general — any JSON anywhere; its metadata says how to link.
//   ?wiki=<owner>/<repo>    GitHub convenience — derive the raw index URL.
//   (neither)               spike fallback: the bundled stream-json sample.
const resolveIndexUrl = params => {
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
};

// Fetch + validate. Each failure throws an Error with a specific, human message.
const loadIndex = async url => {
  if (!url) throw new Error('No index specified. Add ?index=<url> or ?wiki=<owner>/<repo> to the URL.');

  let res;
  try {
    res = await fetch(url, { mode: 'cors' });
  } catch {
    throw new Error(`Couldn't load the index at\n${url}\nNetwork error (offline, blocked, or no CORS header).`);
  }
  if (!res.ok) throw new Error(`Couldn't load the index at\n${url}\nServer returned ${res.status} ${res.statusText}.`);

  let data;
  try {
    data = await res.json();
  } catch {
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
};

// Text Fragment terms must percent-encode &, comma, and the directive separators.
// encodeURIComponent covers &/,/% and spaces (%20); we additionally encode '-'
// defensively so it is never mistaken for a prefix/suffix separator.
const encodeTextDirective = s => encodeURIComponent(s).replace(/-/g, '%2D');

// Build the result URL purely from the index's own metadata + the active levers.
// No hardcoded github.com — a non-GitHub site just ships a different urlTemplate.
const resultUrl = (doc, phrase) => {
  const base = SITE.urlTemplate.replace('{page}', encodeURIComponent(doc.page));
  const anchor = MODES.anchor && doc.anchor ? String(doc.anchor) : '';
  // Drop the text directive when unsupported/disabled: in a non-consuming browser
  // a trailing :~:text= would corrupt the #anchor and break the scroll fallback too.
  const useText = MODES.text && FRAGMENTS_SUPPORTED && SITE.fragments !== false && phrase;
  const textDir = useText ? `:~:text=${encodeTextDirective(phrase)}` : '';
  if (!anchor && !textDir) return base;
  return `${base}#${anchor}${textDir}`;
};

const markSnippet = (node, snippet, phrase) => {
  if (!phrase) { node.textContent = snippet; return; }
  const i = snippet.toLowerCase().indexOf(phrase.toLowerCase());
  if (i < 0) { node.textContent = snippet; return; }
  node.append(
    document.createTextNode(snippet.slice(0, i)),
    el('mark', null, snippet.slice(i, i + phrase.length)),
    document.createTextNode(snippet.slice(i + phrase.length)),
  );
};

// Wire the result link's navigation per the active target mode. Text fragments
// require *user-initiated* navigation, so a real <a> click keeps them working
// for new and reused tabs. 'opener' navigates the original wiki tab via script —
// same tab, but the highlight is lost (the S2 trade-off, made visible).
const applyTarget = a => {
  if (MODES.target === 'opener' && window.opener) {
    a.addEventListener('click', e => {
      e.preventDefault();
      window.opener.location.href = a.href;
      try { window.opener.focus(); } catch {}
    });
    return;
  }
  a.target = MODES.target === 'tab' ? 'wiki-search-result' : '_blank';
  a.rel = 'noopener';
};

const renderHit = ({ doc, phrase, snippet }) => {
  const a = el('a', 'hit');
  a.href = resultUrl(doc, phrase);
  applyTarget(a);

  const title = el('div', 'title', doc.heading ? `${doc.title} › ${doc.heading}` : doc.title);
  const crumb = el('div', 'crumb', doc.page);
  const snip = el('div', 'snippet');
  markSnippet(snip, snippet, phrase);

  a.append(title, crumb, snip);
  return a;
};

const run = () => {
  const q = els.q.value.trim();
  els.results.replaceChildren();
  if (!q) return;

  const hits = query(HANDLE, q, { limit: 25 });
  if (!hits.length) {
    els.results.append(el('div', 'empty', `No matches for “${q}”.`));
    return;
  }
  for (const hit of hits) els.results.append(renderHit(hit));
};

// Reflect text-fragment support + URL-param defaults into the settings row, and
// rebuild result links whenever the user flips a lever.
const wireSettings = params => {
  MODES.target = params.get('target') || 'new';
  MODES.anchor = params.get('anchor') !== 'off';
  MODES.text = params.get('text') !== 'off';

  // 'opener' is meaningless when the app wasn't opened by a bookmarklet.
  if (MODES.target === 'opener' && !window.opener) MODES.target = 'new';

  els.target.value = MODES.target;
  els.anchor.checked = MODES.anchor;

  if (FRAGMENTS_SUPPORTED) {
    els.text.checked = MODES.text;
    els.fragSupport.textContent = 'text fragments: supported';
    els.fragSupport.className = 'frag';
  } else {
    MODES.text = false;
    els.text.checked = false;
    els.text.disabled = true;
    els.fragSupport.textContent = 'text fragments: unsupported here — section-scroll only';
    els.fragSupport.className = 'frag warn';
  }

  const sync = () => {
    MODES.target = els.target.value;
    MODES.anchor = els.anchor.checked;
    MODES.text = els.text.checked && FRAGMENTS_SUPPORTED;
    run();
  };
  els.target.addEventListener('change', sync);
  els.anchor.addEventListener('change', sync);
  els.text.addEventListener('change', sync);
};

const main = async () => {
  els.engine.textContent = ENGINE_NAME;
  const params = new URLSearchParams(location.search);
  wireSettings(params);

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
};

main();
