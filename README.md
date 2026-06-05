# wiki-search

A reusable, self-describing search kit for any wiki or docs site. Generate a
versioned JSON index from your docs, host it anywhere CORS-readable, and point a
hosted search app and/or a bookmarklet at it. Clients assume nothing beyond a
self-describing JSON contract; every failure explains itself.

It exists because open GitHub wikis are great for docs but have no good search —
and their CSP blocks on-page search engines. wiki-search bolts search *beside*
the wiki instead of migrating docs away from it.

> **Status: early.** The architecture is designed (see below) and the **S1
> spike** — proving the approach end-to-end — is in `spikes/s1/`. The
> production builder and app are being built out phase by phase.

## How it works — Path P

The bookmarklet is a permanent thin `window.open` stub; all logic lives in a
GitHub Pages app **on our own origin**. A `window.open`ed window is a new
top-level browsing context, so the host wiki page's CSP doesn't govern it — the
app has full engine freedom and is updatable without re-saving the bookmark (the
Flipboard "Flip It" pattern). Results are real `<a>` links carrying
[Text Fragment](https://developer.mozilla.org/docs/Web/Text_fragments)
directives (`#anchor:~:text=…`) so clicking one lands on — and highlights — the
matched section.

The index is a versioned, self-describing JSON document: it carries its own
`site.urlTemplate`, so result URLs are built mechanically with no hardcoded host.
That's what makes the kit reusable beyond any one site.

## Layout

| Path | What |
|------|------|
| `app/` | The search page (loads + validates an index, searches, links out). |
| `engine/` | Search core (swappable; engine choice TBD). |
| `bookmarklet/` | The `window.open` stub + minifier (`build.mjs`). |
| `spikes/s1/` | The Path-P end-to-end spike: sample index, run notes, smoke test. |

## Try the spike

```bash
node spikes/s1/smoke.mjs          # headless: ranked results + text-fragment URLs
python3 -m http.server 8080       # then open http://localhost:8080/app/
```

See [`spikes/s1/NOTES.md`](spikes/s1/NOTES.md) for the full run, the real-CSP
bookmarklet test, and go/no-go criteria.

## License

[BSD-3-Clause](LICENSE)
