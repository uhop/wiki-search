// bookmarklet/stub.js — the permanent thin stub (Path P).
//
// This is ALL the bookmarklet ever contains: a window.open to our own origin.
// Every bit of logic, the engine, the index handling, and any future update
// lives in the app on our origin — never frozen into the bookmark. The opened
// window is a new top-level browsing context on our origin, so the host page's
// CSP does not govern it (the Flipboard "Flip It" pattern).
//
// build.mjs inlines __APP_URL__ and minifies this into a `javascript:` URL.
(function () {
  var APP = '__APP_URL__';
  // Carry the current wiki repo through so the app can derive its index, when
  // we're on a github.com/<owner>/<repo>/wiki/... page. Harmless elsewhere.
  var m = location.href.match(/github\.com\/([^/]+)\/([^/]+)\/wiki/);
  var url = APP + (m ? (APP.indexOf('?') < 0 ? '?' : '&') + 'wiki=' + m[1] + '/' + m[2] : '');
  // Note: no 'noopener' feature — it forces window.open to return null, which
  // would defeat the pop-up-blocked check below. The app never reads window.opener.
  var w = window.open(url, 'wiki-search', 'popup,width=560,height=720');
  if (!w) alert('wiki-search: allow pop-ups for this site, then click the bookmark again.');
})();
