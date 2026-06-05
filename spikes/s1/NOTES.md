# S1 — Path P end-to-end (the gate)

**Goal.** Prove that a bookmarklet on a real GitHub wiki page can `window.open`
our app, and that the opened window — a new top-level context on its own origin
— runs freely under the wiki page's CSP: it fetches a self-describing index,
searches, and emits clickable Text-Fragment result links. If this holds, the
whole Path P architecture is viable. See `projects/wiki-search/{design,decisions}`
in the vault.

## What's here

- `../../app/` — the popup app (`index.html` + `app.js`); loads + validates an
  index, searches, renders results as real `<a>` links with `#anchor:~:text=`.
- `../../engine/search.js` — dependency-free ranked search (swappable; the
  MiniSearch/Orama vs hand-rolled decision is still open — see queue).
- `../../bookmarklet/` — the `window.open` stub + `build.mjs` minifier.
- `sample-index.json` — a hand-built v1 index of ~11 stream-json wiki sections
  (stands in for the Phase-1 builder, which doesn't exist yet).
- `smoke.mjs` — headless proof of the search→link path.

## Run it

### 1. Headless search proof (no browser)

```bash
node spikes/s1/smoke.mjs
node spikes/s1/smoke.mjs "newline delimited json"
```

Prints ranked hits and the exact result URLs (with `:~:text=` directives) the
app would produce. Confirms fetch-shape → validate → rank → link.

### 2. App in a browser (validate-or-explain + UI)

```bash
python3 -m http.server 8080      # from the repo root
```

- `http://localhost:8080/app/` — bare: falls back to the bundled sample index.
- `http://localhost:8080/app/?index=../spikes/s1/sample-index.json` — explicit.
- `http://localhost:8080/app/?index=http://localhost:8080/nope.json` — see a
  specific 404 message (verify-or-explain), not a blank box.

Type `array`, `jsonStreaming`, `redact`… results are real links; clicking one
opens the stream-json wiki page positioned/highlighted at the match.

### 3. The actual gate — Path P under real GitHub CSP

```bash
node bookmarklet/build.mjs --app=http://localhost:8080/app/
```

Copy the printed `javascript:…` into a new bookmark. Then:

1. Open a real page, e.g. `https://github.com/uhop/stream-json/wiki/Parser`.
2. Click the bookmark. **Expected:** a popup opens on `localhost:8080` despite
   the wiki page's CSP — because it's a new top-level window on its own origin,
   not a sub-resource of the wiki page. The stub also appends `?wiki=uhop/stream-json`.
3. In the popup, search and click a result. **Expected:** the stream-json wiki
   page opens in a new tab, scrolled to the section and (where supported)
   highlighting the matched phrase.

> The `?wiki=` shortcut derives `raw.githubusercontent.com/wiki/uhop/stream-json/search-index.json`,
> which doesn't exist until the Phase-1 builder commits one — so for S1 drive
> the popup with `--app=…/app/?index=<sample-url>` instead, or just use the
> bundled fallback. The cross-origin CORS fetch from `raw` was already
> live-probed (CORS `*`) and is re-confirmed once an index is pushed.

## Go / no-go criteria

| # | Checks | Pass = |
|---|--------|--------|
| G1 | Bookmarklet opens the popup from a real wiki page | popup appears; no CSP block |
| G2 | Popup fetches + validates the index on its own origin | results render; bad index → specific message |
| G3 | Result click lands on the right section | new tab scrolls to `#anchor` |
| G4 | Text Fragment highlights the phrase (Chrome/Edge, FF ≥131, Safari ≥18.2) | match visibly highlighted |
| G5 | Relevance feels usable vs. GitHub native scoped search | subjective; carried into S3 |

G1–G3 are the hard gate. G4 may degrade gracefully (anchor-only) on older
browsers — that's acceptable and is the S2 spike's detailed remit. G5 is a feel
check that S3 formalizes against the real builder output.

## Known nuances to verify in S2

- GitHub renders heading ids as `user-content-<slug>`; a bare `#<slug>` is
  scrolled by GitHub's own JS. The `:~:text=` directive highlights natively
  regardless, so it's the real positioner; `#anchor` is best-effort fallback.
- Text fragments fire only on **user-initiated** navigation — hence real `<a>`
  links, never `location =`.
- Same-tab positioning (via `window.name`/named `target`) is an S2 spike;
  S1 uses guaranteed new-tab (`target="_blank"`).
