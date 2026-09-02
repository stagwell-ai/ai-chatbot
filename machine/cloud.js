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

/* every product carries its own ambient film (rendered Aug 26, from
   assets/seedance-carousel-prompts.txt) at /assets/img/cloud/<id>.mp4 with
   a matching poster frame — the poster keeps the tile from going blank on
   iOS data-saver, which defers video bytes. All ten films ride the big
   band up top (IMAI leads; the engine centres it on load); the small band
   below re-introduces each company by NAME — icon, name, description —
   drifting the other way. */
const BIG = ['imai', 'questbrand', 'questdiy', 'bera', 'unlock',
  'knowledge-machine', 'unicepta', 'geopulse', 'targeting-machine', 'numetrix'];

/* one line icon per company — themed to its solution, drawn in-house */
const I = d => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none"
    stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
  questbrand:         I('<path d="M3 18l5-6 4 3 6-8"/><path d="M3 21h18" opacity=".4"/>'),
  questdiy:           I('<rect x="4" y="3" width="16" height="18" rx="2.5"/><circle cx="8.6" cy="8.5" r="1.2"/><path d="M12 8.5h4.6"/><circle cx="8.6" cy="12.5" r="1.2"/><path d="M12 12.5h4.6"/><circle cx="8.6" cy="16.5" r="1.2"/><path d="M12 16.5h3"/>'),
  bera:               I('<path d="M12 21V11"/><path d="M12 14c0-3 2.4-4.6 5-5"/><path d="M12 11c0-3-2.4-4.6-5-5"/><circle cx="18.6" cy="8.4" r="1.8"/><circle cx="5.4" cy="5.4" r="1.8"/><circle cx="12" cy="21" r="0.4"/>'),
  unlock:             I('<circle cx="9" cy="8.6" r="3.1"/><path d="M3.6 19.4c.7-3 2.9-4.8 5.4-4.8s4.7 1.8 5.4 4.8"/><circle cx="16.8" cy="9.6" r="2.4" opacity=".55"/><path d="M15.2 14.9c2.4-.4 4.6 1 5.4 3.6" opacity=".55"/>'),
  'knowledge-machine': I('<circle cx="12" cy="12" r="2"/><path d="M12 5.5a6.5 6.5 0 016.5 6.5" opacity=".85"/><path d="M12 2a10 10 0 0110 10" opacity=".45"/><path d="M12 12l5.4 5.4"/>'),
  unicepta:           I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c-5.5 5.4-5.5 12.6 0 18"/><path d="M12 3c5.5 5.4 5.5 12.6 0 18"/>'),
  imai:               I('<circle cx="11" cy="9" r="3.2"/><path d="M5 20c.8-3.4 3.2-5.4 6-5.4 1.4 0 2.7.5 3.8 1.4"/><path d="M18 13.6l.9 2 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>'),
  geopulse:           I('<circle cx="10.5" cy="10.5" r="6.2"/><path d="M15.3 15.3L21 21"/><path d="M10.5 7.6l.9 2 2.1.3-1.6 1.4.4 2.1-1.8-1-1.8 1 .4-2.1-1.6-1.4 2.1-.3z" stroke-width="1.2"/>'),
  'targeting-machine': I('<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.6" opacity=".6"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3" opacity=".5"/>'),
  numetrix:           I('<path d="M12 21s6.4-5.5 6.4-10.4A6.4 6.4 0 0012 4.2a6.4 6.4 0 00-6.4 6.4C5.6 15.5 12 21 12 21z"/><circle cx="12" cy="10.6" r="2.1"/>'),
};

const P = id => PRODUCTS.find(p => p.id === id);

/* the same attribution every other surface sends (path.js attributedUrl,
   solution.js/campaign.js withUtm) — these forty links were the only external
   doors on the site that left without it (QA, Sep 2) */
function withUtm(url) {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', 'stagwell-ai');
    u.searchParams.set('utm_medium', 'home-carousel');
    u.searchParams.set('utm_campaign', 'master');
    return u.toString();
  } catch (e) { return url; }
}

const bigCard = p => `<a class="fcard fcard--dark fcard--video" href="${esc(withUtm(p.url))}" target="_blank" rel="noopener">
    <span class="fcard__art"><video class="fcard__video" src="/assets/img/cloud/${p.id}.mp4"
      poster="/assets/img/cloud/${p.id}.jpg" autoplay muted loop playsinline></video></span>
    <span class="fcard__k">${esc(p.name)}</span>
    <span class="fcard__t"><b>${esc(p.title)}</b><i>${esc(p.line)}</i>
      <em class="btn btn--sm">Visit site ↗</em></span>
  </a>`;

/* the small card leads with the company itself: icon, name, description */
const smCard = p => `<a class="scard" href="${esc(withUtm(p.url))}" target="_blank" rel="noopener">
    <span class="scard__ico">${ICONS[p.id] || ''}</span>
    <span class="scard__t"><b>${esc(p.name)}</b><i>${esc(p.line)}</i></span>
    <em class="btn btn--xs">Visit site ↗</em>
  </a>`;

/* each row is its content twice, so translateX(-50%) loops seamlessly */
const bigRow = BIG.map(id => bigCard(P(id))).join('');
const smRow = PRODUCTS.map(smCard).join('');
flowBig.insertAdjacentHTML('afterbegin', `<div class="flow__row">${bigRow}${bigRow}</div>`);
flowSm.insertAdjacentHTML('afterbegin', `<div class="flow__row">${smRow}${smRow}</div>`);

/* drift and paddles share one offset per row — same engine as the Catalogue */
const FLOWS = [
  /* centre:true parks the big row so its first card — IMAI — sits mid-viewport
     on load, holds long enough to be read, then drifts left */
  { el: $('#flowBig .flow__row'), dir: 1, speed: 24, off: 0, vel: 0, centre: true },
  { el: $('#flowSm .flow__row'), dir: -1, speed: 20, off: 0, vel: 0 },
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
