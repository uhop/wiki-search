// builder/lib/markdown.mjs — split a Markdown page into heading-delimited
// sections and reduce each to searchable plain text. Dependency-free and
// intentionally approximate: it serves retrieval, not faithful rendering.

const FENCE = /^[ \t]*(```|~~~)/;
const ATX = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

// Split markdown into sections. Text before the first heading becomes a
// preamble section with heading=null, level=0. `#` inside fenced code is
// ignored so code comments don't masquerade as headings.
export const splitSections = md => {
  const sections = [{ level: 0, heading: null, lines: [] }];
  let inFence = false;
  for (const line of md.split(/\r?\n/)) {
    if (FENCE.test(line)) inFence = !inFence;
    const m = inFence ? null : ATX.exec(line);
    if (m) sections.push({ level: m[1].length, heading: m[2].trim(), lines: [] });
    else sections.at(-1).lines.push(line);
  }
  return sections
    .map(s => ({ level: s.level, heading: s.heading, text: toPlainText(s.lines.join('\n')) }))
    .filter(s => s.heading || s.text); // drop an empty preamble
};

// Reduce Markdown to plain, collapsed text. Code *text* is kept (API names are
// worth searching) — only the fence delimiters are removed.
export const toPlainText = md =>
  md
    .replace(/^[ \t]*(```|~~~).*$/gm, ' ') // fence delimiters (keep the code text)
    .replace(/`([^`]*)`/g, '$1')           // inline code → its text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // image → alt
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // link → text
    .replace(/<[^>]+>/g, ' ')              // strip HTML tags
    .replace(/^[ \t>]*>+/gm, ' ')          // blockquote markers
    .replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, ' ') // list markers
    .replace(/[*_~]+/g, '')                // emphasis
    .replace(/^\s*\|.*$/gm, m => m.replace(/\|/g, ' ')) // table pipes
    .replace(/^#{1,6}\s+/gm, '')           // stray heading marks
    .replace(/\s+/g, ' ')
    .trim();
