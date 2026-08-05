/* ═══════════════════════════════════════════════════════════════════════════
   STAGWELL AI — VERSION C  ·  the landing page

   A hero with a small concierge, four enterprise tiles, a slider of
   Marketing Cloud cards, a footer. Nothing else. The tiles open a short
   modal rather than an inner page — those are not part of this build.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const { esc, reveal, whenVisible } = window.SWAI;
const { PRODUCTS, GOALS, SCALES, match } = window.SWC;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;

/* ══════════════════════ THE CONCIERGE ══════════════════════
   Three questions, two recommendations, one call to action. */

const box   = $('#concBody');
const form  = $('#concForm');
const input = $('#concInput');

const C = { step: 0, busy: true, company: '', goal: null, scale: null };
const pin = () => { box.scrollTop = box.scrollHeight; };

function openPanel() { if (box.hidden) box.hidden = false; }

function line(html, me) {
  openPanel();
  const el = document.createElement('div');
  el.className = me ? 'cline cline--me' : 'cline';
  /* the mark identifies a speaker, so it shows once per run of AI lines */
  const prev = box.lastElementChild;
  const runOn = !me && prev?.classList.contains('cline') && !prev.classList.contains('cline--me');
  el.innerHTML = me
    ? `<span class="cline__t">${esc(html)}</span>`
    : `<svg class="cline__mark"${runOn ? ' style="visibility:hidden"' : ''}><use href="#sw-mark"/></svg>
       <span class="cline__t">${html}</span>`;
  box.appendChild(el);
  pin();
  return el;
}

async function says(html, ms = 560) {
  const el = line('<span class="dots"><i></i><i></i><i></i></span>');
  await wait(REDUCED ? 30 : ms);
  $('.cline__t', el).innerHTML = html;
  pin();
}

function options(list) {
  const wrap = document.createElement('div');
  wrap.className = 'chips--opt';
  list.forEach((o, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'optc';
    b.textContent = o.label;
    b.style.animationDelay = `${50 + i * 42}ms`;
    b.addEventListener('click', () => answer(o.label, o.id));
    wrap.appendChild(b);
  });
  box.appendChild(wrap);
  pin();
}
const clearOptions = () => $$('.chips--opt', box).forEach(w => {
  w.classList.add('is-gone');
  setTimeout(() => w.remove(), 260);
});

const STEPS = [
  {
    placeholder: '',            /* the greeter loop below owns this slot */
    async ask() {},             /* the pill itself asks the first question */
    take(t) { C.company = t.replace(/^(we are|we're|it's|its)\s+/i, '').trim(); },
  },
  {
    placeholder: 'Or say it in your own words',
    async ask() {
      await says(`Good to meet you, <em>${esc(C.company)}</em>. What are you trying to accomplish?`, 560);
      options(GOALS);
    },
    take(t, id) { C.goal = id || 'growth'; },
  },
  {
    placeholder: 'Roughly how many people?',
    async ask() { await says('And how big is the team?', 460); options(SCALES); },
    take(t, id) { C.scale = id || 'enterprise'; },
  },
];

async function answer(text, id) {
  if (C.busy || C.step >= STEPS.length) return;
  C.busy = true;
  stopGreet('');
  clearOptions();
  line(text, true);
  input.value = '';
  STEPS[C.step].take(text, id);
  C.step++;
  if (C.step < STEPS.length) {
    input.placeholder = STEPS[C.step].placeholder;
    await STEPS[C.step].ask();
    C.busy = false;
    if (FINE) input.focus({ preventScroll: true });
  } else {
    await recommend();
  }
}

async function recommend() {
  const [a, b] = match(C.goal, C.scale);
  await says(`Start with these two.`, 760);

  const wrap = document.createElement('div');
  wrap.className = 'recs';
  [a, b].forEach((p, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'rec';
    el.style.animationDelay = `${110 + i * 120}ms`;
    el.innerHTML = `
      <span class="rec__tick"><svg viewBox="0 0 12 12" width="9" height="9">
        <path d="M2 6.2l2.6 2.6L10 3.4" stroke="currentColor" stroke-width="1.8"
              fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <span class="rec__x"><b>${esc(p.name)}</b><span>${esc(p.line)}</span></span>
      <span class="rec__go">Learn more ›</span>`;
    wrap.appendChild(el);
  });
  box.appendChild(wrap);
  pin();

  await wait(REDUCED ? 30 : 820);
  await says('Want a specialist to walk you through them?');
  const cta = document.createElement('div');
  cta.className = 'recs';
  cta.innerHTML = `<button class="btn" data-cta="call" style="align-self:flex-start">Book a call</button>`;
  box.appendChild(cta);
  pin();

  input.disabled = true;
  input.placeholder = 'Everything else is below';
  $('#concReset').hidden = false;
  C.busy = false;
}

/* ── the greeter ──
   Someone is typing at you: rotating questions typed character by
   character into the placeholder, until the conversation starts. */
const GREETS = [
  'Hey — how can I help?',
  'What company are you with?',
  'What are you working on these days?',
  'Looking for the right AI to start with?',
];
let greetOn = true;
(async function greet() {
  if (REDUCED) { input.placeholder = GREETS[0]; return; }
  let gi = 0;
  while (greetOn) {
    const txt = GREETS[gi % GREETS.length];
    for (let i = 1; i <= txt.length && greetOn; i++) {
      input.placeholder = txt.slice(0, i);
      await wait(34 + Math.random() * 40);
    }
    await wait(2400);
    for (let i = txt.length; i >= 0 && greetOn; i--) {
      input.placeholder = txt.slice(0, i);
      await wait(11);
    }
    gi++;
  }
})();
const stopGreet = txt => {
  if (!greetOn) return;
  greetOn = false;
  input.placeholder = txt || '';
};
input.addEventListener('input', () => { if (input.value) stopGreet(); });

form.addEventListener('submit', e => {
  e.preventDefault();
  const v = input.value.trim();
  if (v) answer(v);
});

$('#concReset').addEventListener('click', () => {
  box.innerHTML = '';
  box.hidden = true;
  Object.assign(C, { step: 0, busy: false, company: '', goal: null, scale: null });
  input.disabled = false;
  input.value = '';
  input.placeholder = GREETS[0];
  $('#concReset').hidden = true;
});

/* ══════════════════════ THE MARKETING CLOUD ══════════════════════
   Two rows in constant motion, like the reference: three big
   showcases drifting left with cropped neighbours, the rest as
   smaller cards drifting the other way. Hover pauses a row.
   Art is PLACEHOLDER until the real images land. */

const BIG = ['koalifyed', 'bera', 'doreel', 'newvoices'];
/* a small centred voice agent, mid-sentence */
const voice = () => `<div class="ca-voice">${Array.from({ length: 7 },
  (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>`;

const BIGART = {
  newvoices: ['fcard--dark',  voice()],
  bera:      ['fcard--img',
    `<img class="fcard__img" src="./assets/img/bera.jpg" alt="" loading="lazy">`],
  doreel:    ['fcard--amber fcard--video',
    `<video class="fcard__video" src="./assets/img/doreel.mp4" autoplay muted loop playsinline></video>`],
  koalifyed: ['fcard--teal fcard--video',
    `<video class="fcard__video" src="./assets/img/imai.mp4" autoplay muted loop playsinline></video>`],
};
/* small cards: a compact product-true dashboard fragment sits in the
   bottom-right corner — no backgrounds, never fighting the text */
/* small cards: one framed dashboard fragment each — centred between
   the copy and the button, bordered like a piece of real UI, animated
   only in micro ways that never touch readability */
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
  newintel: `<span class="cmini mini-feed">
      <span><i class="pulse"></i><b>Rival cut prices 4%</b><em>2h</em></span>
      <span><i class="pulse pulse--amber"></i><b>New creator campaign</b><em>9h</em></span></span>`,
  'agent-cloud': `<span class="cmini mini-net">
      <svg viewBox="0 0 84 34" aria-hidden="true">
        <path d="M42,17 L12,7 M42,17 L20,29 M42,17 L64,5 M42,17 L72,23" stroke="currentColor" stroke-width="1"/>
        <circle cx="12" cy="7" r="2.4"/><circle cx="20" cy="29" r="2.4"/>
        <circle cx="64" cy="5" r="2.4"/><circle cx="72" cy="23" r="2.4"/>
        <circle cx="42" cy="17" r="4" class="mini-net__hub"/>
      </svg><b>10 agents, one place</b></span>`,
  'people-platform': `<span class="cmini mini-saydo">
      <span><b>Say</b><span class="mini-bar"><i style="--w:34%"></i></span><em>34%</em></span>
      <span><b>Do</b><span class="mini-bar"><i style="--w:61%"></i></span><em>61%</em></span></span>`,
};

const P = id => PRODUCTS.find(p => p.id === id);

const bigCard = p => {
  const [cls, art] = BIGART[p.id];
  return `<button class="fcard ${cls}" data-id="${p.id}">
    <span class="fcard__art">${art}</span>
    <span class="fcard__k">TMC</span>
    <span class="fcard__t"><b>${esc(p.name)}</b><i>${esc(p.line)}</i>
      <em class="btn btn--sm">Learn more</em></span>
  </button>`;
};
const smCard = p => `<button class="scard" data-id="${p.id}">
    <span class="scard__t"><b>${esc(p.name)}</b><i>${esc(p.line)}</i></span>
    ${SMMINI[p.id] ? `<span class="scard__mini">${SMMINI[p.id]}</span>` : ''}
    <em class="btn btn--xs">Learn more</em>
  </button>`;

/* each row is its content twice, so translateX(-50%) loops seamlessly */
const bigRow = BIG.map(id => bigCard(P(id))).join('');
const smRow  = PRODUCTS.filter(p => p.suite === 'cloud' && !BIG.includes(p.id))
  .map(smCard).join('');
$('#flowBig').innerHTML = `<div class="flow__row">${bigRow}${bigRow}</div>`;
$('#flowSm').innerHTML  = `<div class="flow__row">${smRow}${smRow}</div>`;

/* Drift and paddles share one offset per row, so the arrows work while
   the rows keep moving. Offsets wrap at half the row (content is doubled). */
const FLOWS = [
  { el: $('#flowBig .flow__row'), dir:  1, speed: 24, off: 0, vel: 0 },
  { el: $('#flowSm .flow__row'),  dir: -1, speed: 30, off: 0, vel: 0 },
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

function nudge(sign) {
  FLOWS.forEach(f => {
    const card = f.el.firstElementChild;
    const w = (card ? card.getBoundingClientRect().width + 12 : 320);
    f.vel = sign * w * 4.2;                   // decays to ~one card of travel
    f.pauseUntil = performance.now() + 2200;  // the drift waits while you steer
  });
}
$('#cloudNext').addEventListener('click', () => nudge(1));
$('#cloudPrev').addEventListener('click', () => nudge(-1));

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

/* Only the call CTA opens anything. Tiles, cards and Learn more are
   inert for now — they will lead to the inner pages, which are not
   part of this build. */
document.addEventListener('click', e => {
  if (e.target.closest('[data-cta]')) { e.preventDefault(); return openCall(); }
});

$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const el = $(a.getAttribute('href'));
  if (!el) return;
  e.preventDefault();
  scrollTo({ top: el.getBoundingClientRect().top + scrollY - 60,
             behavior: REDUCED ? 'auto' : 'smooth' });
}));

/* every background video gets a small pause/play control, bottom right */
const VICONS = {
  pause: '<svg viewBox="0 0 14 14" width="12" height="12"><path d="M4 2.6v8.8M10 2.6v8.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  play:  '<svg viewBox="0 0 14 14" width="12" height="12"><path d="M4.4 2.5l7 4.5-7 4.5z" fill="currentColor"/></svg>',
};
$$('.fcard video').forEach(v => {
  const b = document.createElement('span');
  b.className = 'vctl';
  b.setAttribute('role', 'button');
  b.setAttribute('tabindex', '0');
  b.setAttribute('aria-label', 'Pause video');
  b.innerHTML = VICONS.pause;
  const toggle = () => {
    if (v.paused) { v.play(); b.innerHTML = VICONS.pause; b.setAttribute('aria-label', 'Pause video'); }
    else { v.pause(); b.innerHTML = VICONS.play; b.setAttribute('aria-label', 'Play video'); }
  };
  b.addEventListener('click', e => { e.stopPropagation(); toggle(); });
  b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  v.closest('.fcard').appendChild(b);
});

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

/* the Machine's background drifts against the scroll — quiet parallax */
const pxTile = $('.tile--img');
if (pxTile && !REDUCED) {
  let raf = null;
  const drift = () => {
    raf = null;
    const r = pxTile.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const d = (r.top + r.height / 2 - innerHeight / 2) * 0.12;
    pxTile.style.backgroundPosition = `center calc(50% + ${d.toFixed(1)}px)`;
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(drift); },
    { passive: true });
  drift();
}

reveal($$('.r'));
whenVisible($$('.tile'), el => el.classList.add('is-in'), { threshold: 0.2 });

addEventListener('load', async () => {
  await wait(REDUCED ? 40 : 560);
  document.body.dataset.state = 'ready';
  $('#boot')?.classList.add('is-out');
  setTimeout(() => $('#boot')?.remove(), 700);
  C.busy = false;
});

})();
