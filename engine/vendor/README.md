# Vendored: MiniSearch

`minisearch.mjs` is **MiniSearch v7.2.0**, vendored **unmodified** from the
published npm package's own ESM entry (`dist/es/index.js`):

```
https://cdn.jsdelivr.net/npm/minisearch@7.2.0/dist/es/index.js
```

- **License:** MIT — see [`minisearch.LICENSE.txt`](./minisearch.LICENSE.txt)
  (© 2022 Luca Ongaro). MIT is compatible with wiki-search's BSD-3-Clause; the
  notice is retained here as the MIT terms require.
- **Upstream:** https://github.com/lucaong/minisearch
- **Why vendored:** the app is a zero-build static site, so it imports MiniSearch
  directly as a single self-contained ESM file (no relative imports, no
  bundler). Pinned to an exact version for reproducibility.
- **Chosen** over the hand-rolled ranker (`engine/search.js`) by the S3 A/B —
  see [`../../spikes/s3/NOTES.md`](../../spikes/s3/NOTES.md).

To update: refetch the same `dist/es/index.js` at the new pinned version, and
refresh this note plus the license text if upstream's copyright changed.
