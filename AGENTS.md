# AGENTS.md — wiki-search

> `wiki-search` adds real search to a GitHub wiki (or any Markdown docs site): a tiny bookmarklet opens a hosted search app that jumps you straight to the matching section, without moving the docs. Two deliverables share one repo — the **`wiki-search-index`** npm CLI that builds a self-describing JSON index from Markdown, and the **static search app** (GitHub Pages) that loads an index and deep-links each hit with a Text Fragment. Zero runtime dependencies; no build step.

For detailed usage docs see the [wiki](https://github.com/uhop/wiki-search/wiki). The index contract is [`INDEX-FORMAT.md`](./INDEX-FORMAT.md).

## Setup

```bash
git clone --recursive https://github.com/uhop/wiki-search.git
cd wiki-search
npm install
```

The wiki is a git submodule in `wiki/`. It's only needed for editing the docs — the app loads its index from `raw.githubusercontent.com` at runtime, so CI and the Pages deploy check out without submodules.

## Commands

- **Test:** `npm test` — the builder suite (`node builder/test/run.mjs`).
- **Build an index (the CLI):** `npx wiki-search-index --wiki ./wiki` → `<wiki>/search-index.json`.
- **Run the app locally:** `python3 -m http.server` from the repo root, then open `http://localhost:8000/app/?wiki=uhop/wiki-search`.

There is no build step and no transpilation — `.mjs` / `.js` run as-is in Node and the browser.

## Project structure

```
wiki-search/
├── package.json          # npm package `wiki-search-index` (the builder CLI); "type": "module", zero deps
├── index.html            # Landing + bookmarklet-install page (the GitHub Pages root)
├── INDEX-FORMAT.md       # The v1 index contract (builder output ⇄ app input)
├── builder/              # `wiki-search-index` CLI — Markdown → JSON index (the published package)
│   ├── wiki-index.mjs    # CLI entry: arg parsing, owner/repo inference, output
│   ├── lib/
│   │   ├── build-index.mjs  # Walk the wiki, section the Markdown, assemble the index
│   │   ├── markdown.mjs     # Markdown → sections + plain text
│   │   └── slug.mjs         # GitHub-style heading slugs (github-slugger approximation)
│   ├── test/             # Builder tests (`node builder/test/run.mjs`) + fixtures
│   └── README.md
├── app/                  # The hosted search app (static, GitHub Pages — not published to npm)
│   ├── app.js            # Load + validate an index, search, render results, positioning + popup UX
│   ├── index.html
│   └── style.css
├── engine/               # Search core (browser ESM)
│   ├── minisearch.js     # Default engine (vendored MiniSearch)
│   ├── search.js         # Zero-dependency fallback engine (same interface)
│   ├── phrase.js         # Shared phrase-pick + snippet logic
│   └── vendor/           # Vendored MiniSearch (MIT) + license + provenance README
├── bookmarklet/
│   └── bookmarklet.js    # APP_URL + the thin `?from=` launcher string (one source of truth)
├── wiki/                 # GitHub wiki documentation (git submodule)
└── .github/
    ├── workflows/        # tests.yml (Node CI) + pages.yml (deploy the app)
    ├── COPILOT-INSTRUCTIONS.md
    ├── FUNDING.yml
    └── dependabot.yml
```

## Quick reference

Build an index (CLI):

```bash
# GitHub wiki — owner/repo inferred from the wiki dir's git origin
npx wiki-search-index --wiki ./wiki
# Explicit repo (when the wiki origin lacks the .wiki.git suffix)
npx wiki-search-index --wiki ./wiki --repo uhop/wiki-search
# Any non-GitHub site — supply a URL template containing {page}
npx wiki-search-index --wiki ./docs --url-template 'https://example.com/docs/{page}' --name 'Example docs'
```

Search (the hosted app):

```
https://uhop.github.io/wiki-search/app/?wiki=<owner>/<repo>   # GitHub wiki convenience
https://uhop.github.io/wiki-search/app/?index=<url>           # any v1 index, anywhere
```

## Code style

- ES modules throughout (`"type": "module"`). The builder is `.mjs`; the app/engine/bookmarklet are browser ESM imported via `<script type="module">`.
- No transpilation, no bundler, no build step — code runs directly in Node and the browser.
- Arrow-function / lambda style; prefer prefix `++i` / `--i` when the result is unused.

## Architecture

- The **builder** (`builder/wiki-index.mjs` → `builder/lib/`) compiles Markdown into a self-describing v1 index (`INDEX-FORMAT.md`): deterministic output (sorted, no timestamps) so a `git diff` can gate staleness, with GitHub-slugger-accurate anchors.
- The **app** (`app/app.js`) fetches an index, validates it (verify-or-explain — every failure yields a specific message, never a blank box), searches via the **engine** (`engine/minisearch.js`, vendored MiniSearch; `engine/search.js` is a zero-dep fallback with the same `buildIndex` / `query` / `ENGINE_NAME` interface; shared phrase logic in `engine/phrase.js`), and renders hits as real `<a>` links carrying `#anchor:~:text=phrase` Text Fragment directives.
- The **bookmarklet** (`bookmarklet/bookmarklet.js`) is a thin launcher: it opens the app on its own origin (so the wiki page's CSP can't block it) with `?from=<current page URL>`; the app derives owner/repo from `?from`. Only the app URL is frozen into a saved bookmark — wiki detection, the engine, and positioning all live server-side and update on redeploy.

## Key conventions

- **No runtime dependencies.** The npm package (`wiki-search-index`) is dependency-free; MiniSearch is vendored in `engine/vendor/` (MIT, license-checked against the project's BSD-3-Clause). Don't add `dependencies`.
- **The published package is the CLI only.** `package.json#files` ships `builder/` + `INDEX-FORMAT.md` + `llms*.txt`; the app/engine/bookmarklet are deployed to GitHub Pages, not published. `wiki-search-index` is a `bin`, not an importable module — no `.d.ts` sidecars, no `exports` map (documented deviation: `projects/wiki-search/decisions.md` § D15).
- **The index format is a versioned contract** (`INDEX-FORMAT.md`). Additive optional fields don't bump `v`; breaking changes do, and clients reject an unknown `v` rather than guessing.
- **The app URL baked into the bookmarklet is a permanent commitment** — keep the Pages path stable (or front it with a redirect / custom domain). A dragged bookmark can't be remotely updated; everything else can.
- **Rebuild the index when the wiki's Markdown changes** (it doesn't go stale on its own). Update the `wiki/` submodule alongside changes that affect documented behavior; the README + wiki are visitor-first (problem → install → usage).
