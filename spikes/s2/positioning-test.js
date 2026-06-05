// spikes/s2/positioning-test.js — deterministic, local positioning probe for S2.
//
// The page's headings carry id="user-content-<slug>" (no bare #slug id), exactly
// like a rendered GitHub wiki page. We replicate GitHub's scroll shim so the
// #<slug> fallback is testable locally, and expose strategy links so each
// fragment form can be clicked and observed — independent of GitHub's CSP and
// network. What this CAN'T tell you is how GitHub's own shim behaves; that stays
// a real-page check in NOTES.md. This isolates the *browser* mechanics.

const SECTION = { slug: 'streamarray', phrase: 'bounded' };

const STRATEGIES = [
  { label: '#anchor only', hash: `#${SECTION.slug}` },
  { label: '#user-content-id', hash: `#user-content-${SECTION.slug}` },
  { label: ':~:text= only', hash: `#:~:text=${SECTION.phrase}` },
  { label: '#anchor + :~:text=  (app format)', hash: `#${SECTION.slug}:~:text=${SECTION.phrase}` },
];

const supported = 'fragmentDirective' in document;

const detect = document.getElementById('detect');
detect.textContent = supported
  ? '✓ Document.fragmentDirective present — this browser consumes :~:text='
  : '✗ Document.fragmentDirective absent — no highlight; only #anchor scroll';
detect.className = supported ? 'note ok' : 'note warn';

const active = document.getElementById('active');
active.textContent = location.hash
  ? `active fragment: ${decodeURIComponent(location.hash)}`
  : 'active fragment: (none) — pick a strategy below';

// GitHub-style shim: a bare #<slug> has no native target (the id is
// user-content-<slug>), so scroll there ourselves — what GitHub's client does.
const ghShim = () => {
  const raw = decodeURIComponent(location.hash.replace(/^#/, '')).split(':~:')[0];
  if (!raw || document.getElementById(raw)) return;
  const uc = document.getElementById(`user-content-${raw}`);
  if (uc) uc.scrollIntoView({ block: 'start' });
};
addEventListener('load', ghShim);
addEventListener('hashchange', ghShim);

// Each link forces a fresh document load via a unique ?r — a text directive only
// fires on cross-document navigation, never on a same-document hash change.
const nextR = (Number(new URLSearchParams(location.search).get('r')) || 0) + 1;

const link = (hash, target, label) => {
  const a = document.createElement('a');
  a.href = `${location.pathname}?r=${nextR}${hash}`;
  a.target = target;
  if (target === '_blank') a.rel = 'noopener';
  a.textContent = label;
  return a;
};

const grid = document.querySelector('.grid');
for (const s of STRATEGIES) {
  const row = document.createElement('div');
  row.className = 'row';
  const lbl = document.createElement('span');
  lbl.className = 'lbl';
  lbl.textContent = s.label;
  row.append(lbl, link(s.hash, '_self', 'same tab'), link(s.hash, '_blank', 'new tab'));
  grid.append(row);
}
