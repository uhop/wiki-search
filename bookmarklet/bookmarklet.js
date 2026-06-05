// bookmarklet/bookmarklet.js — the wiki-search bookmarklet, in one place.
//
// It's a thin launcher: open the search app on its OWN origin (so the wiki
// page's content-security policy doesn't govern it — the Flipboard "Flip It"
// pattern) and hand it the URL of the page you're on. Everything else — wiki
// detection, the engine, the index, positioning — lives in the app and is
// fetched fresh on every click, so a bookmark dragged once auto-updates whenever
// the app is redeployed. The ONLY thing frozen into a saved bookmark is APP_URL.
//
// Because of that, treat APP_URL as a permanent commitment: don't rename the
// repo/org (it changes the Pages URL), and if you ever must move, leave a
// redirect (or front it with a custom domain) so already-saved bookmarks still
// land. It's the one value the app can't fix after the fact — if the URL is
// wrong, the app is never reached.
export const APP_URL = 'https://uhop.github.io/wiki-search/app/';

// The app parses owner/repo from `from` itself (see resolveIndexUrl), so the
// detection logic stays server-side and a saved bookmark never goes stale on it.
export const BOOKMARKLET =
  `javascript:(()=>{var w=open('${APP_URL}?from='+encodeURIComponent(location.href),` +
  `'wiki-search','popup,width=560,height=720');` +
  `if(!w)alert('wiki-search: allow pop-ups for this site, then click the bookmark again.')})()`;
