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

function line(html, me) {
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
    placeholder: 'Your company',
    async ask() { await says('Hi — what company are you with?', 380); },
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
    el.addEventListener('click', () => openProduct(p.id));
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

form.addEventListener('submit', e => {
  e.preventDefault();
  const v = input.value.trim();
  if (v) answer(v);
});

$('#concReset').addEventListener('click', async () => {
  box.innerHTML = '';
  Object.assign(C, { step: 0, busy: true, company: '', goal: null, scale: null });
  input.disabled = false;
  input.value = '';
  input.placeholder = STEPS[0].placeholder;
  $('#concReset').hidden = true;
  await STEPS[0].ask();
  C.busy = false;
});

/* ══════════════════════ THE SLIDER ══════════════════════
   The nine Marketing Cloud products. Each ccard's art is a
   PLACEHOLDER — replace .ccard__art with an <img> when the
   real images land. */

const ART = {
  bera:              ['ccard--tint', bars([30, 44, 39, 56, 62, 58, 76, 90])],
  newindex:          ['ccard--dark', rows([92, 68, 50, 34])],
  geopulse:          ['',           rows([88, 70, 54, 36])],
  newintel:          ['ccard--tint', rows([74, 90, 52, 66])],
  newvoices:         ['ccard--dark', wave()],
  'agent-cloud':     ['',           dotfield()],
  doreel:            ['ccard--amber', film()],
  harrisquest:       ['',           bars([41, 29, 18, 12, 26, 35, 48, 58])],
  'people-platform': ['ccard--tint', dotfield()],
};
function bars(h)  { return `<div class="ca-bars">${h.map(v => `<i style="--h:${v}%"></i>`).join('')}</div>`; }
function rows(w)  { return `<div class="ca-rows">${w.map(v => `<i style="--w:${v}%"></i>`).join('')}</div>`; }
function wave()   { return `<div class="ca-wave">${Array.from({ length: 22 },
  (_, i) => `<i style="--h:${16 + Math.round(Math.abs(Math.sin(i * 0.72)) * 74)}%"></i>`).join('')}</div>`; }
function dotfield(){ return `<div class="ca-dots"></div>`; }
function film()   { return `<div class="ca-film">${[1, .74, .5, .3].map(o => `<i style="--o:${o}"></i>`).join('')}</div>`; }

const track = $('#railTrack');
track.innerHTML = PRODUCTS.filter(p => p.suite === 'cloud').map(p => {
  const [cls, art] = ART[p.id] || ['', dotfield()];
  return `<button class="ccard ${cls}" data-id="${p.id}">
    <p class="ccard__k">Marketing Cloud</p>
    <h3>${esc(p.name)}</h3>
    <p>${esc(p.line)}</p>
    <span class="ccard__go">Learn more</span>
    <span class="ccard__art">${art}</span>
  </button>`;
}).join('');

const step = () => ($('.ccard', track)?.offsetWidth || 280) + 12;
$('#railNext').addEventListener('click', () => track.scrollBy({ left: step() * 2 }));
$('#railPrev').addEventListener('click', () => track.scrollBy({ left: -step() * 2 }));
const syncRail = () => {
  $('#railPrev').disabled = track.scrollLeft < 8;
  $('#railNext').disabled = track.scrollLeft > track.scrollWidth - track.clientWidth - 8;
};
track.addEventListener('scroll', syncRail, { passive: true });
syncRail();

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

function openProduct(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  showModal(`
    <p style="margin:0;font-family:var(--mono);font-size:var(--t-label);letter-spacing:.15em;
              text-transform:uppercase;color:var(--teal)">${
      p.suite === 'enterprise' ? 'The Machines' : 'Marketing Cloud'}${p.badge ? ` · ${esc(p.badge)}` : ''}</p>
    <h3 style="margin:10px 0 0;font-size:2rem;font-weight:600;letter-spacing:-.034em">${esc(p.name)}</h3>
    <p style="margin:6px 0 0;font-size:1.125rem;color:var(--ink-2)">${esc(p.line)}</p>
    <p style="margin:18px 0 0;line-height:1.65">${esc(p.what)}</p>
    <div style="display:flex;gap:11px;flex-wrap:wrap;margin-top:24px">
      <button class="btn" data-cta="call">Book a call</button>
      ${p.url ? `<a class="btn" style="background:none;color:var(--ink);box-shadow:inset 0 0 0 1px var(--line-2)"
                    href="${p.url}" target="_blank" rel="noopener">Visit the product ›</a>` : ''}
    </div>`);
}

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

/* one listener for every entry point: tiles, cards, links, nav */
document.addEventListener('click', e => {
  if (e.target.closest('[data-cta]'))  { e.preventDefault(); return openCall(); }
  const open = e.target.closest('[data-open]');
  if (open) { e.preventDefault(); return openProduct(open.dataset.open); }
  const holder = e.target.closest('.tile[data-id], .ccard[data-id]');
  if (holder) openProduct(holder.dataset.id);
});

$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const el = $(a.getAttribute('href'));
  if (!el) return;
  e.preventDefault();
  scrollTo({ top: el.getBoundingClientRect().top + scrollY - 60,
             behavior: REDUCED ? 'auto' : 'smooth' });
}));

/* ══════════════════════ MOTION ══════════════════════ */

reveal($$('.r'));
whenVisible($$('.tile'), el => el.classList.add('is-in'), { threshold: 0.2 });

addEventListener('load', async () => {
  await wait(REDUCED ? 40 : 560);
  document.body.dataset.state = 'ready';
  $('#boot')?.classList.add('is-out');
  setTimeout(() => $('#boot')?.remove(), 700);
  await wait(REDUCED ? 40 : 340);
  await STEPS[0].ask();
  C.busy = false;
});

})();
