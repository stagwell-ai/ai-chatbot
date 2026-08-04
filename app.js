/* ═══════════════════════════════════════════════════════════════════════════
   STAGWELL AI — THE MACHINE
   A scripted, high-fidelity prototype. No model is called: every path the
   visitor takes converges on the same designed journey.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const { esc, hash, pick, PARTNERS, partnerSrc, LOGO_SCALE, STUDIES, INDUSTRIES,
        DEFAULT_INDUSTRY, KNOWN, readWebsite, STATUS_LINES, MODELS, FOCUS, ROLES,
        numbersFor, computeAnalysis } = window.SWAI;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ─────────────────────────── REFERENCE DATA ─────────────────────────── */

/* ─────────────────────────── STATE ─────────────────────────── */

const S = {
  step:0, busy:false, view:'workspace', briefReady:false,
  domain:'', brand:'', legal:'', who:'', firstName:'', industryLabel:'', data:DEFAULT_INDUSTRY,
  profile:null, comps:[], challenge:'', pages:42,
  focus:'Growth opportunities', focusLine:'where the next points of growth actually sit', focusLead:1,
  role:'', roleArticle:'board',
  equity:62, aiVis:41, sov:18, gap:40, creators:'1,204', seed:1,
};

function deriveNumbers() { Object.assign(S, numbersFor(S.domain, S.brand)); }

/* ─────────────────────────── TYPEWRITER ─────────────────────────── */

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
      caret.remove(); if (skipType === finish) skipType = null; resolve();
    };
    skipType = finish;
    const tick = () => {
      if (stopped) return;
      let budget = 2;
      while (budget-- > 0 && ni < nodes.length) {
        const o = nodes[ni];
        if (ci >= o.full.length) { ni++; ci = 0; continue; }
        const ch = o.full[ci];
        o.node.nodeValue += ch; ci++;
        if ('.,—:?'.includes(ch)) { setTimeout(tick, 120); return; }
      }
      if (ni >= nodes.length) return finish();
      setTimeout(tick, speed + Math.random() * 11);
    };
    setTimeout(tick, 50);
  });
}

/* ─────────────────────────── SHELL ─────────────────────────── */

const app = $('#app'), stage = $('#stage'), thread = $('#thread'), wsView = $('[data-view="workspace"]');
const dock = $('#dock'), promptForm = $('#promptForm'), promptInput = $('#promptInput'), prompt = $('.prompt');
const crumb = $('#crumb'), ctx = $('#ctx'), ctxList = $('#ctxList'), restartBtn = $('#restart');

const CRUMB = { workspace:'Workspace', run:'Preparing your brief', brief:'Executive AI Brief',
  whatwedo:'Future of News · What we do', mission:'Future of News · Our mission',
  research:'Future of News · Research', partners:'Future of News · Our partners' };

function show(view) {
  S.view = view;
  $$('.view').forEach(v => v.classList.toggle('is-shown', v.dataset.view === view));
  $$('.rail__item').forEach(b => b.classList.toggle('is-active', !!b.dataset.nav && b.dataset.nav === view));
  if (view === 'workspace' && S.step > 0) $('#railThread').classList.add('is-active');
  crumb.innerHTML = `<span>${CRUMB[view] || 'Workspace'}</span>`;
  topbar.style.transform = ''; topbar.style.opacity = '';   // reset when the view changes
  app.classList.remove('rail-open');
  /* the rail stays put through the loader so nothing reflows while we wait;
     it only steps aside for the brief, which wants the full width */
  app.classList.toggle('has-ctx', (view === 'workspace' || view === 'run') && ctxList.children.length > 0);
  document.body.dataset.state = view;
  if (view === 'workspace' && S.step < SCRIPT.length) setTimeout(() => promptInput.focus(), 320);
}

/* The topbar rides with the content rather than hovering above it. */
const topbar = $('.topbar');
function trackTopbar(el) {
  if (!el || el.dataset.topbarBound) return;
  el.dataset.topbarBound = '1';
  el.addEventListener('scroll', () => {
    if (!el.closest('.view').classList.contains('is-shown')) return;
    if (innerWidth <= 820) { topbar.style.transform = ''; topbar.style.opacity = ''; return; }
    const y = Math.min(el.scrollTop, 64);
    topbar.style.transform = `translateY(${-y}px)`;
    topbar.style.opacity = String(1 - y / 64);
  }, { passive: true });
}
$$('.scroll, .view--partners').forEach(trackTopbar);

$$('[data-nav]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); show(b.dataset.nav); }));
$('#railOpen').addEventListener('click', () => app.classList.add('rail-open'));
$('#railClose').addEventListener('click', () => app.classList.remove('rail-open'));
$('#railScrim').addEventListener('click', () => app.classList.remove('rail-open'));

/* ── The composer physically lives inside the centred hero group, then flies
      to the foot of the page when the conversation starts. No measuring at
      boot, so font loading and resizes can never leave it stranded. ── */
const heroDock = $('#heroDock');

function seatComposer() {
  if (promptForm.parentElement !== heroDock) heroDock.appendChild(promptForm);
}

function undockInput() {
  const first = promptForm.getBoundingClientRect();
  dock.appendChild(promptForm);
  wsView.classList.remove('is-welcome');
  const last = promptForm.getBoundingClientRect();
  const dx = Math.round(first.left - last.left);
  const dy = Math.round(first.top - last.top);
  if (!REDUCED && (dx || dy)) {
    promptForm.animate(
      [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }],
      { duration: 900, easing: 'cubic-bezier(.16,1,.3,1)' });
  }
}

/* ─────────────────────────── CONVERSATION ─────────────────────────── */

const scrollDown = () => {
  const sc = $('#wsScroll');
  requestAnimationFrame(() => sc.scrollTo({ top: sc.scrollHeight, behavior: REDUCED ? 'auto' : 'smooth' }));
};

function aiTurn() {
  const t = document.createElement('div');
  t.className = 'turn';
  t.innerHTML = `<div class="ai">
      <svg class="ai__mark"><use href="#sw-mark"/></svg>
      <div class="ai__body"><p class="ai__who">Stagwell AI</p>
        <div class="thinking"><i></i><i></i><i></i></div></div></div>`;
  thread.appendChild(t); scrollDown();
  return $('.ai__body', t);
}

function addUser(text) {
  const t = document.createElement('div');
  t.className = 'turn turn--user';
  t.innerHTML = `<div class="bubble">${esc(text)}</div>`;
  thread.appendChild(t); scrollDown();
}

async function say(html, { options, node, delay = 620 } = {}) {
  const body = node || aiTurn();
  await wait(REDUCED ? 40 : delay + Math.random() * 260);
  $('.thinking', body)?.remove();
  const p = document.createElement('p'); p.className = 'ai__text';
  body.appendChild(p);
  await typeHTML(p, html);
  scrollDown();
  if (options) await addOptions(body, options);
  return body;
}

function addOptions(body, list) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'opts';
    list.forEach((label, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'opt';
      b.innerHTML = `<span class="opt__dot"></span>${label}`;
      b.style.animationDelay = `${80 + i * 60}ms`;
      b.addEventListener('click', () => submit(b.textContent.trim()));
      wrap.appendChild(b);
    });
    body.appendChild(wrap);
    scrollDown();
    setTimeout(resolve, 120);
  });
}

function clearOptions() {
  $$('.opts', thread).forEach(o => {
    o.classList.add('is-gone');
    setTimeout(() => o.remove(), 460);
  });
}

function addCtx(tag, text) {
  const c = document.createElement('div');
  c.className = 'ctxcard';
  c.innerHTML = `<b>${tag}</b><span>${text.replace(/<\/?b>/g, '')}</span><em>captured</em>`;
  ctxList.appendChild(c);
  const pct = Math.round((ctxList.children.length / SCRIPT.length) * 100);
  $('#ctxBar').style.width = pct + '%'; $('#ctxPct').textContent = pct;
  ctx.hidden = false;
  if (S.view === 'workspace') app.classList.add('has-ctx');
}

/* What the machine worked out on its own. This card is the whole promise:
   the visitor classifies nothing. */
function inferenceCard(p) {
  const rows = [
    ['Company', p.legal || p.name],
    ['Industry', p.ind],
    ['What you do', p.what],
    ['Positioning', p.pos],
    ['Likely audience', p.audience],
    ['Brand language', p.tone],
  ];
  if (p.confident) rows.push(['Headquarters', p.hq], ['Founded', p.founded], ['People', p.people]);
  else rows.push(['Named entities', String(p.entities)], ['Earned mentions, 30d', String(p.mentions)],
                 ['Read confidence', 'High']);
  return `<div class="site">
    <div class="site__bar"><i class="pulse"></i><b>${esc(p.domain)}</b><span class="sp"></span>
      <span>${p.pages} pages read · inferred in 1.4s</span></div>
    <div class="site__rows">
      ${rows.map(r => `<div class="site__row"><b>${r[0]}</b><span>${r[1]}</span></div>`).join('')}
    </div>
    <p class="site__note"><b>Likely competitors</b> — ${p.peers.join(' · ')}</p>
  </div>`;
}

/* ── The machine does the research first, then asks only what it cannot
      know: what you want from it, and who you are. ── */

const SCRIPT = [
  {
    key: 'website',
    placeholder: 'nike.com',
    async reply() {
      const body = aiTurn();
      await wait(REDUCED ? 40 : 460);
      $('.thinking', body)?.remove();
      const p = document.createElement('p'); p.className = 'ai__text';
      body.appendChild(p);
      await typeHTML(p, `Reading <em>${esc(S.domain)}</em>…`);
      await wait(REDUCED ? 30 : 700);

      const holder = document.createElement('div');
      holder.innerHTML = inferenceCard(S.profile);
      body.appendChild(holder.firstElementChild);
      scrollDown();
      await wait(REDUCED ? 40 : 820);

      const what = S.profile.what.charAt(0).toLowerCase() + S.profile.what.slice(1);
      const where = S.profile.confident ? `, out of ${esc(S.profile.hq)}` : '';
      await say(
        `I have reviewed <em>${esc(S.brand)}</em>. You appear to operate across ${esc(what)}${where} — positioned as ${esc(S.profile.pos.toLowerCase())}. In the answer layer you sit against ${esc(S.profile.peers.slice(0, 2).join(' and '))}. <span class="hl">I have what I need.</span> What would you like me to focus on first?`,
        { node: body, delay: 220, options: Object.keys(FOCUS) });

      addCtx('Site read', `<b>${S.brand}</b> — ${S.profile.what}`);
      addCtx('Inference', `${S.profile.ind} · <b>${S.profile.peers.length} rivals</b> identified`);
      return body;
    },
  },
  {
    key: 'focus',
    placeholder: 'Or tell me in your own words',
    async reply() {
      await say(`Good. I will lead on ${esc(S.focusLine)}.`);
      addCtx('Focus', `Brief will lead on <b>${S.focus}</b>`);
    },
  },
  {
    key: 'who',
    placeholder: 'Your name',
    question: () => `Before I build it — who am I speaking to?`,
    async reply() {
      await say(`Good to meet you, <em>${esc(S.firstName)}</em>.`);
      addCtx('Contact', `Brief addressed to <b>${S.firstName}</b>`);
    },
  },
  {
    key: 'role',
    placeholder: 'Your role',
    question: () => `And what is your role at <em>${esc(S.brand)}</em>?`,
    optionsFor: () => ROLES,
    async reply() {
      const more = S.focus === 'Competitive positioning' ? '' : ' <span class="hl">Give me forty seconds.</span>';
      await say(`Noted — I will write this at ${esc(S.roleArticle)} altitude.${more}`);
      addCtx('Seniority', `Written for a <b>${S.role}</b>`);
    },
  },
  {
    key: 'competitors',
    skipIf: () => S.focus !== 'Competitive positioning',
    placeholder: 'A name, or press enter to keep mine',
    question: () => `One last thing. I am benchmarking you against <em>${S.comps.join('</em>, <em>')}</em> — anyone else you measure yourself by?`,
    optionsFor: () => ['Those three are right', 'Add someone I should watch'],
    async reply() {
      await say(`Locked. NewIntel now has every move <em>${esc(S.comps[0])}</em> made in the last seven days. <span class="hl">Give me forty seconds.</span>`);
      addCtx('NewIntel', `<b>${S.comps.length} rivals</b> under live surveillance`);
    },
  },
];

function nextIndex(from) {
  let i = from;
  while (i < SCRIPT.length && SCRIPT[i].skipIf && SCRIPT[i].skipIf()) i++;
  return i;
}

/* The input stays locked until the next question is fully on screen, so a
   double-tap can never drop an answer into the wrong beat. */
async function askStep() {
  S.busy = true;
  S.step = nextIndex(S.step);
  const q = SCRIPT[S.step];
  if (!q) return runMachine();
  promptInput.placeholder = q.placeholder;
  if (q.question) await say(q.question(), { options: q.optionsFor ? q.optionsFor() : null });
  else if (q.optionsFor) await addOptions(thread.lastElementChild.querySelector('.ai__body'), q.optionsFor());
  promptInput.value = ''; prompt.classList.remove('is-ready');
  S.busy = false;
  promptInput.focus();
}

promptInput.addEventListener('input', () => prompt.classList.toggle('is-ready', promptInput.value.trim().length > 0));
promptForm.addEventListener('submit', e => { e.preventDefault(); submit(promptInput.value); });

async function submit(raw) {
  if (S.busy) return;
  const text = (raw || '').trim();
  const q = SCRIPT[S.step];
  if (!q) return;
  if (!text) { prompt.classList.add('is-shake'); setTimeout(() => prompt.classList.remove('is-shake'), 440); return; }

  S.busy = true;
  promptInput.value = ''; prompt.classList.remove('is-ready');
  clearOptions();

  if (q.key === 'website') {
    /* Everything is inferred here — the visitor is never asked to classify. */
    S.profile = readWebsite(text);
    S.domain = S.profile.domain; S.brand = S.profile.name; S.pages = S.profile.pages;
    S.industryLabel = S.profile.ind;
    S.data = INDUSTRIES[S.profile.ind] || DEFAULT_INDUSTRY;
    S.comps = S.profile.peers.slice(0, 3);
    deriveNumbers();
    $('#railSession').hidden = false;
    $('#railThreadLabel').textContent = S.brand;
    restartBtn.classList.add('is-on');
    setAnalysisLabel(true);
    undockInput();
    thread.hidden = false;
  }
  if (q.key === 'focus') {
    const match = Object.keys(FOCUS).find(k => k.toLowerCase() === text.toLowerCase())
      || Object.keys(FOCUS).find(k => text.toLowerCase().includes(k.split(' ')[0].toLowerCase()));
    S.focus = match || 'Growth opportunities';
    S.focusLine = FOCUS[S.focus].line;
    S.focusLead = FOCUS[S.focus].lead;
    if (!match) S.challenge = text.slice(0, 90);   // they typed their own goal — keep their words
  }
  if (q.key === 'who') {
    S.who = text.slice(0, 48);
    S.firstName = (S.who.split(/[\s,]+/)[0] || '').replace(/[^\p{L}\p{N}'’-]/gu, '') || 'there';
    S.firstName = S.firstName.charAt(0).toUpperCase() + S.firstName.slice(1);
  }
  if (q.key === 'role') {
    const match = ROLES.find(r => r.toLowerCase() === text.toLowerCase());
    S.role = match || text.slice(0, 40);
    S.roleArticle = /chief|founder|ceo/i.test(S.role) ? 'board' : 'leadership';
  }
  if (q.key === 'competitors') {
    const keep = /^(those three|yes|correct|right|keep|no|none)/i.test(text);
    if (!keep) {
      const typed = text.split(/,|\band\b|\//).map(t => t.trim())
        .filter(t => t.length > 1 && t.length < 28 && !/^add someone/i.test(t));
      if (typed.length) S.comps = [...new Set([...typed, ...S.comps])].slice(0, 3);
    }
    S.comps = S.comps.filter(c => c.toLowerCase() !== S.brand.toLowerCase());
    if (!S.comps.length) S.comps = S.profile.peers.slice(0, 3);
  }

  addUser(text);
  await wait(REDUCED ? 30 : 200);
  await q.reply();
  S.step++;
  await wait(REDUCED ? 30 : 420);
  askStep();
}

/* Click or Enter completes an in-flight typewriter — built for live presenting. */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { app.classList.remove('rail-open'); closeModal(); }
  if (skipType && (e.key === 'Enter' || e.key === ' ')) skipType();
});
stage.addEventListener('click', e => { if (skipType && !e.target.closest('button,input,a')) skipType(); });

/* ─────────────────────────── MACHINE MODE ─────────────────────────── */

async function runMachine() {
  S.busy = true;
  restartBtn.classList.remove('is-on');

  const status = $('#runStatus'), meter = $('#runMeter');
  status.innerHTML = '';
  meter.style.width = '0';

  show('run');                       // same room, same sidebar — only the centre changes
  await wait(REDUCED ? 30 : 220);

  const STEP = REDUCED ? 30 : 880;
  for (let i = 0; i < STATUS_LINES.length; i++) {
    status.innerHTML = `<span>${STATUS_LINES[i]}…</span>`;
    meter.style.width = ((i + 1) / STATUS_LINES.length * 100) + '%';
    await wait(STEP);
  }
  await wait(REDUCED ? 20 : 260);

  buildBrief();
  show('brief');
  $('#railBrief').hidden = false;
  $('#railBriefLabel').textContent = `Executive Brief · ${S.brand}`;
  restartBtn.classList.add('is-on');
  S.briefReady = true; S.busy = false;
}

/* ─────────────────────────── THE BRIEF ─────────────────────────── */

function buildBrief() {
  const A = computeAnalysis(S);
  const { b, c1, c2, cat, lead, quotes } = A;
  const trends = A.trends;
  const modelScores = A.models;
  const OPPS = A.opps, SOLUTIONS = A.solutions, HOR = A.horizons;
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const bar = (v, cls) => `<i class="${cls}" style="--w:${v}%"></i>`;

  $('#brief').innerHTML = `
  <header class="bmast reveal">
    <div class="bmast__top">
      <span class="bmast__badge"><i class="pulse"></i>Executive AI Brief</span>
      <span class="bmast__badge">${S.firstName ? 'Prepared for ' + esc(S.firstName) + (S.role ? ' · ' + esc(S.role) : '') : 'Confidential preview'}</span>
    </div>
    <h1>${esc(b)}.<br><span>Read, diagnosed, and priced.</span></h1>
    <div class="bmast__meta">
      <span>Source <b>${esc(S.domain)}</b></span><span>Generated <b>${today}</b></span>
      <span>Elapsed <b>41 seconds</b></span><span>Engines <b>10</b></span>
      <span>Sources read <b>41,882</b></span><span>Category <b>${esc(S.industryLabel || 'General')}</b></span>
      <span>Focus <b>${esc(S.focus)}</b></span>
    </div>
    <div class="bmast__acts">
      <button class="btn btn--dark" data-cta="workspace">Request the full workspace</button>
      <button class="btn btn--ghost" data-cta="pdf">Download as PDF</button>
      <button class="btn btn--ghost" data-cta="share">Share with my team</button>
    </div>
  </header>

  <section class="bsec reveal">
    <div class="bhead"><h2>Executive summary</h2><i></i><span class="tag">Section 01</span></div>
    <p class="bsum">You asked me to lead on ${esc(S.focusLine)}. Here is what I found. ${esc(b)} holds a defensible position in ${cat} — brand equity sits at <b>${S.equity}</b> against a category mean of 58. The machines that now mediate your category do not know it: across eight language models ${esc(b)} is named in <b>${S.aiVis}%</b> of relevant answers where ${esc(c1)} is named in <b>${lead}%</b>.${S.challenge ? ` You called it “${esc(S.challenge.slice(0, 88))}” — this brief prices it.` : ''} The gap is a supply problem in earned citation, and it is the cheapest thing on this page to fix.</p>
    <div class="kpis">
      <div class="kpi"><span class="kpi__k">Brand equity · BERA</span>
        <span class="kpi__v">${S.equity}<small>/100</small></span>
        <span class="kpi__d up">▲ 4 pts vs last quarter</span>
        <span class="kpi__bar" style="--w:${S.equity}%"><i></i></span></div>
      <div class="kpi"><span class="kpi__k">AI visibility · GEOPulse</span>
        <span class="kpi__v">${S.aiVis}<small>/100</small></span>
        <span class="kpi__d down">▼ ${S.gap} pts behind ${esc(c1)}</span>
        <span class="kpi__bar" style="--w:${S.aiVis}%"><i></i></span></div>
      <div class="kpi"><span class="kpi__k">Share of voice · NewIntel</span>
        <span class="kpi__v">${S.sov}<small>%</small></span>
        <span class="kpi__d flat">— flat, 3 quarters</span>
        <span class="kpi__bar" style="--w:${S.sov * 3}%"><i></i></span></div>
      <div class="kpi"><span class="kpi__k">Creator affinity · IMAI</span>
        <span class="kpi__v">${S.creators}</span>
        <span class="kpi__d up">▲ unpaid, unmanaged</span>
        <span class="kpi__bar" style="--w:64%"><i></i></span></div>
    </div>
  </section>

  <section class="bsec reveal">
    <div class="bhead"><h2>How AI describes you</h2><i></i><span class="tag">Section 02 · GEOPulse</span></div>
    <div class="vis">
      ${modelScores.map(s => `<div class="visrow">
          <span class="visrow__n">${s.m}</span>
          <span class="visrow__track">${bar(s.me, 'me')}${bar(s.them, 'them')}</span>
          <span class="visrow__v">${s.me}% · ${s.them}%</span></div>`).join('')}
    </div>
    <div class="vislegend"><span><i></i>${esc(b)}</span><span><i class="them"></i>${esc(c1)}</span>
      <span>Share of relevant answers, 30-day window</span></div>
    <div class="quotes">
      ${quotes.map(q => `<div class="quote"><p>${q[0]}</p><b>${q[1]}</b></div>`).join('')}
    </div>
  </section>

  <section class="bsec reveal">
    <div class="bhead"><h2>Competitor snapshot</h2><i></i><span class="tag">Section 03 · NewIntel</span></div>
    <table class="tbl">
      <thead><tr><th>Brand</th><th>AI visibility</th><th>Equity trend</th><th>Creator momentum</th><th>Last move — this week</th></tr></thead>
      <tbody>
        <tr class="you"><td class="nm" data-label="Brand">${esc(b)}</td>
          <td data-label="AI visibility"><span class="mini" style="--w:${S.aiVis}%"><i></i></span> ${S.aiVis}</td>
          <td data-label="Equity trend"><span class="pill pill--up">▲ 4</span></td>
          <td data-label="Creator momentum">Unmanaged</td>
          <td data-label="Last move">—</td></tr>
        ${A.competitors.map(c => `<tr><td class="nm" data-label="Brand">${esc(c.name)}</td>
            <td data-label="AI visibility"><span class="mini" style="--w:${c.vis}%"><i></i></span> ${c.vis}</td>
            <td data-label="Equity trend"><span class="pill pill--${c.up ? 'up' : 'down'}">${c.up ? '▲' : '▼'} ${c.delta}</span></td>
            <td data-label="Creator momentum">${c.momentum}</td>
            <td data-label="Last move">${c.move}</td></tr>`).join('')}
      </tbody>
    </table>
  </section>

  <section class="bsec reveal">
    <div class="bhead"><h2>What is moving in your industry</h2><i></i><span class="tag">Section 04 · HarrisQuest</span></div>
    <div class="cards">
      ${trends.map((t, i) => `<article class="card">
        <span class="card__k">Trend 0${i + 1}</span><h3>${t[0]}</h3><p>${t[1]}</p>
        <span class="card__foot">${i === 2 ? 'HarrisX · six markets' : 'Stagwell signal index'}</span></article>`).join('')}
    </div>
  </section>

  <section class="bsec reveal">
    <div class="bhead"><h2>Where the value is</h2><i></i><span class="tag">Section 05 · ranked</span></div>
    <div class="opps">
      ${OPPS.map((o, i) => `<article class="opp">
        <span class="opp__r">0${i + 1}</span>
        <div class="opp__b"><h3>${o.h}</h3><p>${o.p}</p>
          <div class="opp__engines">${o.e.map(e => `<span class="tagx">${e}</span>`).join('')}</div></div>
        <div class="opp__m">
          <span class="opp__lift">${o.lift}<small>${o.l}</small></span>
          <span class="meter"><b>Impact<span>${o.impact}</span></b><i style="--w:${o.impact}%"></i></span>
          <span class="meter"><b>Effort<span>${o.effort}</span></b><i style="--w:${o.effort}%"></i></span>
        </div></article>`).join('')}
    </div>
  </section>

  <section class="bsec reveal">
    <div class="bhead"><h2>What we would put on it</h2><i></i><span class="tag">Section 06 · Stagwell AI</span></div>
    <div class="cards">
      ${SOLUTIONS.map(s => `<article class="card">
        <span class="card__k">${s[0]}</span><h3>${s[1]}</h3><p>${s[2]}</p>
        <span class="card__foot">${s[3]}</span></article>`).join('')}
    </div>
  </section>

  <section class="bsec reveal">
    <div class="bhead"><h2>The research behind this</h2><i></i><span class="tag">Section 07 · HarrisX</span></div>
    <ul class="studies">
      ${STUDIES.map(s => `<li class="study">
        <span class="study__t">${s[0]}${s[2] ? '<span class="rel">Relevant to you</span>' : ''}</span>
        <span class="study__m">${s[1]}</span></li>`).join('')}
    </ul>
  </section>

  <section class="bsec reveal">
    <div class="bhead"><h2>The first ninety days</h2><i></i><span class="tag">Section 08 · suggested</span></div>
    <div class="horizons">
      ${HOR.map(h => `<div class="horizon">
        <div class="horizon__h"><b>${h[0]}</b><span>${h[1]}</span></div>
        <ul>${h[2].map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('')}
    </div>
  </section>

  <section class="bvideo reveal">
    <div class="bvideo__in">
      <p class="eyebrow"><i class="pulse"></i>Section 09 · DoReel</p>
      <h2>Your diagnosis, presented back to you.</h2>
      <p>An AI presenter delivers these findings — about ${esc(b)}, addressed to ${S.firstName ? esc(S.firstName) : 'you'}, produced seconds after one website was typed. This is the version your CEO watches.</p>
      <div class="player" id="player">
        <span class="player__grid"></span><span class="player__figure"></span>
        <span class="player__hud"><i></i>DoReel · rendered 41s ago</span>
        <button class="player__play" aria-label="Play">
          <svg viewBox="0 0 26 26" width="24" height="24"><path d="M8 5.2l11 6.8-11 6.8V5.2Z" fill="currentColor"/></svg>
        </button>
        <p class="player__cap" id="playerCap"></p>
        <span class="player__wave" id="playerWave">${'<i></i>'.repeat(46)}</span>
        <span class="player__bar"><i id="playerBar"></i></span>
      </div>
      <button class="btn btn--ghost-void" data-cta="video">Generate the full cut</button>
    </div>
  </section>

  <section class="binsight reveal">
    <div class="bhead"><span class="tag">Section 10 · Executive insight</span><i></i></div>
    <blockquote>
      <p>Instead of feeding the vicious cycle of news demonetization, advertisers should kickstart a virtuous cycle of investing in news.</p>
      <footer><b>Mark Penn</b><i></i><span>Chairman &amp; CEO, Stagwell</span></footer>
    </blockquote>
  </section>

  <section class="bcta">
    <div class="bcta__in">
      <h2>This is the preview.<br><span>The workspace is the product.</span></h2>
      <p class="bcta__lede">${S.firstName ? esc(S.firstName) + ', you' : 'You'} typed one website. The full ${esc(b)} workspace runs this continuously — every engine, every day, against every competitor you name.</p>
      <div class="bcta__grid">
        ${[
          ['Book a strategy session','Sixty minutes with the team that built the machine.','session'],
          ['Talk to an AI expert','A working conversation, not a pitch.','expert'],
          ['Request your full AI workspace','All ten engines, pointed at your brand.','workspace'],
          ['See what’s possible','The wider Stagwell AI product pool.','possible'],
        ].map(c => `<button class="ctacard" data-cta="${c[2]}">
          <b>${c[0]}<svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></b>
          <span>${c[1]}</span></button>`).join('')}
      </div>
      <div class="callback">
        <div class="callback__t">
          <b><i class="pulse"></i>Or let the machine call you.</b>
          <span>Leave a number and a NewVoices agent calls within two minutes — already holding this diagnosis.</span>
        </div>
        <form data-cta="callback">
          <input type="tel" placeholder="+1 (555) 000-0000" aria-label="Phone number">
          <button class="btn btn--light" type="submit">Call me now</button>
        </form>
      </div>

      <div class="bcta__acts">
        <button class="btn btn--light" data-cta="workspace">Request the full workspace</button>
        <button class="btn btn--ghost-void" data-cta="pdf">Download as PDF</button>
        <button class="btn btn--ghost-void" data-cta="share">Share with my team</button>
      </div>
    </div>
  </section>

  <footer class="bfoot">
    <svg><use href="#sw-logo"/></svg>
    <span>Prototype · scripted demonstration · figures illustrative · nothing leaves this page</span>
  </footer>`;

  observeReveals();
  wirePlayer();
  $('#briefScroll').scrollTop = 0;
}

/* ─────────────────────────── REVEALS ─────────────────────────── */

let io;
function observeReveals() {
  io?.disconnect();
  io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { root: $('#briefScroll'), threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
  $$('.reveal', $('#brief')).forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i, 2) * 80}ms`; io.observe(el);
  });
  setTimeout(() => $$('.reveal', $('#brief')).slice(0, 2).forEach(el => el.classList.add('is-in')), 80);
}

/* ─────────────────────────── VIDEO PREVIEW ─────────────────────────── */

function wirePlayer() {
  const p = $('#player'); if (!p) return;
  const cap = $('#playerCap'), barEl = $('#playerBar'), bars = $$('#playerWave i');
  const script = [
    `${S.firstName ? S.firstName + ', here' : 'Here'} is ${S.brand}'s diagnosis — generated forty seconds ago.`,
    `Your brand equity is strong. Your visibility inside AI answers is not.`,
    `${S.comps[0] || 'Your closest rival'} is named ${S.gap} points more often than you are.`,
    `Three moves close that gap. The first one costs almost nothing.`,
  ];
  let playing = false, timers = [];
  const stop = () => {
    playing = false; p.classList.remove('is-playing');
    timers.forEach(t => { clearTimeout(t); clearInterval(t); }); timers = [];
    cap.textContent = ''; barEl.style.transition = 'none'; barEl.style.width = '0';
  };
  p.addEventListener('click', () => {
    if (playing) return stop();
    playing = true; p.classList.add('is-playing');
    timers.push(setInterval(() => bars.forEach(x => (x.style.height = (12 + Math.random() * 88) + '%')), 90));
    let t = 0;
    script.forEach(line => { timers.push(setTimeout(() => { cap.textContent = line; }, t)); t += 2600; });
    barEl.style.transition = `width ${t + 600}ms linear`;
    requestAnimationFrame(() => (barEl.style.width = '100%'));
    timers.push(setTimeout(stop, t + 600));
  });
}

/* ─────────────────────────── RESTART ─────────────────────────── */

async function restart() {
  if (S.busy) return;
  restartBtn.classList.remove('is-on');
  show('workspace');
  await wait(REDUCED ? 20 : 240);

  Object.assign(S, {
    step:0, busy:false, briefReady:false, domain:'', brand:'', legal:'', who:'', firstName:'',
    industryLabel:'', data:DEFAULT_INDUSTRY, profile:null, comps:[], challenge:'',
    focus:'Growth opportunities', focusLine:'where the next points of growth actually sit', focusLead:1,
    role:'', roleArticle:'board',
  });
  thread.innerHTML = ''; thread.hidden = true;
  ctxList.innerHTML = ''; ctx.hidden = true; app.classList.remove('has-ctx');
  $('#ctxBar').style.width = '0'; $('#ctxPct').textContent = '0';
  $('#brief').innerHTML = '';
  $('#railSession').hidden = true; $('#railBrief').hidden = true;
  $('#railThreadLabel').textContent = 'New analysis';
  promptInput.value = ''; promptInput.placeholder = SCRIPT[0].placeholder;
  prompt.classList.remove('is-ready');

  setAnalysisLabel(false);
  wsView.classList.add('is-welcome');
  seatComposer();
  requestAnimationFrame(() => promptInput.focus());
}
restartBtn.addEventListener('click', restart);
$('#newAnalysis').addEventListener('click', restart);

/* "Start analysis" until one exists in the session, "Start new analysis" after. */
function setAnalysisLabel(hasOne) {
  const label = hasOne ? 'Start new analysis' : 'Start analysis';
  $('#newAnalysisLabel').textContent = label;
  $('#restartLabel').textContent = label;
}

/* ─────────────────────────── MODAL ─────────────────────────── */

const modal = $('#modal'), modalBody = $('#modalBody');
const closeModal = () => { modal.hidden = true; };
$$('[data-close]', modal).forEach(e => e.addEventListener('click', closeModal));

const CTA_COPY = {
  session:   ['Book a strategy session','Sixty minutes with the team that built the machine. We arrive with your diagnosis already open.'],
  expert:    ['Talk to an AI expert','A working conversation about what the machine found — and what it would take to fix it.'],
  workspace: ['Request your full AI workspace','All ten engines, pointed at your brand, running continuously. We provision in five working days.'],
  possible:  ['See what’s possible','A walkthrough of the wider Stagwell AI product pool and the work it is already doing.'],
  video:     ['Generate the full cut','A three-minute presenter video of this diagnosis, rendered by DoReel and delivered to your inbox.'],
  pdf:       ['Download this brief','We will send the full Executive AI Brief as a designed PDF, plus the raw engine outputs.'],
  share:     ['Share with your team','We will generate a private link to this brief that your team can open without signing in.'],
  callback:  ['The machine will call you','A NewVoices agent will call within two minutes, already holding this diagnosis.'],
};

function openModal(kind) {
  const [t, p] = CTA_COPY[kind] || CTA_COPY.expert;
  modalBody.innerHTML = `
    <div class="modal__brand"><svg><use href="#sw-logo"/></svg><span>AI</span></div>
    <h3>${t}</h3><p>${p}</p>
    <form class="modal__form" id="leadForm">
      <input type="text" placeholder="Full name" value="${esc(S.who || '')}" required>
      <input type="email" placeholder="Work email" required>
      <input type="text" placeholder="Role — e.g. CMO, VP Marketing" value="${esc(S.role || '')}" required>
      <button class="btn btn--dark" type="submit">${kind === 'callback' ? 'Call me now' : 'Continue'}</button>
    </form>
    <p class="modal__fine">Prototype only — nothing is submitted or stored.</p>`;
  modal.hidden = false;
  $('#leadForm').addEventListener('submit', e => {
    e.preventDefault();
    modalBody.innerHTML = `
      <div class="modal__ok">
        <span class="modal__tick"><svg viewBox="0 0 20 20" width="20" height="20"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <h3>The machine has your brief.</h3>
        <p>Your ${esc(S.brand || 'brand')} diagnosis has been enriched by SATS and scored. Someone who already understands the account will be in touch — not an SDR reading a script.</p>
        <button class="btn btn--dark" data-close>Back to the brief</button>
      </div>`;
    $$('[data-close]', modalBody).forEach(x => x.addEventListener('click', closeModal));
  });
  setTimeout(() => $('#leadForm input')?.focus(), 120);
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-cta]');
  if (t && t.tagName !== 'FORM') { e.preventDefault(); openModal(t.dataset.cta); }
});
document.addEventListener('submit', e => {
  if (e.target.matches('form[data-cta]')) { e.preventDefault(); openModal(e.target.dataset.cta); }
});

/* ─────────────────────────── STATIC VIEWS ─────────────────────────── */

$('#partners').innerHTML = PARTNERS.map(([k, n]) =>
  `<div class="partner" title="${n}"><img src="${partnerSrc(k)}" alt="${n}" loading="lazy"
     style="--s:${LOGO_SCALE[k] || 1}"></div>`).join('');
$('#studies').innerHTML = STUDIES.map(s =>
  `<li class="study"><span class="study__t">${s[0]}</span><span class="study__m">${s[1]}</span></li>`).join('');

/* Placeholder breathes through a few inspiring examples — the only hint on screen. */
const IDEAS = ['nike.com','airbnb.com','openai.com','yourcompany.com'];
let ideaI = 0;
setInterval(() => {
  if (S.step !== 0 || document.activeElement === promptInput || S.view !== 'workspace') return;
  ideaI = (ideaI + 1) % IDEAS.length;
  promptInput.style.transition = 'opacity 280ms';
  promptInput.style.opacity = '0';
  setTimeout(() => { promptInput.placeholder = IDEAS[ideaI]; promptInput.style.opacity = '1'; }, 280);
}, 3600);

/* ─────────────────────────── BOOT ─────────────────────────── */

function jumpToBrief(params) {
  const p = readWebsite(params.get('brief') || 'nike.com');
  S.profile = p; S.domain = p.domain; S.brand = p.name; S.pages = p.pages;
  S.industryLabel = p.ind || 'Consumer & Retail';
  S.data = INDUSTRIES[S.industryLabel] || DEFAULT_INDUSTRY;
  S.comps = (params.get('vs') || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!S.comps.length) S.comps = p.peers.length ? p.peers.slice(0, 3) : ['Northbeam','Aperture Group','Meridian'];
  S.firstName = params.get('who') || '';
  S.focus = params.get('focus') || 'Growth opportunities';
  S.focusLine = (FOCUS[S.focus] || FOCUS['Growth opportunities']).line;
  S.focusLead = (FOCUS[S.focus] || FOCUS['Growth opportunities']).lead;
  S.step = SCRIPT.length;
  deriveNumbers();
  buildBrief();
  $('#railSession').hidden = false; $('#railBrief').hidden = false;
  $('#railThreadLabel').textContent = S.brand;
  $('#railBriefLabel').textContent = `Executive Brief · ${S.brand}`;
  restartBtn.classList.add('is-on');
  setAnalysisLabel(true);
  wsView.classList.remove('is-welcome');
  S.briefReady = true;
  show('brief');
}

(async function boot() {
  const params = new URLSearchParams(location.search);
  await wait(REDUCED || params.has('brief') ? 60 : 1650);
  if (params.has('brief')) { jumpToBrief(params); return; }
  show('workspace');
  seatComposer();
  requestAnimationFrame(() => promptInput.focus());
  if (params.has('view')) show(params.get('view'));
})();

})();
