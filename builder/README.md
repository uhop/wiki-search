# builder — `wiki-index`

Turns a directory of GitHub-wiki Markdown into a self-describing
[v1 index](../INDEX-FORMAT.md). Dependency-free; deterministic output so a CI
`git diff --exit-code` can gate a stale committed index.

```bash
# Build the index for our own wiki (owner/repo + template inferred from git origin)
node builder/wiki-index.mjs --wiki ./wiki                 # → wiki/search-index.json
node builder/wiki-index.mjs --wiki ./wiki --stdout        # print instead of writing

# Any other site: give the template explicitly
node builder/wiki-index.mjs --wiki ./docs --url-template 'https://example.com/d/{page}' --name 'Example docs'

# Fold the repo README (and more) into the wiki index — results deep-link to the
# rendered file on GitHub. Paths are relative to the current directory.
node builder/wiki-index.mjs --wiki ./wiki --file README.md --file CONTRIBUTING.md
```

| Flag                   | Default                    | Meaning                                                 |
| ---------------------- | -------------------------- | ------------------------------------------------------- |
| `--wiki <dir>`         | `./wiki`                   | Markdown source directory.                              |
| `--out <path>`         | `<wiki>/search-index.json` | Where to write.                                         |
| `--stdout`             | —                          | Print the index instead of writing a file.              |
| `--url-template <tpl>` | inferred                   | Result-URL template; must contain `{page}`.             |
| `--repo <owner/repo>`  | inferred                   | Build the GitHub template from this.                    |
| `--name <str>`         | `<repo> wiki`              | `site.name`.                                            |
| `--file <path>`        | —                          | Fold a repo file (e.g. `README.md`) in. Repeatable.     |
| `--branch <name>`      | inferred                   | Blob branch for `--file` links (repo's default branch). |
| `--help`               | —                          | Print usage and exit.                                   |
| `--version`            | —                          | Print the version and exit.                             |

Unknown flags and stray arguments are rejected with usage on stderr and exit code
`2` — nothing is written. (The default action writes `./wiki/search-index.json`,
so a typo must not fall through to it.)

What it does: one section per ATX heading (plus a page-top preamble section),
GitHub-style heading anchors with `-1`/`-2` disambiguation, `#`-in-code-fence
ignored, markdown reduced to plain text for the engine. Pages named `_*.md`
(`_Sidebar`, `_Footer`) are treated as chrome and skipped.

`--file` folds a repo file in alongside the wiki pages. Its result link is a
relative `{page}` (`../blob/<branch>/<path>`) that resolves against the wiki URL —
`…/wiki/../blob/<branch>/<path>`, normalized by the browser to
`…/blob/<branch>/<path>`. Assumes the GitHub wiki URL layout; see
[INDEX-FORMAT.md](../INDEX-FORMAT.md#folding-in-non-wiki-files).

Tests: `node builder/test/run.mjs`.
