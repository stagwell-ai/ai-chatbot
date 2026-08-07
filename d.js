/* ═══════════════════════════════════════════════════════════════════════════
   STAGWELL AI — VERSION D  ·  the platform

   One product, capabilities without sub-brands. A structural copy of C's
   behaviors minus the concierge: a hero, a drifting row of capability
   cards, and a modal for the two calls to action. Nothing else.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const { esc, reveal, whenVisible } = window.SWAI;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ══════════════════════ CAPABILITIES ══════════════════════
   No sub-brands, just what the platform does — grouped loosely by
   kicker so the row still reads as four moves, not eight loose cards.
   Each card carries a framed dashboard fragment in C's cmini vocabulary,
   or full-bleed footage where footage says it better than a fragment. */

const CAPABILITIES = [
  { k: 'See',   name: 'Social listening',            line: 'Every mention, everywhere, as it happens.',
    mini: `<span class="cmini mini-feed">
      <span><i class="pulse"></i><b>Mentions up 214% this hour</b><em>now</em></span>
      <span><i class="pulse pulse--amber"></i><b>New thread gaining ground</b><em>12m</em></span></span>` },
  { k: 'See',   name: 'Competitive intelligence',     line: 'Pricing, hiring, coverage — what rivals did this week.',
    mini: `<span class="cmini mini-feed">
      <span><i class="pulse"></i><b>Rival cut prices 4%</b><em>2h</em></span>
      <span><i class="pulse pulse--amber"></i><b>New creator campaign</b><em>9h</em></span></span>` },
  { k: 'See',   name: 'AI & GEO visibility',          line: 'How the answer engines describe you, tracked daily.',
    mini: `<span class="cmini mini-row">
      <i class="pulse"></i><b>Ranked&nbsp;<u>#1</u>&nbsp;in AI answers</b><em class="up">↑ 2</em></span>` },
  { k: 'Reach', name: 'Creator database',             line: '400M profiles, vetted and searchable.',
    media: `<video class="dcap__video" src="./assets/img/imai.mp4" autoplay muted loop playsinline></video>` },
  { k: 'Make',  name: 'AI video-ad creation',         line: 'Presenter video and UGC from a brief, in minutes.',
    media: `<video class="dcap__video" src="./assets/img/doreel.mp4" autoplay muted loop playsinline></video>` },
  { k: 'Make',  name: 'Autonomous creative rotation',  line: 'The winning variant promotes itself.',
    mini: `<span class="cmini mini-col">
      <svg viewBox="0 0 96 26" aria-hidden="true"><path class="mini-line" d="M2,22 L18,19 L34,21 L50,13 L66,15 L82,6 L94,3"
        fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <b>Winning variant, 12 weeks</b></span>` },
  { k: 'Talk',  name: 'AI voice agents',              line: 'Calls answered, qualified and booked, 24/7.',
    mini: `<span class="cmini mini-row">
      <i class="pulse"></i><b>“Booked you in for Tuesday, 2pm.”</b></span>` },
  { k: 'Ask',   name: 'Surveys & brand tracking',      line: 'Ask the market, get an answer today.',
    mini: `<span class="cmini mini-ask">
      <svg viewBox="0 0 12 12" width="9" height="9"><circle cx="5.2" cy="5.2" r="3.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 8l2.6 2.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      <b>Would buyers pay more for repairability?</b><i class="mini-caret"></i></span>` },
];

const capCard = c => c.media
  ? `<button class="scard scard--img dcap dcap--media" type="button">
    <span class="scard__art">${c.media}</span>
    <span class="scard__t"><b>${esc(c.name)}</b><i>${esc(c.line)}</i></span>
    <em class="dcap__k">${esc(c.k)}</em>
  </button>`
  : `<button class="scard dcap" type="button">
    <span class="scard__t"><b>${esc(c.name)}</b><i>${esc(c.line)}</i></span>
    <span class="scard__mini">${c.mini}</span>
    <em class="dcap__k">${esc(c.k)}</em>
  </button>`;

/* the row is its content twice, so translateX(-50%) loops seamlessly */
const doesRow = CAPABILITIES.map(capCard).join('');
$('#flowDoes').insertAdjacentHTML('afterbegin', `<div class="flow__row">${doesRow}${doesRow}</div>`);

/* Drift and paddles share one offset, so the arrows work while the row
   keeps moving. Offset wraps at half the row (content is doubled). */
const FLOWS = [
  { el: $('#flowDoes .flow__row'), dir: 1, speed: 26, off: 0, vel: 0 },
];
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
$('#doesNext').addEventListener('click', () => nudge(FLOWS[0], 1));
$('#doesPrev').addEventListener('click', () => nudge(FLOWS[0], -1));

/* the visibility fragment's movement ticks upward on a loop — a number that lives */
(function rankTick() {
  const els = $$('.mini-row .up');
  if (!els.length || REDUCED) return;
  const steps = [2, 3, 4];
  let i = 0;
  setInterval(() => {
    i = (i + 1) % steps.length;
    els.forEach(el => {
      el.style.opacity = 0;
      setTimeout(() => { el.textContent = `↑ ${steps[i]}`; el.style.opacity = 1; }, 260);
    });
  }, 2800);
})();

/* ══════════════════════ MODAL ══════════════════════ */

const modal = $('#modal'), modalBody = $('#modalBody');
let lastFocus = null;

function showModal(html) {
  lastFocus = document.activeElement;
  modalBody.innerHTML = html;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  $('.modal__x', modal).focus();
}
function closeModal() {
  if (modal.hidden) return;
  modal.hidden = true;
  document.body.style.overflow = '';
  lastFocus?.focus?.();
}
modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function openCall() {
  showModal(`
    <h3 style="margin:0;font-size:1.75rem;font-weight:600;letter-spacing:-.03em">Book a call</h3>
    <p style="margin:8px 0 0;line-height:1.6;color:var(--ink-2)">A specialist who runs these
      products will come back to you within a day.</p>
    <form id="callForm" style="display:flex;flex-direction:column;gap:9px;margin-top:22px">
      <input required type="text"  placeholder="Full name"
        style="height:46px;padding:0 15px;border:1px solid var(--line-2);border-radius:10px;font:inherit">
      <input required type="email" placeholder="Work email"
        style="height:46px;padding:0 15px;border:1px solid var(--line-2);border-radius:10px;font:inherit">
      <button class="btn" type="submit" style="margin-top:4px">Book a call</button>
    </form>
    <p style="margin:14px 0 0;font-family:var(--mono);font-size:var(--t-label);letter-spacing:.09em;
              text-transform:uppercase;color:var(--ink-4)">Prototype — nothing is submitted.</p>`);
  $('#callForm').addEventListener('submit', e => {
    e.preventDefault();
    showModal(`<h3 style="margin:0;font-size:1.75rem;font-weight:600;letter-spacing:-.03em">You’re in.</h3>
      <p style="margin:8px 0 0;line-height:1.6;color:var(--ink-2)">Prototype — nothing was sent.</p>
      <button class="btn" data-close style="margin-top:22px">Close</button>`);
  });
}

function openStart() {
  showModal(`
    <h3 style="margin:0;font-size:1.75rem;font-weight:600;letter-spacing:-.03em">Start free.</h3>
    <p style="margin:8px 0 0;line-height:1.6;color:var(--ink-2)">Create a workspace, connect your
      channels, and the first seat is free — usage-based from there, like a tool rather than a
      suite.</p>
    <form id="startForm" style="display:flex;flex-direction:column;gap:9px;margin-top:22px">
      <input required type="email" placeholder="you@company.com"
        style="height:46px;padding:0 15px;border:1px solid var(--line-2);border-radius:10px;font:inherit">
      <button class="btn" type="submit" style="margin-top:4px">Create workspace</button>
    </form>
    <p style="margin:14px 0 0;font-family:var(--mono);font-size:var(--t-label);letter-spacing:.09em;
              text-transform:uppercase;color:var(--ink-4)">Prototype — nothing is submitted.</p>`);
  $('#startForm').addEventListener('submit', e => {
    e.preventDefault();
    showModal(`<h3 style="margin:0;font-size:1.75rem;font-weight:600;letter-spacing:-.03em">You’re in.</h3>
      <p style="margin:8px 0 0;line-height:1.6;color:var(--ink-2)">Prototype — nothing was sent, and
        no workspace exists. In the real product this is where it would.</p>
      <button class="btn" data-close style="margin-top:22px">Close</button>`);
  });
}

document.addEventListener('click', e => {
  if (e.target.closest('[data-cta="call"]'))  { e.preventDefault(); return openCall(); }
  if (e.target.closest('[data-cta="start"]')) { e.preventDefault(); return openStart(); }
});

$$('[data-goto]').forEach(b => b.addEventListener('click', e => {
  const el = $(b.dataset.goto);
  if (!el) return;
  e.preventDefault();
  scrollTo({ top: el.getBoundingClientRect().top + scrollY - 66,
             behavior: REDUCED ? 'auto' : 'smooth' });
}));
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const el = $(a.getAttribute('href'));
  if (!el) return;
  e.preventDefault();
  scrollTo({ top: el.getBoundingClientRect().top + scrollY - 66,
             behavior: REDUCED ? 'auto' : 'smooth' });
}));

/* ══════════════════════ SATS CONSTELLATION ══════════════════════
   A grid of quiet dots. Every couple of seconds one becomes a hub:
   it grows, thin lines run out to its neighbours, the neighbours
   brighten — then it all lets go and another node wakes elsewhere. */
(function satsNet() {
  const svg = $('#satsNet');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const COLS = 9, ROWS = 5, DX = 52, DY = 48, X0 = 22, Y0 = 24;
  const dots = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const el = document.createElementNS(NS, 'circle');
    const x = X0 + c * DX, y = Y0 + r * DY;
    el.setAttribute('cx', x); el.setAttribute('cy', y);
    el.setAttribute('r', (r * COLS + c) % 3 ? 1.6 : 2.2);
    svg.appendChild(el);
    dots.push({ el, x, y });
  }

  if (REDUCED) {           // one still constellation, no motion
    const hub = dots[Math.floor(COLS * 1.5)];
    burst(hub, true);
    return;
  }

  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  function burst(hub, still) {
    hub.el.classList.add('on');
    hub.el.setAttribute('r', 4.4);
    const near = dots.filter(d => d !== hub &&
      Math.hypot(d.x - hub.x, d.y - hub.y) < 118);
    const lines = near.map(d => {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', hub.x); l.setAttribute('y1', hub.y);
      l.setAttribute('x2', d.x);   l.setAttribute('y2', d.y);
      const len = Math.hypot(d.x - hub.x, d.y - hub.y);
      l.style.strokeDasharray = len;
      l.style.strokeDashoffset = still ? 0 : len;
      svg.insertBefore(l, svg.firstChild);
      d.el.classList.add('on');
      d.el.setAttribute('r', 2.8);
      return { l, d };
    });
    if (still) return;
    requestAnimationFrame(() => requestAnimationFrame(() =>
      lines.forEach(({ l }) => { l.style.strokeDashoffset = 0; })));
    setTimeout(() => {                       // let go
      lines.forEach(({ l, d }) => {
        l.style.opacity = 0;
        d.el.classList.remove('on');
        d.el.setAttribute('r', (dots.indexOf(d)) % 3 ? 1.6 : 2.2);
      });
      hub.el.classList.remove('on');
      hub.el.setAttribute('r', 2.2);
      setTimeout(() => lines.forEach(({ l }) => l.remove()), 460);
    }, 1750);
  }

  let lastHub = -1;
  (function cycle() {
    let i;
    do { i = Math.floor(rand() * dots.length); } while (i === lastHub);
    lastHub = i;
    burst(dots[i]);
    setTimeout(cycle, 2500 + rand() * 900);
  })();
})();

/* ══════════════════════ MOTION ══════════════════════ */

reveal($$('.r'));
whenVisible($$('.tile'), el => el.classList.add('is-in'), { threshold: 0.2 });

addEventListener('load', async () => {
  await wait(REDUCED ? 40 : 560);
  document.body.dataset.state = 'ready';
  $('#boot')?.classList.add('is-out');
  setTimeout(() => $('#boot')?.remove(), 700);
});

})();
