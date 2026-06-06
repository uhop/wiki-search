// builder/lib/markdown.mjs — split a Markdown page into heading-delimited
// sections and reduce each to searchable plain text. Dependency-free and
// intentionally approximate: it serves retrieval, not faithful rendering.

const FENCE = /^[ \t]*(```|~~~)/;
const ATX = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

// Split markdown into sections. Text before the first heading becomes a
// preamble section with heading=null, level=0. `#` inside fenced code is
// ignored so code comments don't masquerade as headings. Headings are
// entity-decoded so the display text and the derived slug match GitHub, which
// renders entities before slugging (see decodeEntities).
export const splitSections = md => {
  const sections = [{level: 0, heading: null, lines: []}];
  let inFence = false;
  for (const line of md.split(/\r?\n/)) {
    if (FENCE.test(line)) inFence = !inFence;
    const m = inFence ? null : ATX.exec(line);
    if (m) sections.push({level: m[1].length, heading: decodeEntities(m[2]).trim(), lines: []});
    else sections.at(-1).lines.push(line);
  }
  return sections
    .map(s => ({level: s.level, heading: s.heading, text: toPlainText(s.lines.join('\n'))}))
    .filter(s => s.heading || s.text); // drop an empty preamble
};

// Common named HTML entities found in wiki prose — typographic punctuation and
// symbols. Each maps to its character so it drops out at tokenization (— is
// punctuation, not a word) instead of surviving as a junk term ("mdash"), and so
// snippets render the glyph rather than the literal "&mdash;".
const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  bull: '•',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
  sect: '§',
  para: '¶',
  deg: '°',
  plusmn: '±',
  times: '×',
  divide: '÷',
  minus: '−',
  frasl: '⁄',
  laquo: '«',
  raquo: '»',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  larr: '←',
  rarr: '→',
  uarr: '↑',
  darr: '↓',
  harr: '↔',
  le: '≤',
  ge: '≥',
  ne: '≠',
  prime: '′',
  Prime: '″'
};

// Resolve HTML entities so they never pollute the term index. Numeric entities
// (&#1234; / &#x1F50D;) decode generally — preserving genuine letters that happen
// to be encoded (&#945; → α) while the typographic noise (&mdash;, arrows, emoji)
// decodes to punctuation/symbols the tokenizer discards. Known named entities map
// via the table above; anything else unknown collapses to a space so it can't
// become a junk term ("mdash", "128269").
const ENTITY_RE = /&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g;
const decodeEntity = (_m, body) => {
  if (body[0] !== '#') return NAMED_ENTITIES[body] ?? ' ';
  const cp =
    body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
  return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ' ';
};

// Resolve every HTML entity in a string to its character. Shared by toPlainText
// (the term index) and the heading path (display text + slug). GitHub renders a
// heading's entities to glyphs before slugging, so "4.2.2 &mdash; 2026-05-29"
// must decode to "4.2.2 — 2026-05-29" first — then the slugger drops the em dash
// and the two flanking spaces collapse to "--" (#422--2026-05-29), exactly as
// GitHub does. Slugging the raw "&mdash;" instead leaks the junk token "mdash".
export const decodeEntities = s => s.replace(ENTITY_RE, decodeEntity);

// Reduce Markdown to plain, collapsed text. Code *text* is kept (API names are
// worth searching) — only the fence delimiters are removed.
export const toPlainText = md =>
  md
    .replace(/^[ \t]*(```|~~~).*$/gm, ' ') // fence delimiters (keep the code text)
    .replace(/`([^`]*)`/g, '$1') // inline code → its text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$1') // [[Display|Page]] wiki link → Display
    .replace(/\[\[([^\]]+)\]\]/g, '$1') // [[Page]] wiki link → Page
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // image → alt
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // link → text
    .replace(/<[^>]+>/g, ' ') // strip HTML tags
    .replace(ENTITY_RE, decodeEntity) // HTML entities → glyph (drops &mdash;/&#1234; noise)
    .replace(/^[ \t>]*>+/gm, ' ') // blockquote markers
    .replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, ' ') // list markers
    .replace(/[*_~]+/g, '') // emphasis
    .replace(/^\s*\|.*$/gm, m => m.replace(/\|/g, ' ')) // table pipes
    .replace(/^#{1,6}\s+/gm, '') // stray heading marks
    .replace(/\s+/g, ' ')
    .trim();
