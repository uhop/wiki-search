// builder/lib/slug.mjs — GitHub-style heading slugs (approximates github-slugger).
//
// GitHub lowercases a heading, strips most punctuation, turns spaces into
// hyphens, and disambiguates repeats *within a page* as -1, -2, …. This is a
// close approximation, good enough for English docs; verified against real
// rendered GitHub wiki pages.

// NB: no .trim() — GitHub does not strip a heading's leading/trailing whitespace
// before slugging, so an edge space becomes an edge hyphen (a heading reduced to
// "Tool " slugs to "tool-"). The caller passes the text to slug verbatim
// (entity-decoded + markdown-reduced); display-text trimming happens separately.
export const slugify = text =>
  text
    .toLowerCase()
    .replace(/\s+/g, ' ') // collapse interior whitespace runs, as HTML rendering does
    .replace(/[^\p{L}\p{N}_ -]+/gu, '') // drop punctuation/symbols (em dash, quotes, colon, parens…)
    .replace(/ /g, '-'); // each remaining space → one hyphen (edges included), so a
// removed char between two spaces yields "--", matching github-slugger

// A per-page deduping slugger: call the returned fn on each heading in document
// order so duplicates get GitHub's -1 / -2 / … suffixes.
export const createSlugger = () => {
  const seen = new Map();
  return text => {
    const base = slugify(text);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n}`;
  };
};
