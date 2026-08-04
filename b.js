/* ═══════════════════════════════════════════════════════════════════════════
   STAGWELL AI — VERSION B
   A classic landing page. Same machine, same script, same numbers as version A
   (all of it from shared.js) — but the answer arrives as a live dashboard
   sitting inside the page, not as a report in a workspace.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const { esc, pick, PARTNERS, partnerSrc, LOGO_SCALE, STUDIES, INDUSTRIES, DEFAULT_INDUSTRY,
        readWebsite, STATUS_LINES, FOCUS, ROLES, numbersFor, computeAnalysis,
        countUp, whenVisible, countAllIn, blurWords, reveal } = window.SWAI;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
/* Only a real pointer gets auto-focus. On touch, focus() summons the keyboard
   unasked and covers the very field it just focused. */
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
const focusPrompt = () => { if (FINE) promptInput.focus({ preventScroll: true }); };

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
      caret.remove(); pin(); if (skipType === finish) skipType = null; resolve();
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
        pin();
        if ('.,—:?'.includes(ch)) { setTimeout(tick, 120); return; }
      }
      if (ni >= nodes.length) return finish();
      setTimeout(tick, speed + Math.random() * 11);
    };
    setTimeout(tick, 50);
  });
}

/* ─────────────────────────── CONVERSATION ─────────────────────────── */

/* Stay pinned to the newest line while it types — waiting for the whole
   message and then jumping reads as though the thing has hung. Released the
   moment the reader scrolls up themselves. */
let stick = true;
thread.addEventListener('scroll', () => {
  stick = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 48;
}, { passive: true });
const pin = () => { if (stick) thread.scrollTop = thread.scrollHeight; };
const scrollThread = () => { stick = true; requestAnimationFrame(pin); };

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
    body.appendChild(wrap);
    /* pin the options into view rather than leaving them below the fold */
    requestAnimationFrame(() => wrap.scrollIntoView({ block: 'end', behavior: REDUCED ? 'auto' : 'smooth' }));
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
  $('#chatStep').textContent = ['Reading the site','Choosing a focus','Who you are','Your role','Your set'][S.step] || 'Ready';
  if (q.question) await say(q.question(), { options: q.optionsFor ? q.optionsFor() : null });
  else if (q.optionsFor) await addOptions(thread.lastElementChild.querySelector('.ai__body'), q.optionsFor());
  promptInput.value = ''; prompt.classList.remove('is-ready');
  S.busy = false;
  focusPrompt();
}

promptInput.addEventListener('focus', () => {
  if (FINE) return;
  setTimeout(() => $('.chat__panel').scrollIntoView({ block: 'end', behavior: 'smooth' }), 320);
});
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
    $('#chatBar').hidden = false;
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
  blurWords($('#hero2Title'));
  $('#hero2Sub').textContent = `Built from one link, ${S.firstName || 'for you'} — ask me anything else below, or read the dashboard.`;
  $('#heroEyebrow').innerHTML = '<i class="pulse"></i>Analysis complete';
  promptInput.placeholder = 'Ask a follow-up, or type another website';
  S.done = true;
  $('#navNew').hidden = false;
  $('.mnav__new').hidden = false;

  think.classList.add('is-out');
  document.body.style.overflow = '';
  setTimeout(() => { think.hidden = true; }, 560);
  await wait(REDUCED ? 20 : 240);
  $('#dash').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  S.busy = false;
}

/* ─────────────────────────── DASHBOARD ─────────────────────────── */

const ICONS = {
  home:'<path d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1V8.5Z"/>',
  chat:'<path d="M3.5 4.5h13v9h-7l-3.5 3v-3h-2.5v-9Z"/>',
  chart:'<path d="M3.5 13.5 7.5 9l3 3 6-7"/><path d="M3.5 16.5h13"/>',
  grid:'<rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1"/><rect x="11" y="3.5" width="5.5" height="5.5" rx="1"/><rect x="3.5" y="11" width="5.5" height="5.5" rx="1"/><rect x="11" y="11" width="5.5" height="5.5" rx="1"/>',
  cal:'<rect x="3.5" y="4.5" width="13" height="12" rx="1.5"/><path d="M3.5 8h13M7 3v3M13 3v3"/>',
  doc:'<path d="M5 3h6l4 4v10H5V3Z"/><path d="M11 3v4h4"/>',
  users:'<circle cx="7.5" cy="8" r="2.6"/><circle cx="13" cy="8" r="2.6"/><path d="M3.5 16c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5"/>',
};

function sparkBars(seed, n = 14) {
  return Array.from({ length: n }, (_, i) =>
    `<i style="height:${pick(seed >> (i % 12), 22, 100)}%;animation-delay:${i * 34}ms"></i>`).join('');
}

/* A six-month area chart drawn from the seed, so it matches the numbers above it. */
function chartSVG(seed) {
  const W = 560, H = 170, n = 6;
  const pts = Array.from({ length: n }, (_, i) => pick(seed >> (i + 2), 26, 96));
  const x = i => (i / (n - 1)) * W;
  const y = v => H - (v / 110) * H;
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const rival = Array.from({ length: n }, (_, i) => pick(seed >> (i + 7), 34, 104));
  const line2 = rival.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Coverage over time">
    <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#009CBD" stop-opacity=".22"/>
      <stop offset="100%" stop-color="#009CBD" stop-opacity="0"/>
    </linearGradient></defs>
    ${[0, .25, .5, .75, 1].map(f => `<line class="chart__g" x1="0" y1="${(H * f).toFixed(0)}" x2="${W}" y2="${(H * f).toFixed(0)}"/>`).join('')}
    <path class="chart__area" d="${area}"/>
    <path class="chart__line2" d="${line2}"/>
    <path class="chart__line" d="${line}"/>
    ${pts.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="#009CBD"/>`).join('')}
  </svg>`;
}

function buildDashboard() {
  const A = computeAnalysis(S);
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const months = ['Jan','Feb','Mar','Apr','May','Jun'];

  const TABS = [
    ['overview','Overview','',                'home'],
    ['visibility','AI visibility','8',        'chart'],
    ['competitors','Competitors',String(S.comps.length),'chat'],
    ['opportunities','Opportunities','3',     'grid'],
    ['solutions','Solutions','6',             'users'],
    ['market','Market','3',                   'doc'],
    ['plan','Plan','90d',                     'cal'],
    ['research','Research','9',               'chat'],
  ];

  const stat = (k, v, unit, d, cls, seed) => `
    <div class="dstat g3">
      <span class="pnl__k">${k}</span>
      <span class="dstat__v"><b class="num">${v}</b>${unit ? `<small>${unit}</small>` : ''}<em class="dstat__d ${cls}" style="font-style:normal">${d}</em></span>
      <span class="dstat__spark">${sparkBars(seed)}</span>
    </div>`;

  const sov = [{ n: A.b, v: S.aiVis, you: true }, ...A.competitors.map(c => ({ n: c.name, v: c.vis }))]
    .sort((a, b2) => b2.v - a.v);
  const top = sov[0].v;

  $('#dash').innerHTML = `
  <div class="dash__in">

    <!-- page-level: the title and the actions live outside the product -->
    <div class="dash__head">
      <div class="dash__id">
        <p class="eyebrow"><i class="pulse"></i>Built for ${S.firstName ? esc(S.firstName) : 'you'} · ${esc(S.domain)}</p>
        <h2>${esc(S.brand)}</h2>
        <div class="dash__meta">
          <span>Built <b>${today}</b></span><span>Elapsed <b>41s</b></span>
          <span>Engines <b>10</b></span><span>Category <b>${esc(S.industryLabel)}</b></span>
          <span>Focus <b>${esc(S.focus)}</b></span>
        </div>
      </div>
      <div class="dash__acts">
        <button class="btn btn--dark" data-cta="workspace">Request the full workspace</button>
        <button class="btn btn--ghost" id="watchBtn">
          <svg viewBox="0 0 16 16" width="12" height="12"><path d="M5 3.4l8 4.6-8 4.6V3.4Z" fill="currentColor"/></svg>
          Watch the video
        </button>
        <button class="btn btn--ghost" data-cta="pdf">Export</button>
        <button class="btn btn--ghost" data-new>New analysis</button>
      </div>
    </div>

    <!-- the product -->
    <div class="dapp">
      <aside class="dapp__rail">
        <span class="dapp__logo"><svg viewBox="0 0 28.44 28"><use href="#sw-mark"/></svg></span>
        ${TABS.map((t, i) => `<button class="dapp__ico${i ? '' : ' is-on'}" data-tab="${t[0]}" title="${t[1]}">
          <svg viewBox="0 0 20 20">${ICONS[t[3]]}</svg></button>`).join('')}
      </aside>

      <div class="dapp__body">
        <div class="dapp__top">
          <div>
            <h3 id="dappTitle">Overview</h3>
            <p>Coverage, AI citations, and your share of the answer.</p>
          </div>
          <span class="live"><i></i>Live data</span>
        </div>

        <div class="tabs" id="tabs">
          ${TABS.map((t, i) => `<button class="tab${i ? '' : ' is-on'}" data-tab="${t[0]}">${t[1]}${t[2] ? `<em>${t[2]}</em>` : ''}</button>`).join('')}
        </div>

        <div class="panels">

          <!-- OVERVIEW -->
          <div class="panel is-on" data-panel="overview">
            <div class="grid">
              ${stat('AI citation share', S.aiVis + '%', '', `+${pick(S.seed, 3, 9)}%`, 'up', S.seed)}
              ${stat('Brand equity', S.equity, '/100', '+4', 'up', S.seed >> 2)}
              ${stat('Coverage, 30d', pick(S.seed >> 3, 88, 190), '', `+${pick(S.seed >> 5, 6, 22)}`, 'up', S.seed >> 4)}
              ${stat('Share of voice', S.sov + '%', '', '— flat', 'flat', S.seed >> 6)}

              <div class="pnl g7">
                <div class="pnl__h"><h4>Coverage over time</h4>
                  <span class="legend" style="margin:0"><span><i></i>You</span><span><i class="them" style="background:var(--amber)"></i>${esc(A.c1)}</span></span></div>
                <div class="chart">${chartSVG(S.seed)}</div>
                <div class="chart__x">${months.map(m => `<span>${m}</span>`).join('')}</div>
              </div>

              <div class="pnl g5">
                <div class="pnl__h"><h4>Recent mentions</h4><span class="pnl__k">live</span></div>
                <div class="feed">
                  ${[['ChatGPT', `<b>${esc(A.c1)}</b> cited ahead of you`, '2m'],
                     ['Perplexity', `<b>${esc(A.b)}</b> referenced for “best ${A.cat}”`, '18m'],
                     ['NewIntel', `<b>${esc(A.competitors[0]?.name || A.c1)}</b> moved on creators`, '1h'],
                     ['BERA', `Equity refreshed — <b>${S.equity}/100</b>`, '6h']]
                    .map(f => `<div class="feedrow"><span class="chip">${f[0]}</span>
                      <span class="feedrow__t">${f[1]}</span><span class="feedrow__m">${f[2]}</span></div>`).join('')}
                </div>
              </div>
            </div>
          </div>

          <!-- AI VISIBILITY -->
          <div class="panel" data-panel="visibility">
            <div class="grid">
              <div class="pnl g8">
                <div class="pnl__h"><h4>Share of relevant answers</h4><span class="pnl__k">8 models · 30 days</span></div>
                <div class="bars">
                  ${A.models.map(m => `<div class="barrow">
                    <span class="barrow__n">${m.m}</span>
                    <span class="barrow__t"><i class="me" style="--w:${m.me}%"></i><i class="them" style="--w:${m.them}%"></i></span>
                    <span class="barrow__v">${m.me}% · ${m.them}%</span></div>`).join('')}
                </div>
                <div class="legend"><span><i></i>${esc(A.b)}</span><span><i class="them"></i>${esc(A.c1)}</span></div>
              </div>
              <div class="pnl g4">
                <div class="pnl__h"><h4>What the models say</h4><span class="pnl__k">verbatim</span></div>
                ${A.quotes.map(q => `<div style="padding:13px 0;border-bottom:1px solid var(--line)">
                  <p style="font-family:var(--serif);font-size:1rem;line-height:1.5;letter-spacing:-.01em">${q[0]}</p>
                  <b class="pnl__k" style="display:block;margin-top:9px;font-weight:400">${q[1]}</b></div>`).join('')}
              </div>
            </div>
          </div>

          <!-- COMPETITORS -->
          <div class="panel" data-panel="competitors">
            <div class="grid">
              <div class="pnl g12">
                <div class="pnl__h"><h4>AI visibility · ranked</h4><span class="pnl__k">you vs the set</span></div>
                <div class="sov">
                  ${sov.map(r => `<div class="sovrow${r.you ? ' is-you' : ''}">
                    <span class="sovrow__n">${esc(r.n)}</span>
                    <span class="sovrow__t"><i style="--w:${Math.round(r.v / top * 100)}%"></i></span>
                    <span class="sovrow__v num">${r.v}</span></div>`).join('')}
                </div>
              </div>
              ${A.competitors.map(c => `<div class="pnl g4">
                <div class="pnl__h"><h4>${esc(c.name)}</h4>
                  <span class="dstat__d ${c.up ? 'up' : 'down'}">${c.up ? '▲' : '▼'} ${c.delta}</span></div>
                <span class="pnl__k">${c.momentum} creator momentum</span>
                <p style="font-size:var(--t-sm);color:var(--ink-2);line-height:1.58">${c.move}</p>
                <span class="pnl__k" style="margin-top:auto">Visibility ${c.vis}</span>
              </div>`).join('')}
            </div>
          </div>

          <!-- OPPORTUNITIES -->
          <div class="panel" data-panel="opportunities">
            ${A.opps.map((o, i) => `<article class="oppcard">
              <span class="oppcard__r">0${i + 1}</span>
              <div>
                <h4>${o.h}</h4><p>${o.p}</p>
                <div class="opp__engines" style="margin-top:12px">${o.e.map(e => `<span class="tagx">${e}</span>`).join('')}</div>
              </div>
              <div class="oppcard__m">
                <span class="lift"><b class="num">${o.lift}</b><small>${o.l}</small></span>
                <span class="meter"><b>Impact<span class="num">${o.impact}</span></b><i style="--w:${o.impact}%"></i></span>
                <span class="meter"><b>Effort<span class="num">${o.effort}</span></b><i style="--w:${o.effort}%"></i></span>
              </div></article>`).join('')}
          </div>

          <!-- SOLUTIONS -->
          <div class="panel" data-panel="solutions">
            <div class="grid">
              ${A.solutions.map(s2 => `<div class="pnl g4">
                <span class="pnl__k" style="color:var(--teal)">${s2[0]}</span>
                <h4 style="font-size:1rem;font-weight:600;letter-spacing:-.012em">${s2[1]}</h4>
                <p style="font-size:var(--t-sm);color:var(--ink-2);line-height:1.58">${s2[2]}</p>
                <span class="pnl__k" style="margin-top:auto">${s2[3]}</span></div>`).join('')}
            </div>
          </div>

          <!-- MARKET -->
          <div class="panel" data-panel="market">
            <div class="grid">
              ${A.trends.map((t, i) => `<div class="pnl g4">
                <span class="pnl__k">Trend 0${i + 1}</span>
                <h4 style="font-size:1rem;font-weight:600;letter-spacing:-.012em;line-height:1.35">${t[0]}</h4>
                <p style="font-size:var(--t-sm);color:var(--ink-2);line-height:1.6">${t[1]}</p>
                <span class="pnl__k" style="margin-top:auto">${i === 2 ? 'HarrisX · six markets' : 'Stagwell signal index'}</span>
              </div>`).join('')}
              <div class="pnl g12">
                <div class="pnl__h"><h4>Your audience</h4><span class="pnl__k">SATS · 260M ID graph</span></div>
                <p style="font-size:var(--t-lede);color:var(--ink);line-height:1.5">${esc(S.data.segment)}</p>
                <p style="font-size:var(--t-sm);color:var(--ink-2);line-height:1.6">Resolved and matched to addressable inventory. ${esc(S.creators)} creators already reference ${esc(A.b)} with no commercial relationship.</p>
              </div>
            </div>
          </div>

          <!-- PLAN -->
          <div class="panel" data-panel="plan">
            <div class="plan">
              ${A.horizons.map(h => `<div class="pnl plancol">
                <div class="plancol__h"><b>${h[0]}</b><span>${h[1]}</span></div>
                <ul>${h[2].map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('')}
            </div>
          </div>

          <!-- RESEARCH -->
          <div class="panel" data-panel="research">
            <div class="pnl g12">
              <div class="pnl__h"><h4>The research behind this</h4><span class="pnl__k">HarrisX</span></div>
              <ul class="studies">
                ${STUDIES.map(s2 => `<li class="study">
                  <span class="study__t">${s2[0]}${s2[2] ? '<span class="rel">Relevant to you</span>' : ''}</span>
                  <span class="study__m">${s2[1]}</span></li>`).join('')}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  $('#dash').hidden = false;
  countAllIn($('#dash'));

  const stagger = panel => {
    $$(':scope > .grid > *, :scope > .plan > *, :scope > .oppcard, :scope > .pnl', panel)
      .forEach((el, i) => { el.style.setProperty('--i', i); });
    $$('.num', panel).forEach(el => countUp(el));
  };
  const setTab = name => {
    $$('.tab', $('#dash')).forEach(x => x.classList.toggle('is-on', x.dataset.tab === name));
    $$('.dapp__ico', $('#dash')).forEach(x => x.classList.toggle('is-on', x.dataset.tab === name));
    $$('.panel', $('#dash')).forEach(p => p.classList.toggle('is-on', p.dataset.panel === name));
    $('#dappTitle').textContent = (TABS.find(t => t[0] === name) || TABS[0])[1];
    const on = $('.panel.is-on', $('#dash'));
    if (on) stagger(on);
  };
  $$('.panel', $('#dash')).forEach(p =>
    $$(':scope > .grid > *, :scope > .plan > *, :scope > .oppcard, :scope > .pnl', p)
      .forEach((el, i) => el.style.setProperty('--i', i)));
  $('#dash').addEventListener('click', e => {
    const t = e.target.closest('[data-tab]'); if (!t) return;
    setTab(t.dataset.tab);
  });
}

/* ─────────────────────────── VIDEO ─────────────────────────── */

/* DoReel's presenter cut, opened over the page and closable. */
function openVideo() {
  const A = computeAnalysis(S);
  const script = [
    `${S.firstName ? S.firstName + ', here' : 'Here'} is ${S.brand}'s diagnosis — generated forty seconds ago.`,
    `Your brand equity is strong. Your visibility inside AI answers is not.`,
    `${A.c1} is named ${S.gap} points more often than you are.`,
    `Three moves close that gap. The first one costs almost nothing.`,
  ];
  modalBody.innerHTML = `
    <div class="modal__brand"><svg><use href="#sw-logo"/></svg><span>AI</span></div>
    <h3>Your diagnosis, presented back to you.</h3>
    <p>An AI presenter delivers these findings — about ${esc(S.brand)}, addressed to ${S.firstName ? esc(S.firstName) : 'you'}, produced seconds after one website was typed.</p>
    <div class="player" id="player">
      <span class="player__grid"></span><span class="player__figure"></span>
      <span class="player__hud"><i></i>DoReel · rendered 41s ago</span>
      <button class="player__play" aria-label="Play">
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.2l11 6.8-11 6.8V5.2Z" fill="currentColor"/></svg>
      </button>
      <p class="player__cap" id="playerCap"></p>
      <span class="player__wave" id="playerWave">${'<i></i>'.repeat(42)}</span>
      <span class="player__bar"><i id="playerBar"></i></span>
    </div>
    <p class="modal__fine">Prototype — the presenter is illustrative.</p>`;
  modal.hidden = false;
  modal.classList.add('modal--wide');

  const p = $('#player'), cap = $('#playerCap'), barEl = $('#playerBar'), bars = $$('#playerWave i');
  let playing = false, timers = [];
  const stop = () => {
    playing = false; p.classList.remove('is-playing');
    timers.forEach(t => { clearTimeout(t); clearInterval(t); }); timers = [];
    cap.textContent = ''; barEl.style.transition = 'none'; barEl.style.width = '0';
  };
  videoStop = stop;
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
let videoStop = null;

/* ─────────────────────────── START OVER ─────────────────────────── */

/* Anyone already holding a dashboard can run another company without reloading. */
function resetB() {
  if (S.busy) return;
  Object.assign(S, {
    step:0, busy:false, done:false, domain:'', brand:'', who:'', firstName:'', role:'',
    roleArticle:'board', industryLabel:'', data:DEFAULT_INDUSTRY, profile:null, comps:[],
    challenge:'', focus:'Growth opportunities',
    focusLine:'where the next points of growth actually sit', focusLead:1,
  });
  thread.innerHTML = ''; thread.hidden = true;
  $('#chatBar').hidden = true;
  $('#chatHint').hidden = false;
  $('#dash').hidden = true; $('#dash').innerHTML = '';
  $('#navNew').hidden = true;
  $('.mnav__new').hidden = true;
  hero.classList.remove('is-chatting');
  $('#heroEyebrow').innerHTML = '<i class="pulse"></i>Stagwell AI · The Machine';
  $('#hero2Title').innerHTML = 'Let\u2019s start with your <span class="accent">website.</span>';
  blurWords($('#hero2Title'));
  $('#hero2Sub').textContent = 'One link. I\u2019ll read the company, map the market, and build your dashboard — live, in about a minute.';
  promptInput.value = ''; promptInput.placeholder = SCRIPT[0].placeholder;
  prompt.classList.remove('is-ready');
  scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
  setTimeout(focusPrompt, 420);
}
$('#navNew').addEventListener('click', resetB);
document.addEventListener('click', e => { if (e.target.closest('[data-new]')) resetB(); });

/* ─────────────────────────── NAV / MODAL ─────────────────────────── */

/* The header rides with you: away on the way down, back the moment you head up.
   The distance is accumulated per direction — comparing against the last frame
   alone means a slow trackpad scroll never clears the threshold and the bar
   only ever returns at the top of the page. */
(() => {
  const nav = $('#nav');
  const HIDE_AFTER = 64;   // px of continuous downward travel
  const SHOW_AFTER = 18;   // px of upward travel — deliberately eager
  let lastY = scrollY, acc = 0, ticking = false;

  const onScroll = () => {
    ticking = false;
    const y = Math.max(0, scrollY);
    const d = y - lastY;
    lastY = y;
    nav.classList.toggle('is-stuck', y > 8);

    if (document.body.classList.contains('nav-open')) return;
    if (y < 90) { nav.classList.remove('is-up'); acc = 0; return; }

    if ((d > 0) !== (acc > 0)) acc = 0;   // direction changed — start counting again
    acc += d;

    if (acc > HIDE_AFTER)  { nav.classList.add('is-up');    acc = 0; }
    if (acc < -SHOW_AFTER) { nav.classList.remove('is-up'); acc = 0; }
  };

  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true; requestAnimationFrame(onScroll);
  }, { passive: true });
})();

const closeNav = () => document.body.classList.remove('nav-open');
$('#navMenu').addEventListener('click', () => document.body.classList.toggle('nav-open'));
$('#navScrim').addEventListener('click', closeNav);
$('#mnavClose').addEventListener('click', closeNav);
$$('.mnav__links a, .nav__links a').forEach(a => a.addEventListener('click', closeNav));
$$('.mnav [data-cta], .mnav [data-new]').forEach(b => b.addEventListener('click', closeNav));

const modal = $('#modal'), modalBody = $('#modalBody');
const closeModal = () => {
  modal.hidden = true; modal.classList.remove('modal--wide');
  if (videoStop) { videoStop(); videoStop = null; }
};
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
  if (e.target.closest('#watchBtn')) { e.preventDefault(); return openVideo(); }
  const t = e.target.closest('[data-cta]');
  if (t && t.tagName !== 'FORM') { e.preventDefault(); openModal(t.dataset.cta); }
});
document.addEventListener('submit', e => {
  if (e.target.matches('form[data-cta]')) { e.preventDefault(); openModal(e.target.dataset.cta); }
});

/* ─────────────────────────── STATIC ─────────────────────────── */

/* Two rows drifting in opposite directions, each doubled so the loop is seamless. */
const mCell = ([k, n]) => `<div class="mcell" title="${n}"><img src="${partnerSrc(k)}" alt="${n}"
  loading="lazy" style="--s:${LOGO_SCALE[k] || 1}"></div>`;
const row = PARTNERS.map(mCell).join('');
$('#marquee').innerHTML = `<div class="mrow">${row}${row}</div>`;   // doubled → -50% loops seamlessly
$('#studies').innerHTML = STUDIES.map(s =>
  `<li class="study"><span class="study__t">${s[0]}</span><span class="study__m">${s[1]}</span></li>`).join('');

/* ─────────────────────────── REVEALS ───────────────────────────
   Wired only once the lists above exist — observing an empty selector
   leaves those rows sitting at opacity 0 for good. */
whenVisible($$('.sec__in, .sec__in--head, .bcta__in'), el => el.classList.add('is-in'));
reveal($$('.sec .stat, .sec .study, .ctacard'));
countAllIn(document);

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
    blurWords($('#hero2Title'), 120);
    $('#chatHint').hidden = true;
    $('#navNew').hidden = false;
    $('.mnav__new').hidden = false;
    return;
  }
  blurWords($('#hero2Title'), 120);
  focusPrompt();
})();

})();
