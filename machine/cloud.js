/* ═══════════════════════════════════════════════════════════════════════════
   THE MARKETING CLOUD — the Catalogue's two-row carousel, ported for the
   main page. Self-contained: its own data, builders and drift loop, so
   b.js knows nothing about it. The product data is a copy of the cloud
   suite in catalogue.js (id, name, line only); asset paths are absolute
   because this page is served at both / and /machine/b.html.

   Learn more: every card carries data-cta="possible", so b.js's delegated
   [data-cta] handler opens its "See what's possible" modal — the wider
   Stagwell AI product pool — instead of the Catalogue's per-product modal.
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

/* the cloud suite, copied from catalogue.js — name and line only */
const PRODUCTS = [
  { id: 'koalifyed',        name: 'IMAI',        line: 'Influencer Marketing AI' },
  { id: 'doreel',           name: 'DoReel',      line: 'Creative at the speed of the insight' },
  { id: 'newvoices',        name: 'NewVoices',   line: 'Voice agents that hold a real conversation' },
  { id: 'bera',             name: 'BERA.ai',     line: 'Brand equity, priced in dollars' },
  { id: 'harrisquest',      name: 'HarrisQuest', line: 'Ask the market, get an answer today' },
  { id: 'people-platform',  name: 'Numetrix',    line: 'What people actually do, not what they say' },
  { id: 'knowledge-machine', name: 'Pulse',      line: 'Everything your organisation knows, answerable' },
  { id: 'newindex',         name: 'NewIndex',    line: 'How AI answers describe you' },
  { id: 'geopulse',         name: 'GEOPulse',    line: 'Show up where the answer is written' },
  { id: 'agent-cloud',      name: 'Agent Cloud', line: 'Ten marketing agents, and the models behind them' },
];

/* house order: the three we build lead the row, BERA closes it */
const BIG = ['koalifyed', 'doreel', 'newvoices', 'bera'];

const voice = () => `<div class="ca-voice">${Array.from({ length: 7 },
  (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>`;

const BIGART = {
  newvoices: ['fcard--dark', voice()],
  bera:      ['fcard--img',
    `<img class="fcard__img" src="/assets/img/bera.jpg" alt="" loading="lazy">`],
  doreel:    ['fcard--amber fcard--video',
    `<video class="fcard__video" src="/assets/img/doreel.mp4" autoplay muted loop playsinline></video>`],
  koalifyed: ['fcard--teal fcard--video',
    `<video class="fcard__video" src="/assets/img/imai.mp4" autoplay muted loop playsinline></video>`],
};

/* one framed dashboard fragment per small card — the Catalogue's minis */
const SMMINI = {
  harrisquest: `<span class="cmini mini-ask">
      <svg viewBox="0 0 12 12" width="9" height="9"><circle cx="5.2" cy="5.2" r="3.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 8l2.6 2.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      <b>Would buyers pay more for repairability?</b><i class="mini-caret"></i></span>`,
  newindex: `<span class="cmini mini-row">
      <i class="pulse"></i><b>Ranked&nbsp;<u>#1</u>&nbsp;in AI answers</b><em class="up">↑ 2</em></span>`,
  geopulse: `<span class="cmini mini-col">
      <svg viewBox="0 0 96 26" aria-hidden="true"><path class="mini-line" d="M2,22 L18,19 L34,21 L50,13 L66,15 L82,6 L94,3"
        fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <b>Answer share, 12 weeks</b></span>`,
  'agent-cloud': `<span class="cmini mini-agents">
      <b class="agchip">Planner</b><b class="agchip">Copy</b><b class="agchip">Testing</b>
      <b class="agchip agchip--more">+7</b></span>`,
  'people-platform': `<span class="cmini mini-saydo">
      <span><b>Say</b><span class="mini-bar"><i style="--w:34%"></i></span><em>34%</em></span>
      <span><b>Do</b><span class="mini-bar"><i style="--w:61%"></i></span><em>61%</em></span></span>`,
};

const P = id => PRODUCTS.find(p => p.id === id);

const bigCard = p => {
  const [cls, art] = BIGART[p.id];
  return `<button class="fcard ${cls}" data-cta="possible">
    <span class="fcard__art">${art}</span>
    <span class="fcard__k">TMC</span>
    <span class="fcard__t"><b>${esc(p.name)}</b><i>${esc(p.line)}</i>
      <em class="btn btn--sm">Learn more</em></span>
  </button>`;
};
const smCard = p => `<button class="scard" data-cta="possible">
    <span class="scard__t"><b>${esc(p.name)}</b><i>${esc(p.line)}</i></span>
    ${SMMINI[p.id] ? `<span class="scard__mini">${SMMINI[p.id]}</span>` : ''}
    <em class="btn btn--xs">Learn more</em>
  </button>`;

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
