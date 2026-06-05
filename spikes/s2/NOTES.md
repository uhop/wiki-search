# S2 — text-fragment positioning

**Goal.** Confirm a result click lands on — and highlights — the right wiki
section, across browsers; spike **same-tab** navigation; confirm graceful
**anchor-only fallback** where Text Fragments are unsupported; and pin down
GitHub's `user-content-<slug>` anchor-id quirk. Builds on S1 (`../s1/NOTES.md`).

## What's here

- `positioning-test.html` + `positioning-test.js` — a **deterministic local probe**.
  It emulates a GitHub wiki page (headings carry `id="user-content-<slug>"`, no
  bare `#slug`, plus a GitHub-style scroll shim) and offers one link per fragment
  strategy. It isolates the **browser** mechanics; it does **not** tell you how
  GitHub's real shim behaves — that stays a real-page check below.
- The **app** (`../../app/`) gained S2 levers in its settings row: target
  (new / reused / original tab), `#anchor` on/off, `:~:text=` on/off, and a
  text-fragment support readout. Drive them with `?target=`, `?anchor=off`,
  `?text=off` to A/B on a real wiki page.

## Run — local probe (deterministic, any browser)

```bash
python3 -m http.server 8080      # repo root
# open http://localhost:8080/spikes/s2/positioning-test.html
```

Click each strategy and watch this page scroll/highlight:

| Strategy | URL form | Expects |
|----------|----------|---------|
| `#anchor only` | `#streamarray` | scroll only (via the GitHub-style shim → `user-content-streamarray`) |
| `#user-content-id` | `#user-content-streamarray` | scroll only (native id match) |
| `:~:text= only` | `#:~:text=bounded` | highlight "bounded" (supporting browsers); no element scroll |
| `#anchor + :~:text=` | `#streamarray:~:text=bounded` | **both** — scroll to the section *and* highlight (the app's format) |

Repeat in an old browser (or with `:~:text=` strategies) to see the no-highlight
fallback. The probe's readout shows whether `Document.fragmentDirective` is
present.

## Run — the real gate (on GitHub)

Text Fragments + GitHub's own shim only behave authentically on a real page.
From the S1 bookmarklet popup (or the served app), search stream-json and click
results, toggling the settings levers. Verify on each target browser.

## Cross-browser checklist (manual — fill in)

Text Fragments: **Chrome/Edge** (since 2020), **Safari 18.2+** (Dec 2024),
**Firefox 131+** (Oct 2024). Everything older → anchor-only.

| Browser | highlight fires (new tab) | #anchor scroll fallback | reused-tab (named target) highlight | notes |
|---------|---------------------------|-------------------------|-------------------------------------|-------|
| Chrome / Edge | ☐ | ☐ | ☐ | |
| Firefox ≥131 | ☐ | ☐ | ☐ | |
| Safari ≥18.2 | ☐ | ☐ | ☐ | |
| an older browser | n/a | ☐ | n/a | fallback must still scroll |

## The GitHub `user-content-` anchor quirk

GitHub renders a wiki heading "Options" as roughly
`<h2><a id="user-content-options" href="#options">…</a>Options</h2>` — the **id
is prefixed** `user-content-`, while the link target is the bare `#options`.
A native browser jump to `#options` finds no element; GitHub's client-side script
scrolls to `user-content-options`. Consequences for us:

- **`:~:text=` is the reliable positioner** — it's browser-native and ignores
  the id mismatch entirely. Treat it as primary.
- **`#anchor` (bare slug) is a best-effort fallback** that depends on GitHub's
  shim. The index stores the bare slug (the form GitHub's own links use).
- **Scroll conflict — RESOLVED (confirmed live 2026-06-04).** On GitHub a
  `#slug:~:text=…` URL triggers *both* the shim's scroll-to-`user-content-slug`
  and the text-directive scroll; the shim wins, so you land at the anchored
  section while the highlight sits at the first match elsewhere on the page.
  **Fix shipped:** `app/app.js` `resultUrl()` emits the text directive *instead
  of* the `#anchor` on GitHub (the anchor is kept only as the no-text fallback,
  and still paired with text on non-GitHub sites, where the spec lets the
  directive win). Paired with phrase-widening + heading-preference in
  `engine/phrase.js` so the directive lands in the right section. `?anchor=off`
  remains as an A/B lever.

## Same-tab spike — findings

Three target modes (app setting / `?target=`):

- **`new` (default, `_blank`)** — guaranteed fresh tab; text fragment fires.
- **`tab` (reused named target `wiki-search-result`)** — a real `<a target=…>`
  click is still *user-initiated*, so text fragments **keep working** while all
  results share one tab. **This is the recommended same-tab answer.**
- **`opener` (navigate the original wiki tab via `window.opener.location`)** —
  truly the same tab the user came from, but it's a **script-initiated**
  navigation, so the text directive does **not** activate — only `#anchor`
  scroll (if the shim cooperates). Highlight is lost. Kept as a mode to make the
  trade-off visible; not recommended.

Takeaway: prefer a **reused named tab** over opener-navigation — it's the only
same-tab option that preserves the highlight.

## Go / no-go

| # | Checks | Pass = |
|---|--------|--------|
| G1 | `#anchor + :~:text=` highlights in all three modern engines (new tab) | visible highlight |
| G2 | Anchor-only fallback scrolls where `:~:text=` is unsupported | section in view |
| G3 | Reused-tab (named target) keeps the highlight | highlight + one tab reused |
| G4 | No disruptive scroll conflict from GitHub's shim | RESOLVED: anchor dropped on GitHub when text is emitted |

G1–G2 are the hard gate. G4 is resolved (drop `#anchor` on GitHub when a text
directive is present; keep both elsewhere) in `app/app.js`. Same-tab in v1 vs
new-tab-only is still an open queue decision; this spike says reused-tab is
viable and highlight-preserving.
