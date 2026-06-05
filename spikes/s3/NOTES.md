# S3 — builder on a real wiki + engine A/B

**Goal.** Now that the builder produces a real index of this project's own wiki
(36 sections / 6 pages), settle the open **engine-choice** question — hand-rolled
vs MiniSearch — and sanity-check relevance against GitHub's native wiki search.

The hand-rolled-vs-MiniSearch comparison is automated (`compare.mjs`). GitHub's
native search is a **manual** column — it can't be driven headlessly.

## Run

```bash
# MiniSearch is a vendored, eval-only dependency (gitignored, not committed):
mkdir -p spikes/s3/vendor
curl -sL https://cdn.jsdelivr.net/npm/minisearch@7/+esm -o spikes/s3/vendor/minisearch.mjs

node spikes/s3/compare.mjs                 # default queries, local wiki/search-index.json
node spikes/s3/compare.mjs --live          # against the raw-hosted index
node spikes/s3/compare.mjs "your query"    # ad-hoc queries
```

Both engines implement the same `{ buildIndex, query, ENGINE_NAME }` interface
(the hand-rolled one is `engine/search.js`; MiniSearch via
`engines/minisearch-adapter.mjs`), so the harness drives them apples-to-apples.

## Result (8 realistic queries, 2026-06-04)

**Top-hit agreement: 5/8.** On the 5 agreements both pick the obviously-right
section. On the **3 disagreements, MiniSearch is the better answer every time**:

| Query | Hand-rolled #1 | MiniSearch #1 | Better |
|-------|----------------|---------------|--------|
| why not pagefind | Architecture › Path P | Overview › guiding principle (but surfaces D-D › Research facts, the real Pagefind line, at #3) | MiniSearch (only one to surface the Pagefind fact at all) |
| self describing index | Index-Format › Index Format | Design-Decisions › D3 (the *rationale*) | MiniSearch (the "why", not just the page named like the query) |
| how does the bookmarklet avoid csp | D-D › Research facts (bullet) | Architecture › Path P (the actual explanation) | MiniSearch |

Pattern: the hand-rolled ranker over-weights exact page-title/field hits;
MiniSearch's BM25 + field boosts + prefix/fuzzy consistently surfaces the
*conceptually* right section on multi-word queries. The corpus is small (36
sections), so the gap is modest here but widens with size — MiniSearch's
advantages are structural.

## Cost of adopting MiniSearch

Small. MiniSearch is a single ~18 KB, **zero-dependency** ESM file. The app can
`import MiniSearch from './minisearch.mjs'` directly — **the static, zero-build
deployment is preserved**; we'd just vendor one pinned MIT-licensed file into
`app/` rather than ship our own ranker. Index size is unaffected (19 KB raw /
6.2 KB gzip; MiniSearch builds its in-memory index at load).

## Verdict / recommendation

**Adopt MiniSearch** for the app: clearly-better relevance on conceptual queries
at a small, build-free cost. Keep `engine/search.js` as a zero-dep reference /
fallback. This is the open decision's answer — final call is the maintainer's.

If adopted: vendor `app/vendor/minisearch.mjs` (pinned), point `app/app.js`'s
engine import at it, and drop `prefix`/`fuzzy`/`boost` config alongside.

## GitHub-native search — manual comparison (to fill)

Search the same queries in the wiki's own search box
(`github.com/uhop/wiki-search/wiki` → search) and note whether it finds the right
page at all. Native wiki search has no section-level granularity and weak
ranking — the gap it leaves is wiki-search's whole reason to exist.

| Query | GitHub native finds the right page? | section-level? |
|-------|-------------------------------------|----------------|
| self describing index | ☐ | ✗ (page-level only) |
| deterministic builder staleness gate | ☐ | ✗ |
| verify or explain validation | ☐ | ✗ |
