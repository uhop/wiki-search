# Filters

## Pick: by path

Pick selects a sub-stream by matching a [filter](https://example.test) against
the current path. The colon in this heading should drop out of the slug. See
also [[Parser]] and [[the parser options|Parser]].

## Replace — in place

Replace swaps matched values. The em dash with surrounding spaces should yield a
double hyphen in the slug, matching GitHub.

## 4.2.2 &mdash; 2026-05-29

A heading written with the &mdash; entity (not a literal em dash) must slug the
same way GitHub does: the entity is decoded to — before slugging, so the result
is 422--2026-05-29, not 422-mdash-2026-05-29.

## See the [docs](https://example.test/docs) page

A heading containing a Markdown link must slug from the link TEXT only — the URL
must not leak, so this is see-the-docs-page (not …docs-page with the href in it).

## Build [![CI][ci-img]][ci-url]

A heading ending in a badge (an image inside a link) reduces to "Build ": the
image contributes no text and the trailing space becomes an edge hyphen, matching
GitHub (build-), while the stored display heading is trimmed to "Build".

[ci-img]: https://img.shields.io/badge/ci-pass-green.svg
[ci-url]: https://example.test/ci
