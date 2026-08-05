/* ═══════════════════════════════════════════════════════════════════════════
   STAGWELL AI — VERSION C  ·  the router
   Per Luis (3 Aug): "an agentic, chat-first landing experience that qualifies
   visitors through conversation instead of a traditional product page, hooks
   them with a freemium offer to capture contact info, then routes the lead
   either to NewVoices for a call or straight to the relevant product."

   So: three inputs, then a prescription and a handoff. No live integration
   with any product — which is the whole reason this version can ship.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const { esc, readWebsite, INDUSTRIES, DEFAULT_INDUSTRY, blurWords, countUp,
        whenVisible, reveal, PARTNERS, partnerSrc, LOGO_SCALE } = window.SWAI;
const { GOALS, SCALES, match, suiteName } = window.SWC;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;

const stage = $('#cstage'), thread = $('#cthread');
const promptForm = $('#promptForm'), promptInput = $('#promptInput'), prompt = $('.prompt');
const focusPrompt = () => { if (FINE) promptInput.focus({ preventScroll: true }); };

const S = { step:0, busy:false, done:false, profile:null,
            domain:'', brand:'', goal:null, scale:null, who:'', firstName:'', stack:[] };

/* ─────────────────────────── TYPEWRITER ─────────────────────────── */

let stick = true;
thread.addEventListener('scroll', () => {
  stick = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 48;
}, { passive: true });
const pin = () => { if (stick) thread.scrollTop = thread.scrollHeight; };
const toBottom = () => { stick = true; requestAnimationFrame(pin); };

let skipType = null;
function typeHTML(el, html, speed = 14) {
  return new Promise(resolve => {
    el.innerHTML = html;
    const nodes = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) nodes.push({ node: n, full: n.nodeValue });
    if (REDUCED) { resolve(); return; }
    nodes.forEach(o => (o.node.nodeValue = ''));
    const caret = document.createElement('span'); caret.className = 'caret'; el.appendChild(caret);
    let ni = 0, ci = 0, stopped = false;
    const finish = () => {
      stopped = true; nodes.forEach(o => (o.node.nodeValue = o.full));
      caret.remove(); pin(); if (skipType === finish) skipType = null; resolve();
    };
    skipType = finish;
    const tick = () => {
      if (stopped) return;
      let budget = 2;
      while (budget-- > 0 && ni < nodes.length) {
        const o = nodes[ni];
        if (ci >= o.full.length) { ni++; ci = 0; continue; }
        const ch = o.full[ci]; o.node.nodeValue += ch; ci++; pin();
        if ('.,—:?'.includes(ch)) { setTimeout(tick, 120); return; }
      }
      if (ni >= nodes.length) return finish();
      setTimeout(tick, speed + Math.random() * 11);
    };
    setTimeout(tick, 50);
  });
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (skipType && (e.key === 'Enter' || e.key === ' ')) skipType();
});

/* ─────────────────────────── CONVERSATION ─────────────────────────── */

function aiTurn() {
  const t = document.createElement('div');
  t.className = 'turn';
  t.innerHTML = `<div class="ai">
      <svg class="ai__mark"><use href="#sw-mark"/></svg>
      <div class="ai__body"><p class="ai__who">Stagwell AI</p>
        <div class="thinking"><i></i><i></i><i></i></div></div></div>`;
  thread.appendChild(t); toBottom();
  return $('.ai__body', t);
}
function addUser(text) {
  const t = document.createElement('div');
  t.className = 'turn turn--user';
  t.innerHTML = `<div class="bubble">${esc(text)}</div>`;
  thread.appendChild(t); toBottom();
}
async function say(html, { options, node, delay = 600 } = {}) {
  const body = node || aiTurn();
  await wait(REDUCED ? 40 : delay + Math.random() * 240);
  $('.thinking', body)?.remove();
  const p = document.createElement('p'); p.className = 'ai__text';
  body.appendChild(p);
  await typeHTML(p, html);
  toBottom();
  if (options) await addOptions(body, options);
  return body;
}
function addOptions(body, list) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'opts';
    list.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'opt'; b.dataset.value = o.id;
      b.innerHTML = `<span class="opt__dot"></span><span>${o.label}${o.note ? `<em class="opt__note">${o.note}</em>` : ''}</span>`;
      b.style.animationDelay = `${80 + i * 55}ms`;
      b.addEventListener('click', () => submit(o.label, o.id));
      wrap.appendChild(b);
    });
    body.appendChild(wrap);
    requestAnimationFrame(() => wrap.scrollIntoView({ block: 'end', behavior: REDUCED ? 'auto' : 'smooth' }));
    setTimeout(resolve, 120);
  });
}
const clearOptions = () => $$('.opts', thread).forEach(o => {
  o.classList.add('is-gone'); setTimeout(() => o.remove(), 460);
});

function readCard(p) {
  const rows = [
    ['Company', p.legal || p.name], ['Industry', p.ind], ['What you do', p.what],
    ['Positioning', p.pos], ['Likely audience', p.audience],
  ];
  if (p.confident) rows.push(['Headquarters', p.hq]);
  return `<div class="site">
    <div class="site__bar"><i class="pulse"></i><b>${esc(p.domain)}</b><span class="sp"></span>
      <span>read in 1.4s</span></div>
    <div class="site__rows">
      ${rows.map(r => `<div class="site__row"><b>${r[0]}</b><span>${r[1]}</span></div>`).join('')}
    </div>
  </div>`;
}

function setStep(n) {
  $('#steps').hidden = false;
  $$('.cstep').forEach(s => {
    const i = +s.dataset.step;
    s.classList.toggle('is-on', i === n);
    s.classList.toggle('is-done', i < n);
  });
}

/* Three beats. The website is read, not interrogated; only the two things the
   machine genuinely cannot know are asked. */
const SCRIPT = [
  {
    key:'website', placeholder:'nike.com',
    async reply() {
      const body = aiTurn();
      await wait(REDUCED ? 40 : 440);
      $('.thinking', body)?.remove();
      const p = document.createElement('p'); p.className = 'ai__text';
      body.appendChild(p);
      await typeHTML(p, `Reading <em>${esc(S.domain)}</em>…`);
      await wait(REDUCED ? 30 : 680);

      const holder = document.createElement('div');
      holder.innerHTML = readCard(S.profile);
      body.appendChild(holder.firstElementChild);
      toBottom();
      await wait(REDUCED ? 40 : 780);

      const what = S.profile.what.charAt(0).toLowerCase() + S.profile.what.slice(1);
      await say(`<em>${esc(S.brand)}</em> — ${esc(what)}. <span class="hl">I have the picture.</span> Stagwell has thirteen AI products; you do not need thirteen. Tell me what you are trying to move and I will name the ones that are yours.`,
        { node: body, delay: 200, options: GOALS });
    },
  },
  {
    key:'goal', placeholder:'Or say it in your own words',
    async reply() {
      await say(`${esc(S.goalLabel)}. Good — that narrows it sharply. One last thing, and it decides which suite you belong in.`,
        { options: SCALES });
    },
  },
  {
    key:'scale', placeholder:'Roughly how many people?',
    async reply() {
      await say(`Understood. <span class="hl">Matching you now.</span>`);
    },
  },
];

promptInput.addEventListener('input', () =>
  prompt.classList.toggle('is-ready', promptInput.value.trim().length > 0));
promptForm.addEventListener('submit', e => { e.preventDefault(); submit(promptInput.value); });
$$('.chint').forEach(b => b.addEventListener('click', () => submit(b.dataset.eg)));

async function askStep() {
  S.busy = true;
  const q = SCRIPT[S.step];
  if (!q) return runMatch();
  setStep(S.step);
  promptInput.placeholder = q.placeholder;
  promptInput.value = ''; prompt.classList.remove('is-ready');
  S.busy = false;
  focusPrompt();
}

async function submit(raw, id) {
  if (S.busy) return;
  const text = (raw || '').trim();
  const q = SCRIPT[S.step];
  if (!q) return;
  if (!text) { prompt.classList.add('is-shake'); setTimeout(() => prompt.classList.remove('is-shake'), 440); return; }

  S.busy = true;
  promptInput.value = ''; prompt.classList.remove('is-ready');
  clearOptions();

  if (q.key === 'website') {
    S.profile = readWebsite(text);
    S.domain = S.profile.domain; S.brand = S.profile.name;
    thread.hidden = false;
    stage.classList.add('is-talking');
    $('#cHint').hidden = true;
    $('#cNew').hidden = false;
  }
  if (q.key === 'goal') {
    const g = GOALS.find(x => x.id === id)
      || GOALS.find(x => text.toLowerCase().includes(x.label.split(' ')[0].toLowerCase()))
      || GOALS[0];
    S.goal = g.id; S.goalLabel = g.label; S.goalLine = g.line;
  }
  if (q.key === 'scale') {
    const sc = SCALES.find(x => x.id === id);
    S.scale = sc ? sc.id : (/\b([1-9]\d{3,})\b|global|enterprise|thousand/i.test(text) ? 'enterprise' : 'midmarket');
    S.scaleLabel = (SCALES.find(x => x.id === S.scale) || SCALES[0]).label;
  }

  addUser(text);
  await wait(REDUCED ? 30 : 190);
  await q.reply();
  S.step++;
  await wait(REDUCED ? 30 : 400);
  askStep();
}

/* ─────────────────────────── MATCHING ─────────────────────────── */

const LINES = [
  'Reading your website',
  'Understanding your business',
  'Weighing thirteen products against it',
  'Choosing the three that fit',
  'Preparing your recommendation',
];

async function runMatch() {
  S.busy = true;
  setStep(3);
  const think = $('#think'), status = $('#thinkStatus'), meter = $('#thinkMeter');
  status.innerHTML = ''; meter.style.width = '0';
  think.hidden = false; think.classList.remove('is-out');
  document.body.style.overflow = 'hidden';
  await wait(REDUCED ? 30 : 220);

  const STEP = REDUCED ? 30 : 880;
  for (let i = 0; i < LINES.length; i++) {
    status.innerHTML = `<span>${LINES[i]}…</span>`;
    meter.style.width = ((i + 1) / LINES.length * 100) + '%';
    await wait(STEP);
  }
  await wait(REDUCED ? 20 : 240);

  S.stack = match(S.goal, S.scale);
  buildRx();

  /* the conversation has done its job — the page becomes the answer */
  thread.innerHTML = ''; thread.hidden = true;
  stage.classList.remove('is-talking');
  $('#cTitle').innerHTML = `Here is <span class="accent">${esc(S.brand)}’s</span> Stagwell AI.`;
  blurWords($('#cTitle'));
  $('#cSub').textContent = `Three products, chosen from thirteen, for ${S.goalLine}. Scroll down — or start with the first one free.`;
  $('#cEyebrow').innerHTML = '<i class="pulse"></i>Matched';
  promptInput.placeholder = 'Ask me anything, or try another company';
  S.done = true; S.step = 0;

  think.classList.add('is-out');
  document.body.style.overflow = '';
  setTimeout(() => { think.hidden = true; }, 560);
  await wait(REDUCED ? 20 : 220);
  $('#crx').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  S.busy = false;
}

function buildRx() {
  const [a, b, c] = S.stack;
  const suite = suiteName(S.scale === 'enterprise' ? 'enterprise' : 'cloud');

  /* Each tile carries the product's own mark-shaped object, the way the
     reference puts the product itself at the centre of the tile. */
  const art = () => `<span class="tile__art"><svg viewBox="0 0 28.44 28"><use href="#sw-mark"/></svg></span>`;
  const tile = (p, cls, kicker) => `
    <article class="tile ${cls}">
      <span class="tile__kicker">${kicker}</span>
      <h3>${esc(p.name)}</h3>
      <p class="tile__sub">${esc(p.line)}</p>
      <div class="tile__links">
        <button class="plink" data-cta="free">Start free</button>
        ${p.url ? `<a class="plink plink--ghost" href="${p.url}" target="_blank" rel="noopener">Learn more ›</a>`
                : `<button class="plink plink--ghost" data-cta="human">Learn more ›</button>`}
      </div>
      ${art()}
      <span class="tile__proof">${esc(p.proof)}</span>
    </article>`;

  $('#crx').innerHTML = `
  <div class="crx__in">
    <div class="crx__head">
      <span class="crx__suite"><i class="pulse"></i>${suite}</span>
      <h2>Start with <span class="accent">${esc(a.name)}.</span></h2>
      <p>You want to ${esc((S.goalLabel || '').toLowerCase())}, at ${esc((S.scaleLabel || '').toLowerCase())} scale. Of Stagwell’s thirteen AI products, these three earn their place for ${esc(S.brand)} — in this order.</p>
    </div>

    <div class="wall">
      ${tile(a, 'tile--wide tile--dark', 'Your first move')}
      ${tile(b, 'tile--tint', 'Then')}
      ${tile(c, '', 'And after that')}
    </div>

    <div class="crx__plan">
      <div class="planc"><b>Week one</b><span>We point ${esc(a.name)} at ${esc(S.domain)} and you see your own data inside it — no procurement, no integration.</span></div>
      <div class="planc"><b>Weeks two to four</b><span>${esc(b.name)} joins it, and the two are read together rather than as separate reports.</span></div>
      <div class="planc"><b>Beyond</b><span>${esc(c.name)} extends the same picture, and it runs continuously instead of quarterly.</span></div>
    </div>

    <div class="hand">
      <div class="hand__top">
        <div>
          <h3>Start with ${esc(a.name)} free.<br><span>Keep whatever it finds.</span></h3>
          <p class="hand__p">No procurement conversation, no commitment. We open ${esc(a.name)} against ${esc(S.domain)} and you keep the output whether or not you go further.</p>
        </div>
        <form class="hand__form" id="freeForm">
          <input type="text" placeholder="Full name" required>
          <input type="email" placeholder="Work email" required>
          <button class="btn btn--light" type="submit">Open ${esc(a.name)} free</button>
          <p class="hand__fine">Prototype — nothing is submitted or stored.</p>
        </form>
      </div>

      <div class="hand__alt">
        <button class="altcard" data-cta="call">
          <b><i class="pulse"></i>Have an agent call me</b>
          <span>A NewVoices agent calls within two minutes, already holding this recommendation.</span>
        </button>
        <button class="altcard" data-cta="video">
          <b>Watch the two-minute version</b>
          <span>DoReel renders this recommendation as a presenter video for your team.</span>
        </button>
        <button class="altcard" data-cta="human">
          <b>Put me with the ${esc(a.name.replace(/^The /, ''))} team</b>
          <span>Straight to the people who run it. No SDR in between.</span>
        </button>
      </div>
    </div>
  </div>`;

  $('#crx').hidden = false;
  $('#about').hidden = false;
  $('#cfoot').hidden = false;
  reveal($$('.tile, .planc, .altcard', $('#crx')));
  $('#freeForm').addEventListener('submit', e => { e.preventDefault(); openModal('free'); });
}

/* ─────────────────────────── START AGAIN ─────────────────────────── */

function restartC() {
  if (S.busy) return;
  Object.assign(S, { step:0, busy:false, done:false, profile:null, domain:'', brand:'',
                     goal:null, scale:null, who:'', firstName:'', stack:[] });
  thread.innerHTML = ''; thread.hidden = true;
  stage.classList.remove('is-talking');
  $('#crx').hidden = true; $('#crx').innerHTML = '';
  $('#about').hidden = true; $('#cfoot').hidden = true;
  $('#steps').hidden = true; $('#cNew').hidden = true;
  $('#cHint').hidden = false;
  $('#cEyebrow').innerHTML = '<i class="pulse"></i>Stagwell AI';
  $('#cTitle').innerHTML = 'Let’s start with your <span class="accent">company.</span>';
  blurWords($('#cTitle'));
  $('#cSub').textContent = 'One link, two questions. I’ll tell you exactly which of Stagwell’s AI belongs to you — and put it in your hands today.';
  promptInput.value = ''; promptInput.placeholder = SCRIPT[0].placeholder;
  prompt.classList.remove('is-ready');
  scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
  setTimeout(focusPrompt, 420);
}
$('#cNew').addEventListener('click', restartC);

/* ─────────────────────────── MODAL ─────────────────────────── */

const modal = $('#modal'), modalBody = $('#modalBody');
const closeModal = () => { modal.hidden = true; };
$$('[data-close]', modal).forEach(e => e.addEventListener('click', closeModal));

function openModal(kind) {
  const lead = S.stack[0]?.name || 'Stagwell AI';
  /* products named "The Machine" already carry their article */
  const leadBare = lead.replace(/^The /, '');
  const COPY = {
    free:  ['You’re in.', `We are opening ${lead} against ${S.domain} now. You will have the first output today, and it is yours to keep.`],
    call:  ['The agent will call you', 'Leave a number and a NewVoices agent calls within two minutes — already holding this recommendation, so you will not repeat yourself.'],
    video: ['Your two-minute version', `DoReel will render this recommendation for ${esc(S.brand)} as a presenter video and send it to your inbox.`],
    human: [`Straight to the ${leadBare} team`, 'We will put you with the people who actually run it, with your recommendation already in front of them.'],
  };
  const [t, p] = COPY[kind] || COPY.human;
  const done = kind === 'free';
  modalBody.innerHTML = `
    <div class="modal__brand"><svg><use href="#sw-logo"/></svg><span>AI</span></div>
    <h3>${t}</h3><p>${p}</p>
    ${done ? `<div class="modal__ok" style="margin-top:26px">
        <span class="modal__tick"><svg viewBox="0 0 20 20" width="20" height="20"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <button class="btn btn--dark" data-close>Back</button></div>`
      : `<form class="modal__form" id="leadForm">
        <input type="text" placeholder="Full name" required>
        ${kind === 'call' ? '<input type="tel" placeholder="+1 (555) 000-0000" required>'
                          : '<input type="email" placeholder="Work email" required>'}
        <button class="btn btn--dark" type="submit">${kind === 'call' ? 'Call me now' : 'Continue'}</button>
      </form>`}
    <p class="modal__fine">Prototype only — nothing is submitted or stored.</p>`;
  modal.hidden = false;
  $$('[data-close]', modalBody).forEach(x => x.addEventListener('click', closeModal));
  $('#leadForm')?.addEventListener('submit', e => {
    e.preventDefault();
    modalBody.innerHTML = `
      <div class="modal__ok">
        <span class="modal__tick"><svg viewBox="0 0 20 20" width="20" height="20"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <h3>Done.</h3>
        <p>Someone who already understands ${esc(S.brand)} will be in touch — holding this recommendation, not a script.</p>
        <button class="btn btn--dark" data-close>Back</button>
      </div>`;
    $$('[data-close]', modalBody).forEach(x => x.addEventListener('click', closeModal));
  });
  setTimeout(() => $('#leadForm input')?.focus(), 120);
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-cta]');
  if (t) { e.preventDefault(); openModal(t.dataset.cta); }
});

/* ─────────────────────────── STATIC ─────────────────────────── */

const mCell = ([k, n]) => `<div class="mcell" title="${n}"><img src="${partnerSrc(k)}" alt="${n}"
  loading="lazy" style="--s:${LOGO_SCALE[k] || 1}"></div>`;
const row = PARTNERS.map(mCell).join('');
$('#marquee').innerHTML = `<div class="mrow">${row}${row}</div>`;

whenVisible($$('.csec__in'), el => el.classList.add('is-in'));
reveal($$('.cstat'));

/* ─────────────────────────── BOOT ─────────────────────────── */

(async function boot() {
  const params = new URLSearchParams(location.search);
  await wait(REDUCED || params.has('rx') ? 60 : 1400);
  document.body.dataset.state = 'ready';

  if (params.has('rx')) {                       // deep link to a finished match
    S.profile = readWebsite(params.get('rx') || 'nike.com');
    S.domain = S.profile.domain; S.brand = S.profile.name;
    S.goal = params.get('goal') || 'growth';
    const _g = GOALS.find(g => g.id === S.goal) || GOALS[0];
    S.goalLine = _g.line; S.goalLabel = _g.label;
    S.scale = params.get('scale') || 'enterprise';
    S.scaleLabel = (SCALES.find(x => x.id === S.scale) || SCALES[0]).label;
    S.stack = match(S.goal, S.scale);
    buildRx();
    $('#cTitle').innerHTML = `Here is <span class="accent">${esc(S.brand)}’s</span> Stagwell AI.`;
    $('#cSub').textContent = `Three products, chosen from thirteen, for ${S.goalLine}.`;
    $('#cHint').hidden = true; $('#cNew').hidden = false;
    setStep(3);
    S.done = true;
  }
  blurWords($('#cTitle'), 120);
  focusPrompt();
})();

})();
