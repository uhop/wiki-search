# wiki-search [![NPM version][npm-img]][npm-url]

[npm-img]: https://img.shields.io/npm/v/wiki-search-index.svg
[npm-url]: https://npmjs.org/package/wiki-search-index

GitHub wikis are great for docs but have no real search. **wiki-search adds it:**
a bookmarklet (plus a hosted search page) that searches a wiki and takes you
straight to the matching section — without moving your docs off the wiki.

**▶ [Try the live demo & install the bookmarklet](https://uhop.github.io/wiki-search/)**

## Use it

- **Search a wiki.** Drag the bookmarklet to your bookmarks bar, then open any
  GitHub wiki that has a wiki-search index and search — each result jumps you to
  the exact section. ([Try it now](https://uhop.github.io/wiki-search/app/?wiki=uhop/wiki-search)
  on this project's own wiki — no install needed.)
- **Add search to your own wiki.** Build an index from your Markdown — needs
  [Node](https://nodejs.org), nothing to install:

  ```bash
  npx wiki-search-index --wiki ./your-wiki   # → your-wiki/search-index.json
  ```

  Commit that `search-index.json` into your wiki, then add a one-line Search
  section. Got API docs in your README? Run from your repo root and add
  `--file README.md` to fold it into the same index — results deep-link to the
  rendered file on GitHub. Full guide — including keeping the index fresh —
  [Add search to your wiki](https://github.com/uhop/wiki-search/wiki/Add-Search).

## How it works

The bookmarklet opens the search page on its own GitHub Pages origin, so the
wiki page's security policy can't block it. There it loads a small JSON index
built from the wiki's Markdown and links each result with a
[text fragment](https://developer.mozilla.org/docs/Web/Text_fragments), so your
browser scrolls to — and, where supported, highlights — the matched phrase. By
default a result re-uses your current tab; Back returns you. The index carries
its own URL template, so the same app works for any site with no hardcoded host.

<details>
<summary>Repo layout & local run</summary>

| Path           | What                                                                |
| -------------- | ------------------------------------------------------------------- |
| `index.html`   | Landing + bookmarklet-install page (the Pages root).                |
| `app/`         | The search page (loads + validates an index, searches, links out).  |
| `builder/`     | `wiki-index` CLI: Markdown → the JSON index.                        |
| `engine/`      | Search core: MiniSearch (vendored), with a zero-dep fallback.       |
| `bookmarklet/` | The bookmarklet — one constant, imported by the app + install page. |

Run locally: `python3 -m http.server` from the repo root, then open
<http://localhost:8000/app/?wiki=uhop/wiki-search>.

</details>

## Release notes

- 0.1.3 _Fix: HTML entities in headings now decode too, so anchors and section titles match GitHub (0.1.1 only handled body text)._
- 0.1.2 _Set the published CLI's execute bit (tidy hygiene; npm already chmods bins on install)._
- 0.1.1 _HTML entities (`&mdash;`, `&#1234;`, …) are decoded so they no longer pollute the index._
- 0.1.0 _Initial release of the `wiki-search-index` builder._

For the full history see the wiki: [Release notes](https://github.com/uhop/wiki-search/wiki/Release-notes).

## License

[BSD-3-Clause](LICENSE)
