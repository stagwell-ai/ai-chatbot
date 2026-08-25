/* ═══════════════════════════════════════════════════════════════════════════
   THE MARKETING CLOUD — the Catalogue's two-row carousel, ported for the
   main page. Self-contained: its own data, builders and drift loop, so
   b.js knows nothing about it. Ten products, client-supplied (Aug 25):
   solution-oriented copy leads each card — the product name is the kicker,
   the solution title is the headline — and every card is a real link out
   to that product's own site, not a modal trigger.

   Cards are plain <a target="_blank" rel="noopener"> elements pointing at
   the client-supplied destination URLs — real outbound links, not modal
   triggers, and no dependency on b.js's "See what's possible" handler.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* the section may not be on the page at all — then this file is a no-op */
const flowBig = $('#flowBig'), flowSm = $('#flowSm');
if (!flowBig || !flowSm) return;

/* the ten Marketing Cloud products — client spreadsheet, verbatim copy.
   name = product name (the kicker); title = the solution headline;
   line = the solution description; url = the real destination. */
const PRODUCTS = [
  { id: 'questbrand',        name: 'QuestBrand',           title: 'Brand Performance Tracking',
    line: 'Measure brand health, campaign impact, and competitive position daily',
    url: 'https://www.harrisquest.com/suite/questbrand' },
  { id: 'questdiy',          name: 'QuestDIY',             title: 'AI Survey Creation',
    line: 'Build, launch, and analyze consumer research faster with AI assistance',
    url: 'https://www.harrisquest.com/suite/questdiy' },
  { id: 'bera',              name: 'BERA.ai',              title: 'Brand Growth Drivers',
    line: 'Uncover what drives brand performance, ROI, and market value',
    url: 'https://bera.ai' },
  { id: 'unlock',            name: 'Unlock',               title: 'Audience Sampling',
    line: 'Access verified consumer and B2B respondents for research at scale',
    url: 'https://www.themarketingcloud.com/marketplace/unlock' },
  { id: 'knowledge-machine', name: 'The Knowledge Machine', title: 'Reputation Intelligence',
    line: 'Detect emerging risks and understand the emotions driving them',
    url: 'https://www.themarketingcloud.com/marketplace/pulse' },
  { id: 'unicepta',          name: 'UNICEPTA',             title: 'Global Media Monitoring',
    line: 'Monitor media coverage, reputation risks, and stakeholder narratives worldwide',
    url: 'https://www.themarketingcloud.com/marketplace/unicepta' },
  { id: 'imai',              name: 'IMAI',                 title: 'Influencer Campaign Management',
    line: 'Discover creators, manage partnerships, and prove influencer ROI',
    url: 'https://www.themarketingcloud.com/marketplace/imai' },
  { id: 'geopulse',          name: 'GEOPulse',             title: 'AI Search Visibility',
    line: 'See how AI platforms cite, recommend, and describe your brand',
    url: 'https://www.themarketingcloud.com/marketplace/geopulse' },
  { id: 'targeting-machine', name: 'The Targeting Machine', title: 'Audience Activation',
    line: 'Discover, build, and activate audiences using the Stagwell ID Graph',
    url: 'https://www.themarketingcloud.com/marketplace/sats' },
  { id: 'numetrix',          name: 'Numetrix',             title: 'Location Intelligence',
    line: 'Measure audiences, visitation, and advertising impact from movement data',
    url: 'https://www.themarketingcloud.com/marketplace/numetrix' },
];

/* house order: IMAI leads the big row (the engine centres it on load),
   BERA closes it. The small row keeps the sheet's remaining order. */
const BIG = ['imai', 'questbrand', 'geopulse', 'bera'];

const BIGART = {
  imai:       ['fcard--teal fcard--video',
    `<video class="fcard__video" src="/assets/img/imai.mp4" autoplay muted loop playsinline></video>`],
  /* Brand Performance Tracking: a quiet sparkline of bars, on navy */
  questbrand: ['fcard--dark', `<span class="ca-bars">${[34, 48, 40, 60, 52, 74, 66]
    .map(h => `<i style="--h:${h}%"></i>`).join('')}</span>`],
  /* AI Search Visibility: a scatter of citation chips, a few lit up —
     the "your brand, mentioned" motif */
  geopulse:   ['fcard--amber', `<span class="ca-chips">${[0, 1, 0, 0, 1, 0, 1, 0]
    .map(on => `<i${on ? ' class="on"' : ''}></i>`).join('')}</span>`],
  bera:       ['fcard--img',
    `<img class="fcard__img" src="/assets/img/bera.jpg" alt="" loading="lazy">`],
};

/* one framed dashboard fragment per small card — the Catalogue's minis.
   Reused verbatim where a product survives the re-cut; dropped where the
   product it illustrated is no longer in the lineup. */
const SMMINI = {
  questdiy: `<span class="cmini mini-ask">
      <svg viewBox="0 0 12 12" width="9" height="9"><circle cx="5.2" cy="5.2" r="3.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 8l2.6 2.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      <b>Would buyers pay more for repairability?</b><i class="mini-caret"></i></span>`,
  numetrix: `<span class="cmini mini-saydo">
      <span><b>Say</b><span class="mini-bar"><i style="--w:34%"></i></span><em>34%</em></span>
      <span><b>Do</b><span class="mini-bar"><i style="--w:61%"></i></span><em>61%</em></span></span>`,
};

const P = id => PRODUCTS.find(p => p.id === id);

const bigCard = p => {
  const [cls, art] = BIGART[p.id];
  return `<a class="fcard ${cls}" href="${esc(p.url)}" target="_blank" rel="noopener">
    <span class="fcard__art">${art}</span>
    <span class="fcard__k">${esc(p.name)}</span>
    <span class="fcard__t"><b>${esc(p.title)}</b><i>${esc(p.line)}</i>
      <em class="btn btn--sm">Visit site ↗</em></span>
  </a>`;
};
const smCard = p => `<a class="scard" href="${esc(p.url)}" target="_blank" rel="noopener">
    <span class="scard__t"><b>${esc(p.title)}</b><i>${esc(p.line)}</i></span>
    ${SMMINI[p.id] ? `<span class="scard__mini">${SMMINI[p.id]}</span>` : ''}
    <em class="btn btn--xs">Visit site ↗</em>
  </a>`;

/* each row is its content twice, so translateX(-50%) loops seamlessly */
const bigRow = BIG.map(id => bigCard(P(id))).join('');
const smRow = PRODUCTS.filter(p => !BIG.includes(p.id)).map(smCard).join('');
flowBig.insertAdjacentHTML('afterbegin', `<div class="flow__row">${bigRow}${bigRow}</div>`);
flowSm.insertAdjacentHTML('afterbegin', `<div class="flow__row">${smRow}${smRow}</div>`);

/* drift and paddles share one offset per row — same engine as the Catalogue */
const FLOWS = [
  /* centre:true parks the big row so its first card — IMAI — sits mid-viewport
     on load, holds long enough to be read, then drifts left */
  { el: $('#flowBig .flow__row'), dir: 1, speed: 24, off: 0, vel: 0, centre: true },
  { el: $('#flowSm .flow__row'), dir: -1, speed: 30, off: 0, vel: 0 },
];

const HOLD = 1600;
function centreFirst(f, now) {
  const half = f.el.scrollWidth / 2;
  const card = f.el.firstElementChild;
  if (!half || !card) return false;
  const wrapW = f.el.parentElement.getBoundingClientRect().width;
  const cardW = card.getBoundingClientRect().width;
  f.off = half - Math.max(0, (wrapW - cardW) / 2);
  f.pauseUntil = now + HOLD;
  return true;
}
FLOWS.forEach(f => {
  f.el.parentElement.addEventListener('mouseenter', () => { f.hover = true; });
  f.el.parentElement.addEventListener('mouseleave', () => { f.hover = false; });
});
const mod = (n, m) => ((n % m) + m) % m;
let last = performance.now();
(function drift(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  FLOWS.forEach(f => {
    if (f.centre && centreFirst(f, now)) f.centre = false;
    if (!REDUCED && !f.hover && now > (f.pauseUntil || 0)) f.off += f.dir * f.speed * dt;
    f.off += f.vel * dt;
    f.vel *= Math.pow(0.0016, dt);            // paddle impulse eases out
    if (Math.abs(f.vel) < 1) f.vel = 0;
    const half = f.el.scrollWidth / 2;
    if (half > 0) f.el.style.transform = `translateX(${-mod(f.off, half)}px)`;
  });
  requestAnimationFrame(drift);
})(last);

function nudge(f, sign) {
  const card = f.el.firstElementChild;
  const w = (card ? card.getBoundingClientRect().width + 12 : 320);
  f.vel = sign * w * 4.2;                   // decays to ~one card of travel
  f.pauseUntil = performance.now() + 2200;  // the drift waits while you steer
}
$('#bigNext')?.addEventListener('click', () => nudge(FLOWS[0], 1));
$('#bigPrev')?.addEventListener('click', () => nudge(FLOWS[0], -1));
$('#cloudNext')?.addEventListener('click', () => nudge(FLOWS[1], 1));
$('#cloudPrev')?.addEventListener('click', () => nudge(FLOWS[1], -1));

})();
