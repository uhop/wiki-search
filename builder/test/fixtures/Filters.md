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
