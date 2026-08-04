/* ═══════════════════════════════════════════════════════════════════════════
   STAGWELL AI — VERSION B
   A classic landing page. Same machine, same script, same numbers as version A
   (all of it from shared.js) — but the answer arrives as a live dashboard
   sitting inside the page, not as a report in a workspace.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const { esc, pick, PARTNERS, partnerSrc, LOGO_SCALE, STUDIES, INDUSTRIES, DEFAULT_INDUSTRY,
        readWebsite, STATUS_LINES, FOCUS, ROLES, numbersFor, computeAnalysis } = window.SWAI;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ─────────────────────────── STATE ─────────────────────────── */

const S = {
  step:0, busy:false, done:false,
  domain:'', brand:'', who:'', firstName:'', role:'', roleArticle:'board',
  industryLabel:'', data:DEFAULT_INDUSTRY, profile:null, comps:[], challenge:'', pages:42,
  focus:'Growth opportunities', focusLine:'where the next points of growth actually sit', focusLead:1,
  equity:62, aiVis:41, sov:18, gap:40, creators:'1,204', seed:1,
};

const thread = $('#thread'), promptForm = $('#promptForm'), promptInput = $('#promptInput');
const prompt = $('.prompt'), hero = $('#hero2');

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

/* ─────────────────────────── CONVERSATION ─────────────────────────── */

const scrollThread = () => requestAnimationFrame(() =>
  thread.scrollTo({ top: thread.scrollHeight, behavior: REDUCED ? 'auto' : 'smooth' }));

function aiTurn() {
  const t = document.createElement('div');
  t.className = 'turn';
  t.innerHTML = `<div class="ai">
      <svg class="ai__mark"><use href="#sw-mark"/></svg>
      <div class="ai__body"><p class="ai__who">Stagwell AI</p>
        <div class="thinking"><i></i><i></i><i></i></div></div></div>`;
  thread.appendChild(t); scrollThread();
  return $('.ai__body', t);
}

function addUser(text) {
  const t = document.createElement('div');
  t.className = 'turn turn--user';
  t.innerHTML = `<div class="bubble">${esc(text)}</div>`;
  thread.appendChild(t); scrollThread();
}

async function say(html, { options, node, delay = 620 } = {}) {
  const body = node || aiTurn();
  await wait(REDUCED ? 40 : delay + Math.random() * 240);
  $('.thinking', body)?.remove();
  const p = document.createElement('p'); p.className = 'ai__text';
  body.appendChild(p);
  await typeHTML(p, html);
  scrollThread();
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
    body.appendChild(wrap); scrollThread();
    setTimeout(resolve, 120);
  });
}

const clearOptions = () => $$('.opts', thread).forEach(o => {
  o.classList.add('is-gone'); setTimeout(() => o.remove(), 460);
});

function inferenceCard(p) {
  const rows = [
    ['Company', p.legal || p.name], ['Industry', p.ind], ['What you do', p.what],
    ['Positioning', p.pos], ['Likely audience', p.audience], ['Brand language', p.tone],
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

const SCRIPT = [
  {
    key: 'website', placeholder: 'nike.com',
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
      scrollThread();
      await wait(REDUCED ? 40 : 820);

      const what = S.profile.what.charAt(0).toLowerCase() + S.profile.what.slice(1);
      const where = S.profile.confident ? `, out of ${esc(S.profile.hq)}` : '';
      await say(`I have reviewed <em>${esc(S.brand)}</em>. You appear to operate across ${esc(what)}${where} — positioned as ${esc(S.profile.pos.toLowerCase())}. In the answer layer you sit against ${esc(S.profile.peers.slice(0, 2).join(' and '))}. <span class="hl">I have what I need.</span> What would you like me to focus on first?`,
        { node: body, delay: 220, options: Object.keys(FOCUS) });
      return body;
    },
  },
  { key: 'focus', placeholder: 'Or tell me in your own words',
    async reply() { await say(`Good. I will lead on ${esc(S.focusLine)}.`); } },
  { key: 'who', placeholder: 'Your name',
    question: () => `Before I build it — who am I speaking to?`,
    async reply() { await say(`Good to meet you, <em>${esc(S.firstName)}</em>.`); } },
  { key: 'role', placeholder: 'Your role',
    question: () => `And what is your role at <em>${esc(S.brand)}</em>?`,
    optionsFor: () => ROLES,
    async reply() {
      const more = S.focus === 'Competitive positioning' ? '' : ' <span class="hl">Give me forty seconds.</span>';
      await say(`Noted — I will build this at ${esc(S.roleArticle)} altitude.${more}`);
    } },
  { key: 'competitors', skipIf: () => S.focus !== 'Competitive positioning',
    placeholder: 'A name, or press enter to keep mine',
    question: () => `One last thing. I am benchmarking you against <em>${S.comps.join('</em>, <em>')}</em> — anyone else you measure yourself by?`,
    optionsFor: () => ['Those three are right', 'Add someone I should watch'],
    async reply() {
      await say(`Locked. <span class="hl">Give me forty seconds.</span>`);
    } },
];

function nextIndex(from) {
  let i = from;
  while (i < SCRIPT.length && SCRIPT[i].skipIf && SCRIPT[i].skipIf()) i++;
  return i;
}

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

promptInput.addEventListener('input', () =>
  prompt.classList.toggle('is-ready', promptInput.value.trim().length > 0));
promptForm.addEventListener('submit', e => { e.preventDefault(); submit(promptInput.value); });
$$('.chat__eg').forEach(b => b.addEventListener('click', () => submit(b.dataset.eg)));

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
    S.profile = readWebsite(text);
    S.domain = S.profile.domain; S.brand = S.profile.name; S.pages = S.profile.pages;
    S.industryLabel = S.profile.ind;
    S.data = INDUSTRIES[S.profile.ind] || DEFAULT_INDUSTRY;
    S.comps = S.profile.peers.slice(0, 3);
    Object.assign(S, numbersFor(S.domain, S.brand));
    thread.hidden = false;
    $('#chatHint').hidden = true;
    $('#heroEyebrow').textContent = '';
    hero.classList.add('is-chatting');
  }
  if (q.key === 'focus') {
    const match = Object.keys(FOCUS).find(k => k.toLowerCase() === text.toLowerCase())
      || Object.keys(FOCUS).find(k => text.toLowerCase().includes(k.split(' ')[0].toLowerCase()));
    S.focus = match || 'Growth opportunities';
    S.focusLine = FOCUS[S.focus].line;
    S.focusLead = FOCUS[S.focus].lead;
    if (!match) S.challenge = text.slice(0, 90);
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

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { document.body.classList.remove('nav-open'); closeModal(); }
  if (skipType && (e.key === 'Enter' || e.key === ' ')) skipType();
});

/* ─────────────────────────── THINKING ─────────────────────────── */

async function runMachine() {
  S.busy = true;
  const think = $('#think'), status = $('#thinkStatus'), meter = $('#thinkMeter');
  status.innerHTML = ''; meter.style.width = '0';
  think.hidden = false; think.classList.remove('is-out');
  document.body.style.overflow = 'hidden';
  await wait(REDUCED ? 30 : 220);

  const STEP = REDUCED ? 30 : 880;
  for (let i = 0; i < STATUS_LINES.length; i++) {
    status.innerHTML = `<span>${STATUS_LINES[i].replace('Executive AI Brief', 'dashboard')}…</span>`;
    meter.style.width = ((i + 1) / STATUS_LINES.length * 100) + '%';
    await wait(STEP);
  }
  await wait(REDUCED ? 20 : 260);

  buildDashboard();
  /* the transcript has done its job — the hero goes back to being a hero */
  thread.innerHTML = ''; thread.hidden = true;
  hero.classList.remove('is-chatting');
  $('#hero2Title').innerHTML = `Here is <span class="accent">${esc(S.brand)}.</span>`;
  $('#hero2Sub').textContent = `Built from one link, ${S.firstName || 'for you'} — ask me anything else below, or read the dashboard.`;
  $('#heroEyebrow').innerHTML = '<i class="pulse"></i>Analysis complete';
  promptInput.placeholder = 'Ask a follow-up, or type another website';
  S.done = true;

  think.classList.add('is-out');
  document.body.style.overflow = '';
  setTimeout(() => { think.hidden = true; }, 560);
  await wait(REDUCED ? 20 : 240);
  $('#dash').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  S.busy = false;
}

/* ─────────────────────────── DASHBOARD ─────────────────────────── */

function sparkBars(seed, n = 14) {
  return Array.from({ length: n }, (_, i) =>
    `<i style="height:${pick(seed >> (i % 12), 22, 100)}%;animation-delay:${i * 34}ms"></i>`).join('');
}

function buildDashboard() {
  const A = computeAnalysis(S);
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const TABS = [
    ['overview', 'Overview', ''],
    ['visibility', 'AI visibility', '8'],
    ['competitors', 'Competitors', String(S.comps.length)],
    ['opportunities', 'Opportunities', '3'],
    ['market', 'Market', '3'],
    ['plan', 'Plan', '90d'],
    ['research', 'Research', '9'],
  ];

  const kpi = (k, v, unit, d, cls, seed) => `
    <div class="card2 card2--4">
      <span class="card2__k">${k}</span>
      <span class="card2__v">${v}${unit ? `<small>${unit}</small>` : ''}</span>
      <span class="card2__d ${cls}">${d}</span>
      <span class="spark">${sparkBars(seed)}</span>
    </div>`;

  $('#dash').innerHTML = `
  <div class="dash__in">
    <div class="dash__head">
      <div class="dash__id">
        <p class="eyebrow"><i class="pulse"></i>Live dashboard${S.firstName ? ' · for ' + esc(S.firstName) : ''}</p>
        <h2>${esc(S.brand)}</h2>
        <div class="dash__meta">
          <span>Source <b>${esc(S.domain)}</b></span><span>Built <b>${today}</b></span>
          <span>Elapsed <b>41s</b></span><span>Engines <b>10</b></span>
          <span>Category <b>${esc(S.industryLabel)}</b></span><span>Focus <b>${esc(S.focus)}</b></span>
        </div>
      </div>
      <div class="dash__acts">
        <button class="btn btn--dark" data-cta="workspace">Request the full workspace</button>
        <button class="btn btn--ghost" data-cta="pdf">Export</button>
      </div>
    </div>

    <div class="tabs" id="tabs">
      ${TABS.map((t, i) => `<button class="tab${i ? '' : ' is-on'}" data-tab="${t[0]}">${t[1]}${t[2] ? `<em>${t[2]}</em>` : ''}</button>`).join('')}
    </div>

    <!-- OVERVIEW -->
    <div class="panel is-on" data-panel="overview">
      <div class="grid">
        ${kpi('Brand equity · BERA', S.equity, '/100', '▲ 4 pts vs last quarter', 'up', S.seed)}
        ${kpi('AI visibility · GEOPulse', S.aiVis, '/100', `▼ ${S.gap} pts behind ${esc(A.c1)}`, 'down', S.seed >> 2)}
        ${kpi('Share of voice · NewIntel', S.sov, '%', '— flat, 3 quarters', 'flat', S.seed >> 4)}
        ${kpi('Creator affinity · IMAI', S.creators, '', '▲ unpaid, unmanaged', 'up', S.seed >> 6)}

        <div class="card2 card2--8">
          <span class="card2__k">The read</span>
          <p style="font-size:var(--t-lede);line-height:1.62;color:var(--ink-2)">
            You asked me to lead on ${esc(S.focusLine)}. ${esc(A.b)} holds a defensible position in ${A.cat} — equity sits at <b style="color:var(--ink)">${S.equity}</b> against a category mean of 58. The machines that now mediate your category do not know it: across eight models ${esc(A.b)} is named in <b style="color:var(--ink)">${S.aiVis}%</b> of relevant answers where ${esc(A.c1)} is named in <b style="color:var(--ink)">${A.lead}%</b>. The gap is a supply problem in earned citation — the cheapest thing here to fix.
          </p>
        </div>
        <div class="card2 card2--4">
          <span class="card2__k">This week · NewIntel</span>
          <div class="feed">
            ${A.competitors.map((c, i) => `<div class="feedrow">
              <span class="feedrow__w"></span>
              <span class="feedrow__t"><b>${esc(c.name)}</b> — ${c.move.replace(/\.$/, '')}</span>
              <span class="feedrow__m">${['2d','4d','6d'][i] || '7d'}</span></div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- AI VISIBILITY -->
    <div class="panel" data-panel="visibility">
      <div class="grid">
        <div class="card2 card2--8">
          <span class="card2__k">Share of relevant answers · 30-day window</span>
          <div class="bars">
            ${A.models.map(m => `<div class="barrow">
              <span class="barrow__n">${m.m}</span>
              <span class="barrow__t"><i class="me" style="--w:${m.me}%"></i><i class="them" style="--w:${m.them}%"></i></span>
              <span class="barrow__v">${m.me}% · ${m.them}%</span></div>`).join('')}
          </div>
          <div class="legend"><span><i></i>${esc(A.b)}</span><span><i class="them"></i>${esc(A.c1)}</span></div>
        </div>
        <div class="card2 card2--4">
          <span class="card2__k">What the models say</span>
          ${A.quotes.map(q => `<div style="padding:14px 0;border-bottom:1px solid var(--line)">
            <p style="font-family:var(--serif);font-size:1rem;line-height:1.5;letter-spacing:-.01em">${q[0]}</p>
            <b style="display:block;margin-top:8px;font-family:var(--mono);font-size:var(--t-label);letter-spacing:.11em;text-transform:uppercase;color:var(--ink-3);font-weight:400">${q[1]}</b>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- COMPETITORS -->
    <div class="panel" data-panel="competitors">
      <div class="grid">
        <div class="card2 card2--12">
          <span class="card2__k">AI visibility · ranked</span>
          <div class="rank">
            <div class="rankrow rankrow--you">
              <b>${esc(A.b)}</b>
              <span class="rankrow__bar"><i style="--w:${S.aiVis}%"></i></span>
              <span class="rankrow__v">${S.aiVis} · you</span>
            </div>
            ${A.competitors.map(c => `<div class="rankrow">
              <b>${esc(c.name)}</b>
              <span class="rankrow__bar"><i style="--w:${c.vis}%"></i></span>
              <span class="rankrow__v">${c.vis} · ${c.up ? '▲' : '▼'} ${c.delta}</span></div>`).join('')}
          </div>
        </div>
        ${A.competitors.map(c => `<div class="card2 card2--4">
          <span class="card2__k">${esc(c.name)}</span>
          <h3>${c.momentum} creator momentum</h3>
          <p>${c.move}</p>
          <span class="card2__foot">Equity ${c.up ? '▲' : '▼'} ${c.delta} · visibility ${c.vis}</span>
        </div>`).join('')}
      </div>
    </div>

    <!-- OPPORTUNITIES -->
    <div class="panel" data-panel="opportunities">
      ${A.opps.map((o, i) => `<article class="oppcard">
        <span class="oppcard__r">0${i + 1}</span>
        <div>
          <h3>${o.h}</h3><p>${o.p}</p>
          <div class="opp__engines">${o.e.map(e => `<span class="tagx">${e}</span>`).join('')}</div>
        </div>
        <div class="oppcard__m">
          <span class="opp__lift">${o.lift}<small>${o.l}</small></span>
          <span class="meter"><b>Impact<span>${o.impact}</span></b><i style="--w:${o.impact}%"></i></span>
          <span class="meter"><b>Effort<span>${o.effort}</span></b><i style="--w:${o.effort}%"></i></span>
        </div></article>`).join('')}
      <div class="grid" style="margin-top:14px">
        ${A.solutions.map(s => `<div class="card2 card2--4">
          <span class="card2__k" style="color:var(--teal)">${s[0]}</span>
          <h3>${s[1]}</h3><p>${s[2]}</p>
          <span class="card2__foot">${s[3]}</span></div>`).join('')}
      </div>
    </div>

    <!-- MARKET -->
    <div class="panel" data-panel="market">
      <div class="grid">
        ${A.trends.map((t, i) => `<div class="card2 card2--4">
          <span class="card2__k">Trend 0${i + 1}</span>
          <h3>${t[0]}</h3><p>${t[1]}</p>
          <span class="card2__foot">${i === 2 ? 'HarrisX · six markets' : 'Stagwell signal index'}</span>
        </div>`).join('')}
        <div class="card2 card2--12">
          <span class="card2__k">Your audience · SATS</span>
          <h3>${esc(S.data.segment)}</h3>
          <p>Resolved against a 260M identity graph and matched to addressable inventory. ${esc(S.creators)} creators already reference ${esc(A.b)} with no commercial relationship.</p>
        </div>
      </div>
    </div>

    <!-- PLAN -->
    <div class="panel" data-panel="plan">
      <div class="plan">
        ${A.horizons.map(h => `<div class="plancol">
          <div class="plancol__h"><b>${h[0]}</b><span>${h[1]}</span></div>
          <ul>${h[2].map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('')}
      </div>
    </div>

    <!-- RESEARCH -->
    <div class="panel" data-panel="research">
      <div class="card2 card2--12">
        <span class="card2__k">HarrisX · cited where relevant to ${esc(A.b)}</span>
        <ul class="studies">
          ${STUDIES.map(s => `<li class="study">
            <span class="study__t">${s[0]}${s[2] ? '<span class="rel">Relevant to you</span>' : ''}</span>
            <span class="study__m">${s[1]}</span></li>`).join('')}
        </ul>
      </div>
    </div>
  </div>`;

  $('#dash').hidden = false;

  $('#tabs').addEventListener('click', e => {
    const t = e.target.closest('.tab'); if (!t) return;
    $$('.tab', $('#tabs')).forEach(x => x.classList.toggle('is-on', x === t));
    $$('.panel', $('#dash')).forEach(p => p.classList.toggle('is-on', p.dataset.panel === t.dataset.tab));
  });
}

/* ─────────────────────────── NAV / MODAL ─────────────────────────── */

$('#navMenu').addEventListener('click', () => document.body.classList.toggle('nav-open'));
$('#navScrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
$$('.nav__links a').forEach(a => a.addEventListener('click', () => document.body.classList.remove('nav-open')));

const modal = $('#modal'), modalBody = $('#modalBody');
const closeModal = () => { modal.hidden = true; };
$$('[data-close]', modal).forEach(e => e.addEventListener('click', closeModal));

const CTA_COPY = {
  session:   ['Book a strategy session','Sixty minutes with the team that built the machine. We arrive with your dashboard already open.'],
  expert:    ['Talk to an AI expert','A working conversation about what the machine found — and what it would take to fix it.'],
  workspace: ['Request your full AI workspace','All ten engines, pointed at your brand, running continuously. We provision in five working days.'],
  possible:  ['See what’s possible','A walkthrough of the wider Stagwell AI product pool and the work it is already doing.'],
  pdf:       ['Export this dashboard','We will send the full analysis as a designed PDF, plus the raw engine outputs.'],
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
        <p>Your ${esc(S.brand || 'brand')} analysis has been enriched by SATS and scored. Someone who already understands the account will be in touch — not an SDR reading a script.</p>
        <button class="btn btn--dark" data-close>Back to the page</button>
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

/* ─────────────────────────── STATIC ─────────────────────────── */

$('#partnersGrid').innerHTML = PARTNERS.map(([k, n]) =>
  `<div class="partner" title="${n}"><img src="${partnerSrc(k)}" alt="${n}" loading="lazy"
     style="--s:${LOGO_SCALE[k] || 1}"></div>`).join('');
$('#studies').innerHTML = STUDIES.map(s =>
  `<li class="study"><span class="study__t">${s[0]}</span><span class="study__m">${s[1]}</span></li>`).join('');

/* ─────────────────────────── BOOT ─────────────────────────── */

(async function boot() {
  const params = new URLSearchParams(location.search);
  await wait(REDUCED || params.has('dash') ? 60 : 1500);
  document.body.dataset.state = 'ready';

  if (params.has('dash')) {                       // deep link straight to a built dashboard
    const p = readWebsite(params.get('dash') || 'nike.com');
    S.profile = p; S.domain = p.domain; S.brand = p.name; S.pages = p.pages;
    S.industryLabel = p.ind; S.data = INDUSTRIES[p.ind] || DEFAULT_INDUSTRY;
    S.comps = p.peers.slice(0, 3);
    S.firstName = params.get('who') || '';
    S.focus = params.get('focus') || 'Growth opportunities';
    S.focusLine = (FOCUS[S.focus] || FOCUS['Growth opportunities']).line;
    S.focusLead = (FOCUS[S.focus] || FOCUS['Growth opportunities']).lead;
    Object.assign(S, numbersFor(S.domain, S.brand));
    S.step = SCRIPT.length; S.done = true;
    buildDashboard();
    $('#hero2Title').innerHTML = `Here is <span class="accent">${esc(S.brand)}.</span>`;
    $('#chatHint').hidden = true;
    return;
  }
  promptInput.focus({ preventScroll: true });
})();

})();
