# Index format (v1)

A wiki-search index is a single, self-describing JSON document. A client
**assumes nothing** beyond this contract: it validates the version and required
fields, then builds result links purely from the index's own metadata. Any site
that emits this shape is searchable — wiki-search is not GitHub-specific.

```json
{
  "v": 1,
  "site": {
    "name": "wiki-search wiki",
    "urlTemplate": "https://github.com/uhop/wiki-search/wiki/{page}",
    "fragments": true
  },
  "docs": [
    {
      "id": 0,
      "page": "Index-Format",
      "title": "Index format",
      "heading": "Validation",
      "anchor": "validation",
      "text": "full plain-text of the section…"
    }
  ]
}
```

## Fields

| Field              | Meaning                                                                                                                                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v`                | Format version. This document is `1`. Clients reject versions they don't understand.                                                                                                                                                                            |
| `site.name`        | Human label for the corpus (shown in the UI).                                                                                                                                                                                                                   |
| `site.urlTemplate` | Result-URL template; **must contain `{page}`**. No hardcoded host.                                                                                                                                                                                              |
| `site.fragments`   | `true` if the target renders [Text Fragments](https://developer.mozilla.org/docs/Web/Text_fragments). When `false`, clients omit the `:~:text=` directive.                                                                                                      |
| `docs[]`           | One entry per indexed section.                                                                                                                                                                                                                                  |
| `doc.id`           | Stable integer, sequential in build order.                                                                                                                                                                                                                      |
| `doc.page`         | The `{page}` substitution. For a GitHub wiki page, its URL segment (`Foo-Bar`). May also be a **relative URL path** (e.g. `../blob/main/README.md`) to point a result at a file outside the wiki — see [Folding in non-wiki files](#folding-in-non-wiki-files). |
| `doc.title`        | Page display title.                                                                                                                                                                                                                                             |
| `doc.heading`      | Section heading (falls back to the page title for a page's preamble).                                                                                                                                                                                           |
| `doc.anchor`       | In-page anchor slug; `""` means the page top. For GitHub, the heading's slug.                                                                                                                                                                                   |
| `doc.text`         | Plain-text body of the section (markdown stripped), for the search engine.                                                                                                                                                                                      |

## Building a result URL

```
base   = urlTemplate.replace("{page}", encodePerSegment(doc.page))
hash   = doc.anchor || ""              (omit if empty)
text   = ":~:text=" + <matched phrase> (only if site.fragments and a phrase)
result = base + ("#" + hash + text  if hash or text)
```

`encodePerSegment` runs `encodeURIComponent` on each `/`-separated segment and
rejoins with `/`. For an ordinary single-segment page this is identical to
`encodeURIComponent`; for a relative page it keeps the `/` and `..` literal so
the browser can normalize the dot-segments (see below).

So a hit links to e.g.
`https://github.com/uhop/wiki-search/wiki/Index-Format#validation:~:text=clients%20reject`.

## Folding in non-wiki files

A repo file (e.g. `README.md`, used by many projects as API docs) can be indexed
alongside the wiki pages by giving its docs a **relative** `page` that climbs out
of the wiki path:

```json
{
  "id": 12,
  "page": "../blob/main/README.md",
  "title": "node-re2",
  "heading": "Usage",
  "anchor": "usage",
  "text": "…"
}
```

Against the canonical `https://github.com/<owner>/<repo>/wiki/{page}` template
this substitutes to `…/wiki/../blob/main/README.md`, which the browser normalizes
to `…/blob/main/README.md` on navigation (the `..` removes the `wiki` segment
before the request is sent). The same anchors and `:~:text=` directive apply, so
results deep-link into the file's headings exactly as they do for wiki pages.

This is purely a `page`-value convention — no new fields, so the format stays
`v: 1`. It assumes the GitHub wiki URL layout; the reference builder emits these
via `--file <path>` (`--branch` sets the blob branch). Cross-host targets are not
expressible this way (per-segment encoding would mangle a `scheme:` prefix).

## Validation (verify-or-explain)

A client must check, and on any failure show a specific message (never a blank
result box):

1. the index is **fetchable** (else: 404 / network / no CORS);
2. it is **valid JSON**;
3. `v` is **supported** (else: format vN unsupported — app or index out of date);
4. `site.urlTemplate` is present and contains `{page}`;
5. `docs` is a non-empty array, each entry having `page`, `title`, `text`.

## Versioning

`v` increases only on a breaking change to this shape. Additive, optional fields
do **not** bump `v`; clients ignore unknown fields. A client that meets a higher
`v` than it knows stops and says so rather than guessing.

The reference builder that emits this is `builder/wiki-index.mjs`.
