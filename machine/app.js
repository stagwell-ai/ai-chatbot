/* ═══════════════════════════════════════════════════════════════════════════
   STAGWELL AI — THE MACHINE
   A scripted, high-fidelity prototype. No model is called: every path the
   visitor takes converges on the same designed journey.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const { esc, hash, pick, PARTNERS, partnerSrc, LOGO_SCALE, STUDIES, INDUSTRIES,
        DEFAULT_INDUSTRY, KNOWN, readWebsite, STATUS_LINES, MODELS, FOCUS, ROLES,
        numbersFor, computeAnalysis, countUp, whenVisible, countAllIn, blurWords, reveal,
        RELATIONSHIP, FOCUS_KEYS, FOLLOWUPS, WINDOWS, modeFor, voiceFor,
        focusLabel, focusLine, parseFocus, okEmail, nameFromEmail, specRows,
        statusLines, crawlFor, brandMark, wireMarks, askLive,
        fetchLiveQuotes, fetchAudit, chatAsk, chatChips, fetchSummary, whatIfHTML, wireWhatIf } = window.SWAI;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ─────────────────────────── REFERENCE DATA ─────────────────────────── */

/* ─────────────────────────── STATE ─────────────────────────── */

const BLANK = {
  step:0, busy:false, briefReady:false, editing:false,
  domain:'', brand:'', legal:'', who:'', firstName:'', email:'',
  industryLabel:'', data:DEFAULT_INDUSTRY, profile:null, viewerProfile:null,
  rel:'owner', mode:'owner', comps:[], challenge:'', pages:42,
  focus:['ai'], focusLead:0,
  query:'', belief:'', worry:'', growthMode:'', windowLabel:'', live:null, liveQuotes:null,
  audit:null, liveSummary:null, role:'', roleArticle:'board',
};
const S = Object.assign({ view:'workspace', equity:62, aiVis:41, sov:18, gap:40,
  creators:'1,204', seed:1 }, BLANK);
const V = () => voiceFor(S);

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
  /* A hidden view still "intersects", so its figures would count where nobody
     can see them. Replay both when the section is actually opened. */
  const shown = $(`[data-view="${view}"]`);
  const t = $('.doc__title', shown || document.body);
  if (t) blurWords(t, 60);
  if (shown) $$('.num', shown).forEach((el, i) => setTimeout(() => countUp(el), 120 + i * 90));
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

/* The thread follows the text as it is written, not once it is finished. */
let stick = true;
$('#wsScroll').addEventListener('scroll', () => {
  const sc = $('#wsScroll');
  stick = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 60;
}, { passive: true });
const pin = () => { const sc = $('#wsScroll'); if (stick) sc.scrollTop = sc.scrollHeight; };
const scrollDown = () => { stick = true; requestAnimationFrame(pin); };

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

/* Pick up to two. Toggling rather than submitting is the only place in the
   script where an answer is composed instead of chosen. */
function addMultiOptions(body, list, max = 2) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'opts opts--multi';
    const picked = [];
    const go = document.createElement('button');
    go.type = 'button'; go.className = 'opt opt--go'; go.disabled = true;
    go.innerHTML = `Continue<svg viewBox="0 0 16 16" width="13" height="13"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    const sync = () => {
      $$('.opt--check', wrap).forEach(b => {
        const on = picked.includes(b.dataset.v);
        b.classList.toggle('is-on', on);
        b.disabled = !on && picked.length >= max;
      });
      go.disabled = !picked.length;
      wrap.classList.toggle('is-armed', !!picked.length);
    };

    list.forEach((label, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'opt opt--check'; b.dataset.v = label;
      b.innerHTML = `<span class="opt__box"><svg viewBox="0 0 14 14" width="10" height="10"><path d="M2.5 7.4l3 3 6-6.6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>${label}`;
      b.style.animationDelay = `${80 + i * 55}ms`;
      b.addEventListener('click', () => {
        const j = picked.indexOf(label);
        if (j >= 0) picked.splice(j, 1);
        else if (picked.length < max) picked.push(label);
        sync();
      });
      wrap.appendChild(b);
    });
    go.style.animationDelay = `${80 + list.length * 55}ms`;
    go.addEventListener('click', () => picked.length && submit(picked.join(' · ')));
    wrap.appendChild(go);
    body.appendChild(wrap); sync(); scrollDown();
    setTimeout(resolve, 120);
  });
}

/* The read-back. Everything they steered, in one card, every line correctable.
   This is also the only way back — the thread itself is append-only. */
function specCard(body) {
  const rows = specRows(S);
  const card = document.createElement('div');
  card.className = 'spec';
  card.innerHTML = `
    <div class="spec__bar"><i class="pulse"></i><b>Ready to build</b><span class="sp"></span>
      <span>${rows.length} inputs captured</span></div>
    <div class="spec__rows">
      ${rows.map(r => `<div class="spec__row">
        <b>${r[0]}</b><span>${esc(String(r[1]))}</span>
        ${r[2] ? `<button class="spec__edit" data-edit="${r[2]}">change</button>` : '<i></i>'}
      </div>`).join('')}
    </div>
    <div class="spec__acts">
      <button class="btn btn--dark" data-build>Build the report</button>
      <button class="spec__over" data-over>Start over</button>
    </div>`;
  body.appendChild(card); scrollDown();

  $$('[data-edit]', card).forEach(b => b.addEventListener('click', () => {
    if (S.busy) return;
    /* Retire the old card properly. Left in the DOM it keeps answering
       queries with stale rows long after it has animated away. */
    card.classList.add('is-gone');
    setTimeout(() => card.remove(), 470);
    S.editing = true;
    S.step = SCRIPT.findIndex(s => s.key === b.dataset.edit);
    askStep();
  }));
  $('[data-build]', card).addEventListener('click', () => {
    if (S.busy) return;
    card.classList.add('is-done');
    runMachine();
  });
  $('[data-over]', card).addEventListener('click', () => restart());
}

/* One card per answer, keyed by tag so an edit replaces its row instead of
   stacking a second one. The meter counts against the beats this particular
   path will actually ask — which is why it can no longer overshoot. */
function addCtx(tag, text) {
  const body = `<b>${tag}</b><span>${text.replace(/<\/?b>/g, '')}</span><em>captured</em>`;
  let c = $$('.ctxcard', ctxList).find(el => el.dataset.tag === tag);
  if (c) { c.innerHTML = body; c.classList.remove('is-new'); void c.offsetWidth; c.classList.add('is-new'); }
  else {
    c = document.createElement('div');
    c.className = 'ctxcard is-new'; c.dataset.tag = tag; c.innerHTML = body;
    ctxList.appendChild(c);
  }
  ctxMeter();
}

/* Changing the lens invalidates whatever the old follow-up captured, so its
   card has to go with it rather than sitting there contradicting the brief. */
const CAPTURE_TAGS = ['Tested prompt','Belief','Watching','Growth from','Window','Against'];
function dropCtx(tags) {
  $$('.ctxcard', ctxList).forEach(c => { if (tags.includes(c.dataset.tag)) c.remove(); });
  ctxMeter();
}

function ctxMeter() {
  const target = SCRIPT.filter(s => s.key !== 'confirm' && (!s.skipIf || !s.skipIf())).length;
  const pct = Math.min(100, Math.round((ctxList.children.length / Math.max(1, target)) * 100));
  $('#ctxBar').style.width = pct + '%'; $('#ctxPct').textContent = pct;
  ctx.hidden = false;
  if (S.view === 'workspace') app.classList.add('has-ctx');
}

/* What the machine worked out on its own. This card is the whole promise:
   the visitor classifies nothing. */
function inferenceRows(p) {
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
  return rows;
}

/* ── The read, performed ──
   The card used to arrive whole, which meant "42 pages read" was a claim with
   nothing behind it. Now the crawl streams, the counters climb, and the rows
   land one at a time — the wait is the evidence. */
let rush = false;
async function readSite(body, p) {
  const rows = inferenceRows(p);
  const crawl = crawlFor(S);

  const card = document.createElement('div');
  card.className = 'site is-reading';
  card.innerHTML = `
    <div class="site__bar">
      ${brandMark(p.domain, 20)}<b>${esc(p.domain)}</b><span class="sp"></span>
      <span class="site__count"><b id="crawlN">0</b> pages · <b id="crawlE">0</b> entities</span>
    </div>
    <div class="site__crawl" id="crawl"></div>
    <div class="site__rows" id="siteRows"></div>
    <p class="site__note" id="siteNote" hidden></p>`;
  body.appendChild(card);
  wireMarks(card);
  scrollDown();

  const feed = $('#crawl', card), nEl = $('#crawlN', card), eEl = $('#crawlE', card);
  const rowsEl = $('#siteRows', card), note = $('#siteNote', card);

  /* Clicking or pressing Enter hurries the crawl, same as the typewriter. */
  rush = REDUCED;
  const armRush = () => { rush = true; };
  skipType = armRush;
  const beat = ms => rush ? Promise.resolve() : wait(ms);

  const totalE = p.entities || pick(S.seed >> 4, 180, 940);
  for (let i = 0; i < crawl.length; i++) {
    const c = crawl[i];
    const line = document.createElement('div');
    line.className = 'crawlrow';
    line.innerHTML = `<span class="crawlrow__m">GET</span>
      <span class="crawlrow__p">${esc(c.path)}</span>
      <span class="crawlrow__t">${c.ms}ms</span>
      <span class="crawlrow__c${c.code === 200 ? '' : ' is-redir'}">${c.code}</span>`;
    feed.appendChild(line);
    feed.scrollTop = feed.scrollHeight;
    nEl.textContent = Math.round(p.pages * ((i + 1) / crawl.length));
    eEl.textContent = Math.round(totalE * ((i + 1) / crawl.length));
    await beat(96);
  }
  nEl.textContent = p.pages; eEl.textContent = totalE;
  await beat(220);

  /* The crawl collapses into a one-line receipt and the inference fills in. */
  card.classList.add('is-read');
  await beat(180);
  for (const r of rows) {
    const row = document.createElement('div');
    row.className = 'site__row is-in';
    row.innerHTML = `<b>${r[0]}</b><span>${r[1]}</span>`;
    rowsEl.appendChild(row);
    await beat(58);
  }
  note.innerHTML = `<b>Likely competitors</b> — ${p.peers.map(n =>
    `<span class="peer">${brandMark(n, 16)}${esc(n)}</span>`).join('')}`;
  note.hidden = false;
  wireMarks(note);
  card.classList.remove('is-reading');
  if (skipType === armRush) skipType = null;
  scrollDown();
}

/* ── The machine does the research first, then asks only what it cannot
      know: what you want from it, and who you are. ── */

/* ── The live probe ──
   The only genuinely real moment in the demo: their prompt, asked of an actual
   model, answered verbatim. Falls back to silence (and the scripted figures)
   if the endpoint is missing, slow or unhappy — never an error in the room. */
async function liveProbe() {
  const body = aiTurn();
  await wait(REDUCED ? 30 : 320);
  const p = document.createElement('p'); p.className = 'ai__text';
  body.appendChild(p);
  $('.thinking', body)?.remove();
  await typeHTML(p, `Asking it now — verbatim, no prompt engineering…`);
  const dots = document.createElement('div');
  dots.className = 'thinking'; body.appendChild(dots);
  scrollDown();

  const brands = [S.brand, ...S.comps].filter(Boolean);
  const live = await askLive(S.query, brands);
  dots.remove();

  if (!live) {
    S.live = null;
    await typeHTML(p, `I will run <em>“${esc(S.query)}”</em> across the models while I build this.`);
    return;
  }

  S.live = live;
  const hit = live.named.some(n => n.toLowerCase() === String(S.brand).toLowerCase());
  const card = document.createElement('div');
  card.className = 'live';
  card.innerHTML = `
    <div class="live__bar"><i class="pulse"></i><b>${esc(live.model)}</b><span class="sp"></span>
      <span>answered in ${live.ms}ms · live</span></div>
    <p class="live__a">${esc(live.answer)}</p>
    <div class="live__marks">
      ${brands.map(n => {
        const on = live.named.some(x => x.toLowerCase() === n.toLowerCase());
        return `<span class="live__m${on ? ' is-on' : ''}">${brandMark(n, 16)}${esc(n)}<i>${on ? 'named' : 'not named'}</i></span>`;
      }).join('')}
    </div>`;
  body.appendChild(card);
  wireMarks(card);
  scrollDown();
  await wait(REDUCED ? 30 : 520);

  await say(hit
    ? `You are in that answer — but so are ${esc(live.named.filter(n => n.toLowerCase() !== String(S.brand).toLowerCase()).join(' and ') || 'others')}. Being present is not the same as being chosen.`
    : `<em>${esc(S.brand)}</em> is not in that answer. <span class="hl">That is a real result, not a simulation</span> — and it is the gap this brief prices.`,
    { node: body, delay: 240 });
}

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
      await wait(REDUCED ? 30 : 260);

      await readSite(body, S.profile);
      await wait(REDUCED ? 40 : 420);

      /* Deliberately third person — the machine does not yet know whose side
         it is on, and guessing wrong here undoes the whole read. */
      const what = S.profile.what.charAt(0).toLowerCase() + S.profile.what.slice(1);
      const where = S.profile.confident ? `, out of ${esc(S.profile.hq)}` : '';
      await say(
        `That is <em>${esc(S.brand)}</em> — ${esc(what)}${where}, positioned as ${esc(S.profile.pos.toLowerCase())}. In the answer layer it sits against ${esc(S.profile.peers.slice(0, 2).join(' and '))}. <span class="hl">I have what I need.</span> Before I go further — is <em>${esc(S.brand)}</em> where you work, or are you sizing them up?`,
        { node: body, delay: 220, options: RELATIONSHIP.map(r => r.label) });

      addCtx('Site read', `<b>${S.brand}</b> — ${S.profile.ind}`);
      return body;
    },
  },
  {
    key: 'relationship',
    placeholder: 'Or tell me in your own words',
    async reply() {
      const line = {
        owner:    `Good — then this is a read on your own position, and I will not soften it.`,
        rival:    `Understood. Then I want both sides of this.`,
        observer: `Fine — a straight read on the category, with no axe to grind.`,
      }[S.rel];
      await say(line);
      addCtx('Angle', { owner:'Reading <b>your own</b> position', rival:'Reading a <b>competitor</b>',
                        observer:'<b>Category</b> read' }[S.rel]);
    },
  },
  {
    key: 'viewerSite',
    skipIf: () => S.rel !== 'rival',
    placeholder: 'yourcompany.com',
    question: () => `What should I measure <em>${esc(S.profile.name)}</em> against — your own site?`,
    optionsFor: () => ['Skip — just read them'],
    async reply() {
      if (S.mode === 'duel')
        await say(`Then I will build this as <em>${esc(S.brand)}</em> against <em>${esc(S.rivalProfile.name)}</em> — both read, both scored, side by side.`);
      else
        await say(`Then I will read <em>${esc(S.brand)}</em> cold, with no comparison to you in it.`);
      addCtx('Comparison', S.mode === 'duel'
        ? `<b>${S.brand}</b> vs <b>${S.rivalProfile.name}</b>`
        : `Single-sided read`);
    },
  },
  {
    key: 'focus',
    placeholder: 'Or tell me in your own words',
    question: () => `What should I lead with? <span class="hl">Pick one or two.</span>`,
    multiFor: () => FOCUS_KEYS.map(k => focusLabel(k, S.mode)),
    async reply() {
      const first = focusLine(S.focus[0], S.mode);
      const second = S.focus[1] ? ` Then <em>${esc(focusLabel(S.focus[1], S.mode).toLowerCase())}</em>.` : '';
      const own = S.challenge ? ` I will keep your words on it — <em>“${esc(S.challenge)}”</em>.` : '';
      await say(`Good. I will lead on ${esc(first)}.${second}${own}`);
      addCtx('Focus', S.focus.map(k => focusLabel(k, S.mode)).join(' · '));
    },
  },
  {
    key: 'followup',
    placeholder: () => FOLLOWUPS[S.focus[0]].placeholder,
    question: () => FOLLOWUPS[S.focus[0]].q(S, V()),
    optionsFor: () => FOLLOWUPS[S.focus[0]].options(S),
    async reply() {
      await say(FOLLOWUPS[S.focus[0]].ack(S, V()));
      if (S.focus[0] === 'ai' && S.query) await liveProbe();
      const cap = { ai:['Tested prompt', S.query], perception:['Belief', S.belief],
                    risk:['Watching', S.worry], growth:['Growth from', S.growthMode],
                    recent:['Window', S.windowLabel],
                    versus:['Against', S.comps.join(', ')] }[S.focus[0]];
      if (cap && cap[1]) addCtx(cap[0], `<b>${esc(String(cap[1]).slice(0, 46))}</b>`);
    },
  },
  {
    key: 'role',
    skipIf: () => S.mode !== 'owner' && S.mode !== 'duel',
    placeholder: 'Your role',
    question: () => `And what is your role at <em>${esc(S.brand)}</em>?`,
    optionsFor: () => ROLES,
    async reply() {
      await say(`Noted — I will write this at ${esc(S.roleArticle)} altitude.`);
      addCtx('Seniority', `Written for a <b>${S.role}</b>`);
    },
  },
  {
    key: 'email',
    placeholder: () => S.mode === 'owner' || S.mode === 'duel' ? `you@${S.domain}` : 'you@company.com',
    question: () => `Last thing. Where should the finished brief land?`,
    async reply() {
      await say(S.firstName
        ? `Thank you, <em>${esc(S.firstName)}</em>. Everything goes to <em>${esc(S.email)}</em> the moment it is built.`
        : `Noted — <em>${esc(S.email)}</em>.`);
      addCtx('Delivery', `<b>${S.email}</b>`);
    },
  },
  {
    key: 'confirm',
    placeholder: 'Tap “Build the report”',
    async reply() { /* the card is the beat — nothing to say */ },
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
  promptInput.placeholder = typeof q.placeholder === 'function' ? q.placeholder() : q.placeholder;

  if (q.key === 'confirm') {
    const body = await say(S.editing
      ? `Updated. Anything else before I build it?`
      : `Here is what I am about to build. Change anything I have wrong.`);
    S.editing = false;
    specCard(body);
    promptInput.value = ''; prompt.classList.remove('is-ready');
    S.busy = false; pending = null;
    return;
  }

  const opts = q.multiFor ? null : (q.optionsFor ? q.optionsFor() : null);
  let body = null;
  if (q.question) body = await say(q.question(), { options: opts });
  else body = thread.lastElementChild?.querySelector('.ai__body');
  if (q.multiFor && body) await addMultiOptions(body, q.multiFor());
  else if (!q.question && opts && body) await addOptions(body, opts);

  promptInput.value = ''; prompt.classList.remove('is-ready');
  S.busy = false;
  promptInput.focus();
  if (pending !== null) { const p = pending; pending = null; submit(p); }
}

promptInput.addEventListener('input', () => prompt.classList.toggle('is-ready', promptInput.value.trim().length > 0));
promptForm.addEventListener('submit', e => { e.preventDefault(); submit(promptInput.value); });

/* Options are rendered inside the previous beat's reply, so they become
   clickable a beat before the machine is ready for them. Hold the answer
   rather than dropping it — an eager tap should never cost you a turn. */
let pending = null;

async function submit(raw) {
  if (S.busy) { if ((raw || '').trim()) pending = raw; return; }
  const text = (raw || '').trim();
  const q = SCRIPT[S.step];
  if (!q) return;
  if (q.key === 'confirm') return runMachine();
  if (!text) { prompt.classList.add('is-shake'); setTimeout(() => prompt.classList.remove('is-shake'), 440); return; }

  /* The one place the machine will not move on. It is gated: no address,
     no brief — so say that once, plainly, rather than failing silently. */
  if (q.key === 'email' && !okEmail(text)) {
    prompt.classList.add('is-shake'); setTimeout(() => prompt.classList.remove('is-shake'), 440);
    if (!S.emailNudged) {
      S.emailNudged = true; S.busy = true;
      promptInput.value = ''; prompt.classList.remove('is-ready');
      addUser(text);
      await say(`That is not an address I can reach — and the brief only goes by email. Try again?`);
      S.busy = false; promptInput.focus();
    }
    return;
  }

  S.busy = true;
  promptInput.value = ''; prompt.classList.remove('is-ready');
  clearOptions();

  if (q.key === 'website') {
    /* Everything is inferred here — the visitor is never asked to classify. */
    S.profile = readWebsite(text);
    S.rivalProfile = null; S.viewerProfile = null; S.rel = 'owner'; S.mode = 'owner';
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

  /* ── the master fork ── */
  if (q.key === 'relationship') {
    const low = text.toLowerCase();
    const hit = RELATIONSHIP.find(r => r.label.toLowerCase() === low)
      || (/\b(competitor|rival|compet|sizing|prospect|target|client)\b/.test(low) ? RELATIONSHIP[1] : null)
      || (/\b(neither|category|research|market|curious|nobody|none|browsing)\b/.test(low) ? RELATIONSHIP[2] : null)
      || (/\b(us|ours|mine|we|our|my|yes|work|employer)\b/.test(low) ? RELATIONSHIP[0] : null)
      || RELATIONSHIP[0];
    S.rel = hit.key;
    S.mode = modeFor(S);
  }

  /* ── the second site: subject flips to the visitor, rival becomes #1 ── */
  if (q.key === 'viewerSite') {
    const skip = /^(skip|no|none|rather not|just read)/i.test(text);
    const vp = skip ? null : readWebsite(text);
    if (vp && vp.domain !== S.profile.domain) {
      S.rivalProfile  = S.rivalProfile || S.profile;
      S.viewerProfile = vp;
      S.profile = vp;
      S.domain = vp.domain; S.brand = vp.name; S.pages = vp.pages;
      S.industryLabel = vp.ind;
      S.data = INDUSTRIES[vp.ind] || DEFAULT_INDUSTRY;
      S.comps = [S.rivalProfile.name,
                 ...vp.peers.filter(p => p.toLowerCase() !== S.rivalProfile.name.toLowerCase())].slice(0, 3);
      deriveNumbers();
      $('#railThreadLabel').textContent = S.brand;
    } else if (skip) {
      S.viewerProfile = null;
      if (S.rivalProfile) { S.profile = S.rivalProfile; S.rivalProfile = null;
        S.domain = S.profile.domain; S.brand = S.profile.name;
        S.industryLabel = S.profile.ind;
        S.data = INDUSTRIES[S.profile.ind] || DEFAULT_INDUSTRY;
        S.comps = S.profile.peers.slice(0, 3); deriveNumbers(); }
    }
    S.mode = modeFor(S);
  }

  if (q.key === 'focus') {
    const keys = parseFocus(text, S.mode);
    S.focus = keys.length ? keys : ['ai'];
    S.focusLead = FOCUS[S.focus[0]].lead;
    if (!keys.length) S.challenge = text.slice(0, 90);   // their own words — kept for the brief
    S.query = S.belief = S.worry = S.growthMode = S.windowLabel = '';
    S.live = null;
    dropCtx(CAPTURE_TAGS);
  }

  /* ── one beat, six different questions ── */
  if (q.key === 'followup') {
    const k = S.focus[0];
    const pass = /^(i’ll leave|i'll leave|nothing specific|skip|no thanks|none|no$)/i.test(text);
    if (k === 'ai')         S.query      = pass ? '' : text.slice(0, 80);
    if (k === 'perception') S.belief     = pass ? '' : text.slice(0, 80);
    if (k === 'risk')       S.worry      = pass ? '' : text.slice(0, 80);
    if (k === 'growth')     S.growthMode = pass ? 'More from the ones we already have' : text.slice(0, 48);
    if (k === 'recent')     S.windowLabel = WINDOWS[text] ? text : 'Last 90 days';
    if (k === 'versus') {
      const keep = /^(those|yes|correct|right|keep|no|none)/i.test(text);
      if (!keep) {
        const typed = text.split(/,|\band\b|\//).map(t => t.trim())
          .filter(t => t.length > 1 && t.length < 28 && !/^add someone/i.test(t));
        if (typed.length) S.comps = [...new Set([...typed, ...S.comps])].slice(0, 3);
      }
      S.comps = S.comps.filter(c => c.toLowerCase() !== S.brand.toLowerCase());
      if (!S.comps.length) S.comps = S.profile.peers.slice(0, 3);
    }
  }

  if (q.key === 'role') {
    const match = ROLES.find(r => r.toLowerCase() === text.toLowerCase());
    S.role = match || text.slice(0, 40);
    S.roleArticle = /chief|founder|ceo/i.test(S.role) ? 'board' : 'leadership';
  }

  if (q.key === 'email') {
    S.email = text.toLowerCase();
    S.firstName = nameFromEmail(S.email);
    S.who = S.firstName;
  }

  addUser(text);
  await wait(REDUCED ? 30 : 200);
  await q.reply();
  advance(q);
}

/* Editing a row sends you back to that beat and then straight to the read-back
   — except focus, which invalidates the follow-up sitting behind it. */
function advance(q) {
  const at = k => SCRIPT.findIndex(s => s.key === k);
  S.step++;
  if (S.editing && q.key !== 'focus') {
    const needRole = (S.mode === 'owner' || S.mode === 'duel') && !S.role;
    S.step = needRole ? at('role') : at('confirm');
    S.editing = needRole;
  }
  setTimeout(() => askStep(), REDUCED ? 30 : 420);
}

/* Click or Enter completes an in-flight typewriter — built for live presenting. */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { app.classList.remove('rail-open'); closeModal(); exitBoard(); }
  if (skipType && (e.key === 'Enter' || e.key === ' ')) skipType();
});
stage.addEventListener('click', e => { if (skipType && !e.target.closest('button,input,a')) skipType(); });

/* ─────────────────────────── MACHINE MODE ─────────────────────────── */

async function runMachine() {
  S.busy = true;
  restartBtn.classList.remove('is-on');

  /* The three "what do the models say" questions run while the loader talks,
     so the wait is doing real work. Whatever has answered by the end goes in
     the brief; anything still pending is dropped for the scripted line. */
  const quotesP = fetchLiveQuotes(S).catch(() => []);
  /* The mini-audit rides the same wait: three buying prompts asked for real, so
     share of answers has one measured number behind the modelled ones. */
  const auditP = fetchAudit(S).catch(() => null);
  /* And the executive summary itself, written for this session. Same window,
     same rule: if it is not back by the time the loader finishes, the brief
     carries the template and nobody waits for it. */
  const summaryP = fetchSummary(S).catch(() => null);

  const status = $('#runStatus'), meter = $('#runMeter');
  status.innerHTML = '';
  meter.style.width = '0';

  show('run');                       // same room, same sidebar — only the centre changes
  await wait(REDUCED ? 30 : 220);

  const LINES = statusLines(S, 'Executive AI Brief');
  const STEP = REDUCED ? 30 : 880;
  for (let i = 0; i < LINES.length; i++) {
    status.innerHTML = `<span>${esc(LINES[i])}…</span>`;
    meter.style.width = ((i + 1) / LINES.length * 100) + '%';
    await wait(STEP);
  }
  /* Usually resolved already — the calls started ~4.4s ago and take ~3s.
     When they are still in flight, one more honest line covers the wait; when
     the endpoint is down they fail fast and this races through instantly. */
  status.innerHTML = `<span>Listening to what the models actually say…</span>`;
  /* One timer for all three harvests, deliberately: sequential windows would
     stack the wait for a visitor in the room, and racing them as a block would
     drop everything because one call lagged. Each promise races the same
     clock; whatever has landed when it fires is what the brief gets. */
  const grace = new Promise(r => setTimeout(() => r(null), REDUCED ? 400 : 5000));
  [S.liveQuotes, S.audit, S.liveSummary] = await Promise.all([
    Promise.race([quotesP, grace]),
    Promise.race([auditP, grace]),
    Promise.race([summaryP, grace]),
  ]);
  await wait(REDUCED ? 20 : 260);

  buildBrief();
  show('brief');
  $('#railBrief').hidden = false;
  $('#railBriefLabel').textContent = `Executive Brief · ${S.brand}`;
  restartBtn.classList.add('is-on');
  S.briefReady = true; S.busy = false;

  /* Only here, where buildBrief has just run: the paragraph written seconds ago
     types itself in, the way the conversation does. Never awaited — the brief is
     already usable — and never on a re-show, which does not rebuild. */
  const bsum = $('#bsum');
  if (bsum && S.liveSummary && !REDUCED) typeHTML(bsum, esc(S.liveSummary.text));
}

/* ─────────────────────────── THE BRIEF ─────────────────────────── */

/* A brand tile. Live favicons belong to brandMark — if that layer is present we
   defer to it, otherwise a monogram stands in. Never fetch an icon from here. */
function mark(nameOrDomain, size) {
  const { brandMark } = window.SWAI;
  if (brandMark) return brandMark(nameOrDomain, size);
  const ch = String(nameOrDomain || '?').trim().replace(/^www\./, '').charAt(0).toUpperCase();
  return `<span class="duel__mono" style="--sz:${size}px" aria-hidden="true">${esc(ch)}</span>`;
}

/* ── HEAD TO HEAD — duel mode only ──
   The rival's AI visibility here is A.lead, i.e. subject + gap, because that is
   how every other chart in the brief derives it. A second hashed number for the
   same brand would contradict the KPI card and the model rows on the same page.
   Equity, share of voice and creator affinity are the rival's own hashed
   figures — nothing else on the page pins those, so they can speak for
   themselves. */
function duelSection(A) {
  if (S.mode !== 'duel' || !S.rivalProfile) return '';

  const me = S.profile || { name: S.brand, domain: S.domain, pos: S.data.pos, hq: null, founded: null, people: null };
  const rv = S.rivalProfile;
  const rN = numbersFor(rv.domain, rv.name);
  const val = v => Number(String(v).replace(/[^\d.-]/g, ''));

  const rows = [
    ['Brand equity',     'BERA',     S.equity,      rN.equity],
    ['AI visibility',    'GEOPulse', S.aiVis,       A.lead],
    ['Share of voice',   'NewIntel', `${S.sov}%`,   `${rN.sov}%`],
    ['Creator affinity', 'IMAI',     S.creators,    rN.creators],
  ];

  /* Bars are read against the larger of the pair, so the winning side always
     runs the full half-width and the loss is legible as the shortfall. */
  const row = ([k, src, mine, theirs]) => {
    const a = val(mine), b = val(theirs), top = Math.max(a, b) || 1;
    const win = a >= b ? 'me' : 'them';   /* a tie reads to the subject — this is their brief */
    const dot = '<i class="duel__dot" aria-hidden="true"></i>';
    return `<div class="duel__row">
      <span class="duel__fig duel__fig--me${win === 'me' ? ' is-win' : ''}">
        <b class="num">${esc(String(mine))}</b>${win === 'me' ? dot : ''}</span>
      <span class="duel__t duel__t--me"><i style="--w:${Math.round(a / top * 100)}%"></i></span>
      <span class="duel__k">${esc(k)}<em>${esc(src)}</em></span>
      <span class="duel__t duel__t--them"><i style="--w:${Math.round(b / top * 100)}%"></i></span>
      <span class="duel__fig duel__fig--them${win === 'them' ? ' is-win' : ''}">
        ${win === 'them' ? dot : ''}<b class="num">${esc(String(theirs))}</b></span>
    </div>`;
  };

  const col = (side, cls) => `<div class="duel__side ${cls}">
    <span class="duel__who">${mark(side.domain || side.name, 34)}
      <span class="duel__id"><b>${esc(side.name || '')}</b><em>${esc(side.domain || '')}</em></span></span>
    <p class="duel__pos">${esc(side.pos || '')}</p>
  </div>`;

  /* Inferred subjects carry no public record, so nulls are simply left out
     rather than printed as blanks. */
  const facts = side => {
    const f = [['HQ', side.hq], ['Founded', side.founded], ['People', side.people]].filter(x => x[1]);
    return `<div class="duel__facts">${f.length
      ? f.map(x => `<span class="duel__fact"><b>${x[0]}</b>${esc(x[1])}</span>`).join('')
      : '<span class="duel__fact"><b>Profile</b>Inferred from the site</span>'}</div>`;
  };

  const eqMine = S.equity >= rN.equity, visMine = S.aiVis > A.lead;
  const verdict = visMine
    ? `${esc(S.brand)} holds the answer layer ${S.aiVis} to ${A.lead}${eqMine
        ? `, and equity with it, ${S.equity} to ${rN.equity}`
        : `, though equity sits with ${esc(rv.name)}, ${rN.equity} to ${S.equity}`} — the rest of this brief is the plan to keep it.`
    : eqMine
      ? `Equity is ${esc(S.brand)}’s, ${S.equity} to ${rN.equity} — but ${esc(rv.name)} holds the answer layer ${A.lead} to ${S.aiVis}, and that is the score the machines read. The rest of this brief is the plan to take it back.`
      : `${esc(rv.name)} holds the answer layer ${A.lead} to ${S.aiVis} — the rest of this brief is the plan to take it back.`;

  return `
  <section class="bsec duel reveal">
    <div class="bhead"><h2>Head to head</h2><i></i><span class="tag">Section %N% · NewIntel</span></div>
    <div class="duel__arena">
      <div class="duel__cols">
        ${col(me, 'duel__side--me')}
        <span class="duel__vs" aria-hidden="true">vs</span>
        ${col(rv, 'duel__side--them')}
      </div>
      ${rv.confident ? `<div class="duel__strip">${facts(me)}${facts(rv)}</div>` : ''}
      <div class="duel__rows">${rows.map(row).join('')}</div>
    </div>
    <p class="duel__verdict">${verdict}</p>
  </section>`;
}

function buildBrief() {
  const A = computeAnalysis(S);
  const { b, c1, c2, cat, lead, quotes } = A;
  const trends = A.trends;
  const modelScores = A.models;
  const OPPS = A.opps, SOLUTIONS = A.solutions, HOR = A.horizons;
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const bar = (v, cls) => `<i class="${cls}" style="--w:${v}%"></i>`;
  const Vc = A.V, win = A.win;
  const duel = S.mode === 'duel';

  /* The mini-audit: three buying prompts put to a live model while the loader
     ran. Only the calls that came back are counted, and when none did the strip
     is absent altogether — a measurement we did not take is never drawn as a
     zero. The full answer hangs off title, so the receipt is one hover away.
     esc() does not touch quotes and these land inside an attribute, so the
     double quote is closed off here too. */
  const auditRow = r => `<div class="audit__row" title="${esc(r.answer).replace(/"/g, '&quot;')}">
      <p class="audit__q">“${esc(r.prompt)}”</p>
      <span class="audit__m${r.hit ? ' is-on' : ''}">${esc(b)}<i>${r.hit ? 'named' : 'absent'}</i></span>
      <span class="audit__r">${esc(r.model)} · ${r.ms}ms</span>
    </div>`;
  const auditHTML = S.audit ? `
    <div class="audit">
      <div class="audit__bar"><i class="pulse"></i><b>Live audit</b><span class="sp"></span>
        <span>${S.audit.total} prompts · measured seconds ago</span></div>
      ${S.audit.rows.map(auditRow).join('')}
      <div class="audit__verdict${S.audit.hits ? ' is-on' : ''}">
        <span class="audit__fig">Named in <b>${S.audit.hits}</b> of <b>${S.audit.total}</b></span>
      </div>
      <p class="audit__note">Three real buying prompts, asked live during this build. The full GEOPulse index runs this across eight models, daily.</p>
    </div>` : '';

  /* The prompt they typed at the follow-up beat, answered. */
  const testedHTML = A.tested ? `
    <div class="tested">
      <div class="tested__bar"><i class="pulse"></i><b>Your prompt, tested</b><span class="sp"></span>
        <span>8 models · ${win} window</span></div>
      <p class="tested__q">“${esc(A.tested.prompt)}”</p>
      ${A.tested.live ? `<div class="live live--flat">
        <div class="live__bar"><i class="pulse"></i><b>${esc(A.tested.live.model)}</b><span class="sp"></span>
          <span>answered in ${A.tested.live.ms}ms · not simulated</span></div>
        <p class="live__a">${esc(A.tested.live.answer)}</p>
        <div class="live__marks">
          ${[S.brand, ...S.comps].filter(Boolean).map(n => {
            const on = A.tested.live.named.some(x => x.toLowerCase() === n.toLowerCase());
            return `<span class="live__m${on ? ' is-on' : ''}">${brandMark(n, 15)}${esc(n)}<i>${on ? 'named' : 'not named'}</i></span>`;
          }).join('')}
        </div>
      </div>` : ''}
      <p class="tested__sub">Modelled across the wider engine set:</p>
      <div class="tested__grid">
        ${MODELS.map(m => {
          const on = A.tested.named.includes(m);
          return `<span class="tested__m${on ? ' is-on' : ''}">${m}<i>${on ? 'named' : 'absent'}</i></span>`;
        }).join('')}
      </div>
      <p class="tested__note"><b>${esc(b)}</b> is named by ${A.tested.named.length} of 8 models on that prompt, at an average position of ${A.tested.rank}. <b>${esc(A.tested.winner)}</b> is named by all eight, first, in six.</p>
    </div>` : '';

  const asked = `You asked me to lead on ${esc(A.leadLine)}.`;
  const quoted = S.challenge ? ` You put it as “${esc(S.challenge.slice(0, 88))}” — this brief prices it.`
    : S.belief ? ` You want the market to believe “${esc(S.belief)}” — this measures the distance.`
    : S.worry  ? ` You flagged “${esc(S.worry)}” — I have looked straight at it.`
    : '';

  /* Either the model wrote this paragraph for this session or the script did,
     never a blend of the two — a badge over half-scripted prose is the one lie
     this page must not tell. The receipt says which model and how long it took;
     the template carries no badge at all. */
  const sumHTML = S.liveSummary
    ? `<p class="bsum" id="bsum">${esc(S.liveSummary.text)}</p>
    <span class="bsum__meta"><i class="pulse"></i>written for this session by ${esc(S.liveSummary.model)} · ${esc(String(S.liveSummary.ms))}ms · unscripted</span>`
    : `<p class="bsum">${asked} Here is what I found. ${esc(b)} holds a defensible position in ${cat} — brand equity sits at <b>${S.equity}</b> against a category mean of 58. The machines that now mediate ${Vc.pos} category do not know it: across eight language models ${esc(b)} is named in <b>${S.aiVis}%</b> of relevant answers where ${esc(c1)} is named in <b>${lead}%</b>.${quoted} The gap is a supply problem in earned citation, and it is the cheapest thing on this page to fix.</p>`;

  /* Sections are emitted in the order the visitor's focus asked for, so the
     lens they picked is the first thing under the summary. */
  const SEC = {
    visibility: () => `
  <section class="bsec reveal">
    <div class="bhead"><h2>How AI describes ${Vc.obj}</h2><i></i><span class="tag">Section %N% · GEOPulse</span></div>
    ${auditHTML}
    ${testedHTML}
    <div class="vis">
      ${modelScores.map(s => `<div class="visrow">
          <span class="visrow__n">${s.m}</span>
          <span class="visrow__track">${bar(s.me, 'me')}${bar(s.them, 'them')}</span>
          <span class="visrow__v">${s.me}% · ${s.them}%</span></div>`).join('')}
    </div>
    <div class="vislegend"><span><i></i>${esc(b)}</span><span><i class="them"></i>${esc(c1)}</span>
      <span>Share of relevant answers, ${win} window</span></div>
    <div class="quotes">
      ${quotes.map(q => `<div class="quote${q[2] ? ' quote--live' : ''}">
        ${q[2] ? '<span class="quote__live"><i class="pulse"></i>Live</span>' : ''}
        <p>${q[0]}</p><b>${q[1]}</b></div>`).join('')}
    </div>
  </section>`,

    competitors: () => `
  <section class="bsec reveal">
    <div class="bhead"><h2>Competitor snapshot</h2><i></i><span class="tag">Section %N% · NewIntel</span></div>
    <table class="tbl">
      <thead><tr><th>Brand</th><th>AI visibility</th><th>Equity trend</th><th>Creator momentum</th><th>Last move — ${win}</th></tr></thead>
      <tbody>
        <tr class="you"><td class="nm" data-label="Brand">${brandMark(S.domain, 18)}${esc(b)}${Vc.mine ? ' <span class="rel">you</span>' : ''}</td>
          <td data-label="AI visibility"><span class="mini" style="--w:${S.aiVis}%"><i></i></span> ${S.aiVis}</td>
          <td data-label="Equity trend"><span class="pill pill--up">▲ 4</span></td>
          <td data-label="Creator momentum">Unmanaged</td>
          <td data-label="Last move">—</td></tr>
        ${A.competitors.map(c => `<tr><td class="nm" data-label="Brand">${brandMark(c.name, 18)}${esc(c.name)}</td>
            <td data-label="AI visibility"><span class="mini" style="--w:${c.vis}%"><i></i></span> ${c.vis}</td>
            <td data-label="Equity trend"><span class="pill pill--${c.up ? 'up' : 'down'}">${c.up ? '▲' : '▼'} ${c.delta}</span></td>
            <td data-label="Creator momentum">${c.momentum}</td>
            <td data-label="Last move">${c.move}</td></tr>`).join('')}
      </tbody>
    </table>
  </section>`,

    trends: () => `
  <section class="bsec reveal">
    <div class="bhead"><h2>What is moving in ${Vc.pos} industry</h2><i></i><span class="tag">Section %N% · HarrisQuest</span></div>
    <div class="cards">
      ${trends.map((t, i) => `<article class="card">
        <span class="card__k">Trend 0${i + 1}</span><h3>${t[0]}</h3><p>${t[1]}</p>
        <span class="card__foot">${i === 2 ? 'HarrisX · six markets' : 'Stagwell signal index'}</span></article>`).join('')}
    </div>
  </section>`,

    opps: () => `
  <section class="bsec reveal">
    <div class="bhead"><h2>Where the value is</h2><i></i><span class="tag">Section %N% · ranked${S.growthMode ? ' for ' + esc(S.growthMode.toLowerCase()) : ''}</span></div>
    <div class="opps">
      ${OPPS.map((o, i) => `<article class="opp">
        <span class="opp__r">0${i + 1}</span>
        <div class="opp__b"><h3>${o.h}</h3><p>${o.p}</p>
          <div class="opp__engines">${o.e.map(e => `<span class="tagx">${e}</span>`).join('')}</div></div>
        <div class="opp__m">
          <span class="opp__lift"><b class="num">${o.lift}</b><small>${o.l}</small></span>
          <span class="meter"><b>Impact<span class="num">${o.impact}</span></b><i style="--w:${o.impact}%"></i></span>
          <span class="meter"><b>Effort<span class="num">${o.effort}</span></b><i style="--w:${o.effort}%"></i></span>
        </div></article>`).join('')}
    </div>
    ${whatIfHTML(S, A)}
  </section>`,

    solutions: () => `
  <section class="bsec reveal">
    <div class="bhead"><h2>What we would put on it</h2><i></i><span class="tag">Section %N% · Stagwell AI</span></div>
    <div class="cards">
      ${SOLUTIONS.map(s => `<article class="card">
        <span class="card__k">${s[0]}</span><h3>${s[1]}</h3><p>${s[2]}</p>
        <span class="card__foot">${s[3]}</span></article>`).join('')}
    </div>
  </section>`,

    studies: () => `
  <section class="bsec reveal">
    <div class="bhead"><h2>The research behind this</h2><i></i><span class="tag">Section %N% · HarrisX</span></div>
    <ul class="studies">
      ${STUDIES.map(s => `<li class="study">
        <span class="study__t">${s[0]}${s[2] ? '<span class="rel">Relevant to you</span>' : ''}</span>
        <span class="study__m">${s[1]}</span></li>`).join('')}
    </ul>
  </section>`,

    horizons: () => `
  <section class="bsec reveal">
    <div class="bhead"><h2>The first ninety days</h2><i></i><span class="tag">Section %N% · suggested</span></div>
    <div class="horizons">
      ${HOR.map(h => `<div class="horizon">
        <div class="horizon__h"><b>${h[0]}</b><span>${h[1]}</span></div>
        <ul>${h[2].map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('')}
    </div>
  </section>`,
  };

  const duelHTML = duelSection(A);
  const ordered = A.order.map(k => SEC[k]()).join('');

  const html = `
  <section class="board" id="boardView" hidden>
    <div class="board__top">
      <svg class="board__mark"><use href="#sw-mark"/></svg>
      <p class="board__eyebrow">Board brief · ${esc(b)} · prepared for ${esc(S.firstName || 'you')}${S.role ? ' · ' + esc(S.role) : ''}</p>
    </div>
    <h2 class="board__head">${esc(b)} is strong where the market can see it —
      <span>and invisible where the machines answer.</span></h2>
    <div class="board__nums">
      <div class="board__num"><b class="boardnum">${S.equity}</b><small>/100</small>
        <span class="board__lbl">Brand equity</span></div>
      <div class="board__num"><b class="boardnum">${S.aiVis}</b>
        <span class="board__lbl">AI visibility</span>
        <em class="board__sub">vs ${esc(c1)} ${lead}%</em></div>
      <div class="board__num"><b class="boardnum">${S.sov}</b><small>%</small>
        <span class="board__lbl">Share of voice</span>
        <em class="board__sub">flat</em></div>
    </div>
    <div class="board__moves">
      <p class="board__kicker">Three moves</p>
      ${OPPS.map((o, i) => `<div class="board__move">
        <span class="board__mn">0${i + 1}</span><span class="board__mh">${o.h}</span>
        <span class="board__ml">${o.lift} ${o.l}</span></div>`).join('')}
    </div>
    <div class="board__foot">
      <div class="board__quote"><p>${quotes[0][0]}</p>
        <b>${quotes[0][1]}${quotes[0][2] ? '<i class="board__live">Live</i>' : ''}</b></div>
      <p class="board__penn">“Instead of feeding the vicious cycle of news demonetization, advertisers should
        kickstart a virtuous cycle of investing in news.” <b>Mark Penn</b> · Chairman &amp; CEO, Stagwell</p>
    </div>
    <div class="board__acts">
      <button class="btn btn--light" data-cta="workspace">Request the full workspace</button>
      <button class="btn btn--ghost-void" id="boardBack">Back to the full brief</button>
    </div>
  </section>

  <header class="bmast reveal">
    <div class="bmast__top">
      <span class="bmast__badge bmast__badge--mark">${brandMark(S.domain, 18)}${esc(S.domain)}</span>
      <span class="bmast__badge"><i class="pulse"></i>Executive AI Brief</span>
      ${S.mode === 'duel' && S.rivalProfile ? `<span class="bmast__badge duel__badge">
        ${brandMark(S.domain, 16)}${esc(S.brand)}<i>vs</i>${brandMark(S.rivalProfile.domain, 16)}${esc(S.rivalProfile.name)}</span>` : ''}
      <span class="bmast__badge">${S.firstName ? 'Prepared for ' + esc(S.firstName) + (S.role ? ' · ' + esc(S.role) : '') : 'Confidential preview'}</span>
    </div>
    <h1>${esc(b)}${duel ? ` <span>vs</span> ${esc(S.rivalProfile.name)}` : ''}.<br><span>Read, diagnosed, and priced.</span></h1>
    <div class="bmast__meta">
      <span>Source <b>${esc(S.domain)}</b></span><span>Generated <b>${today}</b></span>
      <span>Elapsed <b>41 seconds</b></span><span>Engines <b>10</b></span>
      <span>Window <b>${win}</b></span><span>Category <b>${esc(S.industryLabel || 'General')}</b></span>
      <span>Leading on <b>${esc(focusLabel(S.focus[0], S.mode))}</b></span>
      ${S.email ? `<span>Sent to <b>${esc(S.email)}</b></span>` : ''}
    </div>
    <div class="bmast__acts">
      <button class="btn btn--dark" data-cta="workspace">Request the full workspace</button>
      <button class="btn btn--ghost" data-cta="pdf">Download as PDF</button>
      <button class="btn btn--ghost" data-cta="share">Share with my team</button>
      <button class="btn btn--ghost" data-boardview>Board view</button>
    </div>
  </header>

  <section class="bsec reveal">
    <div class="bhead"><h2>Executive summary</h2><i></i><span class="tag">Section %N%</span></div>
    ${sumHTML}
    <div class="kpis">
      <div class="kpi"><span class="kpi__k">Brand equity · BERA</span>
        <span class="kpi__v"><b class="num">${S.equity}</b><small>/100</small></span>
        <span class="kpi__d up">▲ 4 pts vs last quarter</span>
        <span class="kpi__bar" style="--w:${S.equity}%"><i></i></span></div>
      <div class="kpi"><span class="kpi__k">AI visibility · GEOPulse</span>
        <span class="kpi__v"><b class="num">${S.aiVis}</b><small>/100</small></span>
        <span class="kpi__d down">▼ ${S.gap} pts behind ${esc(c1)}</span>
        <span class="kpi__bar" style="--w:${S.aiVis}%"><i></i></span></div>
      <div class="kpi"><span class="kpi__k">Share of voice · NewIntel</span>
        <span class="kpi__v"><b class="num">${S.sov}</b><small>%</small></span>
        <span class="kpi__d flat">— flat, 3 quarters</span>
        <span class="kpi__bar" style="--w:${S.sov * 3}%"><i></i></span></div>
      <div class="kpi"><span class="kpi__k">Creator affinity · IMAI</span>
        <span class="kpi__v"><b class="num">${S.creators}</b></span>
        <span class="kpi__d up">▲ unpaid, unmanaged</span>
        <span class="kpi__bar" style="--w:64%"><i></i></span></div>
    </div>
  </section>

  ${duelHTML}

  <section class="bsec reveal">
    <div class="bhead"><h2>Ask the machine</h2><i></i><span class="tag">Live · unscripted</span></div>
    <p class="bsum bsum--ask">This brief answers questions. Ask about the findings, the gap to ${esc(c1)}, or what to do first — the reply comes from a live model holding this diagnosis, not from a script.</p>
    <div class="qa" id="qa">
      <div class="qa__chips" id="qaChips"></div>
      <div class="qa__thread" id="qaThread"></div>
      <form class="qa__form" id="qaForm" autocomplete="off">
        <input type="text" id="qaInput" placeholder="Ask about ${esc(b)}’s diagnosis…" aria-label="Ask a question about this brief" spellcheck="false">
        <button type="submit" id="qaGo" aria-label="Ask">
          <svg viewBox="0 0 18 18" width="15" height="15"><path d="M9 14.5V3.5M4.4 8.1L9 3.5l4.6 4.6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </form>
    </div>
  </section>
  ${ordered}

  <section class="bvideo reveal">
    <div class="bvideo__in">
      <p class="eyebrow"><i class="pulse"></i>Section %N% · DoReel</p>
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
    <div class="bhead"><span class="tag">Section %N% · Executive insight</span><i></i></div>
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

  /* Sections stamp their own numbers in source order, so inserting the duel
     head-to-head cannot leave a gap or a duplicate behind it. */
  let n = 1;
  $('#brief').innerHTML = html.replace(/%N%/g, () => String(n++).padStart(2, '0'));

  observeReveals();
  wireQA();
  wireMarks($('#brief'));
  reveal($$('.study, .kpi, .card, .opp, .horizon, .quote', $('#brief')), $('#briefScroll'));
  countAllIn($('#brief'));
  blurWords($('.bmast h1'), 120);
  wirePlayer();
  wireWhatIf($('#brief'), S, A);
  wireBoardView();
  $('#briefScroll').scrollTop = 0;
}

/* ── Ask the machine ──
   The one place the demo goes off-script on purpose. One question in flight
   at a time; a failure answers in character rather than erroring, because
   this section's promise is that it always answers. */
let qaBusy = false;
function wireQA() {
  const form = $('#qaForm'), input = $('#qaInput'), thread = $('#qaThread'), chips = $('#qaChips');
  if (!form) return;

  chips.innerHTML = '';
  chatChips(S).forEach((q, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'qa__chip';
    b.textContent = q;
    b.style.animationDelay = `${i * 60}ms`;
    b.addEventListener('click', () => askQA(q));
    chips.appendChild(b);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    askQA(input.value);
  });

  async function askQA(raw) {
    const q = (raw || '').trim();
    if (!q || qaBusy) return;
    qaBusy = true;
    input.value = '';
    form.classList.add('is-busy');

    const row = document.createElement('div');
    row.className = 'qa__row';
    row.innerHTML = `
      <p class="qa__q">${esc(q)}</p>
      <div class="qa__a"><span class="qa__pending"><span class="thinking"><i></i><i></i><i></i></span> consulting the diagnosis…</span></div>`;
    thread.appendChild(row);
    row.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });

    const d = await chatAsk(q, S);
    const a = $('.qa__a', row);
    if (d) {
      a.innerHTML = `<p>${esc(d.answer)}</p>
        <span class="qa__meta"><i class="pulse"></i>${esc(d.model)} · answered live in ${d.ms}ms · unscripted</span>`;
    } else {
      a.innerHTML = `<p>I want to give you a considered answer to that one, and the line to the engines is busy — ask me again in a moment, or put it to the team directly.</p>
        <span class="qa__meta">the machine could not be reached — this reply is the fallback</span>`;
    }
    row.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' });
    qaBusy = false;
    form.classList.remove('is-busy');
  }
}

/* ─────────────────────────── BOARD VIEW ─────────────────────────── */
/* Collapses the ten-section brief to the one screen a board actually reads.
   Kept off the generic .num sweep above — it counts on entry only, driven
   here, so toggling back and forth never races two count-ups on one figure. */
let boardScrollY = 0;

function enterBoard() {
  const brief = $('#brief'), board = $('#boardView', brief || document);
  if (!brief || !board) return;
  const scroller = $('#briefScroll');
  boardScrollY = scroller.scrollTop;
  [...brief.children].forEach(el => { if (el !== board) el.hidden = true; });
  board.hidden = false;
  scroller.scrollTop = 0;
  const toggle = $('[data-boardview]', brief);
  if (toggle) toggle.textContent = 'Full brief';
  $$('.boardnum', board).forEach(el => countUp(el));
}

function exitBoard() {
  const brief = $('#brief'); if (!brief) return;
  const board = $('#boardView', brief);
  if (!board || board.hidden) return;
  [...brief.children].forEach(el => { el.hidden = false; });
  board.hidden = true;
  $('#briefScroll').scrollTop = boardScrollY;
  const toggle = $('[data-boardview]', brief);
  if (toggle) toggle.textContent = 'Board view';
}

function wireBoardView() {
  const brief = $('#brief');
  $('[data-boardview]', brief)?.addEventListener('click', () => {
    const board = $('#boardView', brief);
    (board && !board.hidden) ? exitBoard() : enterBoard();
  });
  $('#boardBack', brief)?.addEventListener('click', exitBoard);
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
  const v = V();
  const script = [
    `${S.firstName ? S.firstName + ', here' : 'Here'} is ${S.brand}'s diagnosis — generated forty seconds ago.`,
    `${v.Pos} brand equity is strong. ${v.Pos} visibility inside AI answers is not.`,
    `${S.comps[0] || 'The closest rival'} is named ${S.gap} points more often than ${v.sub} ${v.mine ? 'are' : 'are'}.`,
    S.query ? `Nobody asking “${S.query}” is being told about ${S.brand}.`
            : `Three moves close that gap. The first one costs almost nothing.`,
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

  Object.assign(S, BLANK, { focus:['ai'], comps:[], rivalProfile:null, emailNudged:false });
  pending = null;
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
  blurWords($('#heroTitle'), 80);
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

/* Wired after the lists render — observing an empty selector would leave
   those rows at opacity 0 permanently. */
reveal($$('.doc .stat, .doc .study'));
countAllIn(document);

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
  /* rel=rival names one opponent instead of a set: the brief becomes a duel and
     the rival is carried as a full profile so the head-to-head has facts to show.
     comps[0] is re-seated with the resolved brand name — computeAnalysis reads
     the rival off it, and "nike.com" is not how a rival should be named. */
  if (params.get('rel') === 'rival') {
    const rp = readWebsite(S.comps[0] || p.peers[0] || 'nike.com');
    if (rp.domain !== p.domain) {
      S.mode = 'duel'; S.rivalProfile = rp;
      S.comps = [rp.name, ...S.comps.filter(c => c.toLowerCase() !== rp.name.toLowerCase()
        && c.toLowerCase() !== rp.domain)].slice(0, 3);
    }
  }
  S.firstName = params.get('who') || '';
  S.email = params.get('email') || '';
  S.rel = params.get('rel') || 'owner';
  /* a rival deep link needs both halves before it can be a duel */
  if (S.rel === 'rival' && params.get('vs')) {
    S.rivalProfile = readWebsite(S.comps[0]); S.viewerProfile = p;
  }
  S.mode = modeFor(S);
  const f = (params.get('focus') || 'ai').split(',').map(x => x.trim()).filter(k => FOCUS[k]);
  S.focus = f.length ? f.slice(0, 2) : ['ai'];
  S.focusLead = FOCUS[S.focus[0]].lead;
  S.query = params.get('q') || '';
  S.windowLabel = params.get('window') || '';
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
  blurWords($('#heroTitle'), 140);
  requestAnimationFrame(() => promptInput.focus());
  if (params.has('view')) show(params.get('view'));
})();

})();
