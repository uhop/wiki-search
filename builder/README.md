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
```

| Flag                   | Default                    | Meaning                                     |
| ---------------------- | -------------------------- | ------------------------------------------- |
| `--wiki <dir>`         | `./wiki`                   | Markdown source directory.                  |
| `--out <path>`         | `<wiki>/search-index.json` | Where to write.                             |
| `--stdout`             | —                          | Print the index instead of writing a file.  |
| `--url-template <tpl>` | inferred                   | Result-URL template; must contain `{page}`. |
| `--repo <owner/repo>`  | inferred                   | Build the GitHub template from this.        |
| `--name <str>`         | `<repo> wiki`              | `site.name`.                                |

What it does: one section per ATX heading (plus a page-top preamble section),
GitHub-style heading anchors with `-1`/`-2` disambiguation, `#`-in-code-fence
ignored, markdown reduced to plain text for the engine. Pages named `_*.md`
(`_Sidebar`, `_Footer`) are treated as chrome and skipped.

Tests: `node builder/test/run.mjs`.
