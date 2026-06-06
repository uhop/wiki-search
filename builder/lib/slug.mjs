// builder/lib/slug.mjs — GitHub-style heading slugs (approximates github-slugger).
//
// GitHub lowercases a heading, strips most punctuation, turns spaces into
// hyphens, and disambiguates repeats *within a page* as -1, -2, …. This is a
// close approximation, good enough for English docs; verified against real
// rendered GitHub wiki pages.

export const slugify = text =>
  text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // collapse source whitespace, as HTML rendering does
    .replace(/[^\p{L}\p{N}_ -]+/gu, '') // drop punctuation/symbols (em dash, quotes, colon, parens…)
    .replace(/ /g, '-'); // each remaining space → one hyphen, so a removed char
// between two spaces yields "--", matching github-slugger

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
