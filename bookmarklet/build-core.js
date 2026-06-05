// bookmarklet/build-core.js — shared bookmarklet builder (Node + browser).
//
// Inlines the app URL into the stub source and minifies it into a
// drag-to-bookmarks `javascript:` URL. Pure string ops, zero deps — the same
// code runs in build.mjs (Node, fixed app URL) and at runtime in the app +
// landing page (where the app URL is derived from `location`, so a fork's
// bookmarklet automatically points at the fork's own Pages app).
export const buildBookmarklet = (stubSrc, appUrl) => {
  const body = stubSrc
    .replace(/^\s*\/\/.*$/gm, '')            // strip full-line comments first (they mention the token)
    .replaceAll('__APP_URL__', () => appUrl) // function form: appUrl is treated literally ($ safe)
    .replace(/\n\s*/g, ' ')                  // collapse newlines + indentation
    .replace(/\s{2,}/g, ' ')
    .trim();
  // encodeURIComponent keeps the bookmarklet robust if pasted into HTML/attrs.
  return 'javascript:' + encodeURIComponent(body);
};
