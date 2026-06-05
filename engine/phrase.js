// engine/phrase.js — shared Text-Fragment phrase + display-snippet helpers, used
// by both engines (engine/search.js, engine/minisearch.js) so a hit links and
// highlights identically regardless of which engine ranked it.
//
// A result URL carries `:~:text=<phrase>`. The phrase must be a verbatim slice of
// on-page text AND distinctive enough to land in THIS section, not the first
// generic match elsewhere on the page. So we:
//   1. prefer a match in the section heading (it is usually why the section
//      ranked, and lands the reader right at the section title);
//   2. else match the body;
//   3. widen a bare single-word match to a few neighbouring words.

export const pickPhrase = (text, query, heading = '') =>
  locate(heading, query) ?? locate(text, query);

// Best phrase for `query` within `src`, or null if no query term appears.
const locate = (src, query) => {
  if (!src) return null;
  const hay = src.toLowerCase();
  const whole = query.trim().toLowerCase();
  let at = whole && hay.includes(whole) ? hay.indexOf(whole) : -1;
  let len = whole.length;
  if (at < 0) {
    const words = [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1))]
      .sort((a, b) => b.length - a.length);
    for (const w of words) {
      const i = hay.indexOf(w);
      if (i >= 0) { at = i; len = w.length; break; }
    }
  }
  if (at < 0) return null;
  return len >= 12 ? src.slice(at, at + len) : widen(src, at, len);
};

// Grow [at, at+len) to include up to two preceding whole words (or following
// words when the match is at the start), so a short match is distinctive.
const widen = (text, at, len) => {
  let start = at;
  for (let n = 0; n < 2 && start > 0; ++n) {
    let s = start;
    while (s > 0 && /\s/.test(text[s - 1])) --s; // skip the gap
    while (s > 0 && /\S/.test(text[s - 1])) --s; // skip the word
    if (s === start) break;
    start = s;
  }
  let end = at + len;
  for (let n = 0; n < 2 && start === at && end < text.length; ++n) {
    let e = end;
    while (e < text.length && /\s/.test(text[e])) ++e;
    while (e < text.length && /\S/.test(text[e])) ++e;
    if (e === end) break;
    end = e;
  }
  return text.slice(start, end).trim();
};

// A short display window around the matched phrase (for the result snippet).
export const snippetAround = (text, phrase) => {
  if (!phrase) return text.slice(0, 160);
  const at = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (at < 0) return text.slice(0, 160);
  const start = Math.max(0, at - 60);
  const end = Math.min(text.length, at + phrase.length + 100);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
};
