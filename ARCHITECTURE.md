# Architecture

`wiki-search` adds search to a GitHub wiki (or any Markdown docs site) without moving the docs. Two deliverables share the repo: the **`wiki-search-index`** CLI (published to npm) that compiles Markdown into a self-describing JSON index, and a **static search app** (GitHub Pages) that loads an index and deep-links each hit to its section via Text Fragments. **Zero runtime dependencies**, no build step — `.mjs` / `.js` run directly in Node and the browser.

## Project layout

```
wiki-search/
├── package.json          # npm package `wiki-search-index` (the builder CLI); "type": "module"
├── index.html            # Landing + bookmarklet-install page (the GitHub Pages root)
├── INDEX-FORMAT.md       # The v1 index contract — builder output ⇄ app input
├── builder/              # The published package: Markdown → JSON index
│   ├── wiki-index.mjs    # CLI entry: arg parsing, owner/repo inference, write/stdout
│   ├── lib/
│   │   ├── build-index.mjs  # Walk the wiki, section the Markdown, assemble the index
│   │   ├── markdown.mjs     # Markdown → sections (heading + plain-text body)
│   │   └── slug.mjs         # GitHub-style heading slugs (github-slugger approximation)
│   ├── test/             # Builder tests (node builder/test/run.mjs) + Markdown fixtures
│   └── README.md
├── app/                  # The hosted search app (static — not published to npm)
│   ├── app.js            # Load + validate index, search, render, positioning, popup UX
│   ├── index.html
│   └── style.css
├── engine/               # Search core (browser ESM)
│   ├── minisearch.js     # Default engine (vendored MiniSearch)
│   ├── search.js         # Zero-dependency fallback engine (same interface)
│   ├── phrase.js         # Shared phrase-pick + snippet logic (both engines use it)
│   └── vendor/           # Vendored MiniSearch (MIT) + LICENSE + provenance README
├── bookmarklet/
│   └── bookmarklet.js    # APP_URL + the thin `?from=` launcher string (one source of truth)
├── wiki/                 # GitHub wiki documentation (git submodule)
├── llms.txt              # Concise LLM reference (the wiki-search-index CLI + index format)
├── llms-full.txt         # Detailed LLM reference (full CLI + index + app surface)
├── AGENTS.md             # AI agent rules and project conventions
├── CLAUDE.md             # Pointer to AGENTS.md
└── .github/
    ├── workflows/        # tests.yml (Node CI) + pages.yml (deploy the static app)
    ├── COPILOT-INSTRUCTIONS.md  # Pointer to AGENTS.md
    ├── FUNDING.yml
    └── dependabot.yml
```

## Core concepts

### The self-describing index (the contract between the two halves)

The builder and the app are decoupled by a single JSON document, specified in [`INDEX-FORMAT.md`](./INDEX-FORMAT.md). It carries its own `site.urlTemplate` (must contain `{page}`), a `site.fragments` flag, and a `docs[]` array (one entry per section: `page`, `title`, `heading`, `anchor`, `text`). The app **assumes nothing beyond this contract** — it builds result links purely from the index's own metadata, so there is no hardcoded `github.com` and any site emitting this shape is searchable. `v` bumps only on a breaking change; clients reject a `v` they don't understand.

### Path P — the bookmarklet opens the app on its own origin

The bookmarklet (`bookmarklet/bookmarklet.js`) does one thing: `window.open` the hosted app on its own GitHub Pages origin (the Flipboard "Flip It" pattern), passing the current page URL as `?from=`. Because the opened window is a new top-level context on our origin, the wiki page's Content-Security-Policy doesn't govern it. The bookmarklet is a permanent thin stub — wiki detection, the engine, the index handling, and positioning all live in the app and refresh on every click, so a bookmark dragged once auto-updates whenever the app is redeployed. The only value frozen into a saved bookmark is `APP_URL`; treat it as a permanent commitment (keep the Pages path stable, or front it with a redirect / custom domain).

### Verify-or-explain

`app/app.js` validates every index it loads and, on any failure, shows a specific message (fetch/CORS error, invalid JSON, unsupported `v`, missing `site.urlTemplate`, empty `docs`) — never a blank result box. The same discipline drives the "nothing to search yet" copy when the app is opened off a recognizable wiki page.

### Text-fragment positioning

Result links are real `<a>` elements carrying `#anchor:~:text=phrase`. The `#anchor` scrolls to the section; the `:~:text=` directive (honored on user-initiated navigation in Chrome/Edge, Safari ≥18.2, Firefox ≥131) highlights the exact phrase. On GitHub the client-side scroll shim fights a bare `#anchor`, so the anchor is dropped **only** in the modes where the directive actually fires; the shared phrase logic (`engine/phrase.js`) widens and prefers headings to keep the directive distinctive.

### Engine interchangeability

Both engines expose the same tiny interface — `buildIndex(docs)`, `query(handle, q, {limit})`, `ENGINE_NAME` — so they're swappable. `engine/minisearch.js` (vendored MiniSearch, BM25 + field boosts + prefix/fuzzy) is the default; `engine/search.js` is a zero-dependency fallback. Phrase + snippet selection is shared (`engine/phrase.js`) so links and highlights match regardless of engine.

## Module dependency graph

```
builder/wiki-index.mjs ── builder/lib/build-index.mjs ─┬─ builder/lib/markdown.mjs
  (CLI: args, repo inference, output)                  └─ builder/lib/slug.mjs
        │
        └── emits → search-index.json  (INDEX-FORMAT.md v1)  ← fetched by ↓

app/app.js ──┬─ engine/minisearch.js ── engine/vendor/minisearch.mjs
             │        └─ engine/phrase.js
             ├─ engine/search.js (fallback) ── engine/phrase.js
             └─ bookmarklet/bookmarklet.js (BOOKMARKLET shown in the standalone promo)

index.html (install page) ── bookmarklet/bookmarklet.js (the draggable bookmarklet)
```

The builder is Node-only and writes the index into the wiki repo (served from `raw.githubusercontent.com`). The app, engine, and bookmarklet are browser ESM; the bookmarklet constant is the single source the app's promo line and the install page both import.

## Testing

`npm test` runs the builder suite (`node builder/test/run.mjs`) against the Markdown fixtures in `builder/test/fixtures/` — parser, slug/anchor accuracy, options, and filters. The app, engine, and bookmarklet are browser code, verified by the manual browser gates (popup under CSP + text-fragment highlight across browsers) tracked in the project queue, not by CI.

## CI / deploy

- `.github/workflows/tests.yml` — Node `[22, 24, 26]` on ubuntu, `npm ci` + `npm test`. Node-only by design: the builder is the Node-side unit (documented deviation, `projects/wiki-search/decisions.md` § D15).
- `.github/workflows/pages.yml` — deploys the static app (`app/`, `engine/`, `bookmarklet/`, `index.html`) to GitHub Pages via Actions, checking out **without** submodules (the app loads its index from `raw.githubusercontent.com`, so it doesn't need `wiki/`).
