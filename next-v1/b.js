/* ═══════════════════════════════════════════════════════════════════════════
   STAGWELL AI — VERSION B
   A classic landing page. Same machine, same script, same numbers as version A
   (all of it from shared.js) — but the answer arrives as a live dashboard
   sitting inside the page, not as a report in a workspace.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const { esc, pick, PARTNERS, partnerSrc, LOGO_SCALE, STUDIES, INDUSTRIES, DEFAULT_INDUSTRY,
        readWebsite, STATUS_LINES, FOCUS, ROLES, MODELS, numbersFor, computeAnalysis,
        countUp, whenVisible, countAllIn, blurWords, reveal,
        RELATIONSHIP, FOCUS_KEYS, FOLLOWUPS, WINDOWS, modeFor, voiceFor,
        focusLabel, focusLine, parseFocus, okEmail, nameFromEmail, specRows,
        statusLines, crawlFor, brandMark, wireMarks, askLive,
        fetchLiveQuotes, fetchAudit, chatAsk, chatChips, whatIfHTML, wireWhatIf } = window.SWAI;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
/* Only a real pointer gets auto-focus. On touch, focus() summons the keyboard
   unasked and covers the very field it just focused. */
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
const focusPrompt = () => { if (FINE) promptInput.focus({ preventScroll: true }); };

/* ─────────────────────────── STATE ─────────────────────────── */

const BLANK = {
  step:0, busy:false, done:false, editing:false,
  domain:'', brand:'', who:'', firstName:'', email:'', role:'', roleArticle:'board',
  industryLabel:'', data:DEFAULT_INDUSTRY, profile:null, viewerProfile:null, rivalProfile:null,
  rel:'owner', mode:'owner', comps:[], challenge:'', pages:42,
  focus:['ai'], focusLead:0,
  query:'', belief:'', worry:'', growthMode:'', windowLabel:'', live:null, liveQuotes:null,
  audit:null, emailNudged:false,
};
const S = Object.assign({ equity:62, aiVis:41, sov:18, gap:40, creators:'1,204', seed:1 }, BLANK);
const V = () => voiceFor(S);

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

/* Pick up to two — the only composed answer in the script. */
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
    };
    list.forEach((label, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'opt opt--check'; b.dataset.v = label;
      b.innerHTML = `<span class="opt__box"><svg viewBox="0 0 14 14" width="10" height="10"><path d="M2.5 7.4l3 3 6-6.6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>${label}`;
      b.style.animationDelay = `${80 + i * 55}ms`;
      b.addEventListener('click', () => {
        const j = picked.indexOf(label);
        if (j >= 0) picked.splice(j, 1); else if (picked.length < max) picked.push(label);
        sync();
      });
      wrap.appendChild(b);
    });
    go.style.animationDelay = `${80 + list.length * 55}ms`;
    go.addEventListener('click', () => picked.length && submit(picked.join(' · ')));
    wrap.appendChild(go);
    body.appendChild(wrap); sync();
    requestAnimationFrame(() => wrap.scrollIntoView({ block:'end', behavior: REDUCED ? 'auto' : 'smooth' }));
    setTimeout(resolve, 120);
  });
}

/* The read-back — the only way back through an append-only thread. */
function specCard(body) {
  const rows = specRows(S);
  const card = document.createElement('div');
  card.className = 'spec';
  card.innerHTML = `
    <div class="spec__bar"><i class="pulse"></i><b>Ready to build</b><span class="sp"></span>
      <span>${rows.length} captured</span></div>
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
  body.appendChild(card);
  requestAnimationFrame(() => card.scrollIntoView({ block:'end', behavior: REDUCED ? 'auto' : 'smooth' }));

  $$('[data-edit]', card).forEach(b => b.addEventListener('click', () => {
    if (S.busy) return;
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
  $('[data-over]', card).addEventListener('click', () => resetB());
}

function inferenceRows(p) {
  const rows = [
    ['Company', p.legal || p.name], ['Industry', p.ind], ['What you do', p.what],
    ['Positioning', p.pos], ['Likely audience', p.audience], ['Brand language', p.tone],
  ];
  if (p.confident) rows.push(['Headquarters', p.hq], ['Founded', p.founded], ['People', p.people]);
  else rows.push(['Named entities', String(p.entities)], ['Earned mentions, 30d', String(p.mentions)],
                 ['Read confidence', 'High']);
  return rows;
}

/* The crawl streams, the counters climb, then the rows land one at a time.
   A card that arrives whole makes "42 pages read" a claim with nothing
   behind it. */
let rush = false;
async function readSite(body, p) {
  const rows = inferenceRows(p), crawl = crawlFor(S);
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
  scrollThread();

  const feed = $('#crawl', card), nEl = $('#crawlN', card), eEl = $('#crawlE', card);
  const rowsEl = $('#siteRows', card), note = $('#siteNote', card);

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
  scrollThread();
}

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
  scrollThread();

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
  scrollThread();
  await wait(REDUCED ? 30 : 520);

  await say(hit
    ? `You are in that answer — but so are ${esc(live.named.filter(n => n.toLowerCase() !== String(S.brand).toLowerCase()).join(' and ') || 'others')}. Being present is not the same as being chosen.`
    : `<em>${esc(S.brand)}</em> is not in that answer. <span class="hl">That is a real result, not a simulation</span> — and it is the gap this brief prices.`,
    { node: body, delay: 240 });
}

/* The example address the delivery step shows — used by the placeholder and
   by the nudge when what was typed isn't an email, so the two can't drift. */
const emailExample = () =>
  (S.mode === 'owner' || S.mode === 'duel') && S.domain ? `you@${S.domain}` : 'you@company.com';

const SCRIPT = [
  {
    key: 'website',
    placeholder: 'Describe your problem — or paste your website, like nike.com — and we’ll take it from there…',
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

      const what = S.profile.what.charAt(0).toLowerCase() + S.profile.what.slice(1);
      const where = S.profile.confident ? `, out of ${esc(S.profile.hq)}` : '';
      await say(`That is <em>${esc(S.brand)}</em> — ${esc(what)}${where}, positioned as ${esc(S.profile.pos.toLowerCase())}. In the answer layer it sits against ${esc(S.profile.peers.slice(0, 2).join(' and '))}. <span class="hl">I have what I need.</span> Before I go further — is <em>${esc(S.brand)}</em> where you work, or are you sizing them up?`,
        { node: body, delay: 220, options: RELATIONSHIP.map(r => r.label) });
      return body;
    },
  },
  { key: 'relationship', placeholder: 'Or tell me in your own words',
    async reply() {
      await say({ owner:    `Good — then this is a read on your own position, and I will not soften it.`,
                  rival:    `Understood. Then I want both sides of this.`,
                  observer: `Fine — a straight read on the category, with no axe to grind.` }[S.rel]);
    } },
  { key: 'viewerSite', skipIf: () => S.rel !== 'rival', placeholder: 'yourcompany.com',
    question: () => `What should I measure <em>${esc(S.profile.name)}</em> against — your own site?`,
    optionsFor: () => ['Skip — just read them'],
    async reply() {
      await say(S.mode === 'duel'
        ? `Then I will build this as <em>${esc(S.brand)}</em> against <em>${esc(S.rivalProfile.name)}</em> — both read, both scored, side by side.`
        : `Then I will read <em>${esc(S.brand)}</em> cold, with no comparison to you in it.`);
    } },
  { key: 'focus', placeholder: 'Or tell me in your own words',
    question: () => `What should I lead with? <span class="hl">Pick one or two.</span>`,
    multiFor: () => FOCUS_KEYS.map(k => focusLabel(k, S.mode)),
    async reply() {
      const second = S.focus[1] ? ` Then <em>${esc(focusLabel(S.focus[1], S.mode).toLowerCase())}</em>.` : '';
      const own = S.challenge ? ` I will keep your words on it — <em>“${esc(S.challenge)}”</em>.` : '';
      await say(`Good. I will lead on ${esc(focusLine(S.focus[0], S.mode))}.${second}${own}`);
    } },
  { key: 'followup',
    placeholder: () => FOLLOWUPS[S.focus[0]].placeholder,
    question: () => FOLLOWUPS[S.focus[0]].q(S, V()),
    optionsFor: () => FOLLOWUPS[S.focus[0]].options(S),
    async reply() {
      await say(FOLLOWUPS[S.focus[0]].ack(S, V()));
      if (S.focus[0] === 'ai' && S.query) await liveProbe();
    } },
  { key: 'role', skipIf: () => S.mode !== 'owner' && S.mode !== 'duel', placeholder: 'Your role',
    question: () => `And what is your role at <em>${esc(S.brand)}</em>?`,
    optionsFor: () => ROLES,
    async reply() { await say(`Noted — I will build this at ${esc(S.roleArticle)} altitude.`); } },
  { key: 'email',
    placeholder: () => emailExample(),
    question: () => `Last thing — what email address should I send the finished dashboard to?`,
    async reply() {
      await say(S.firstName
        ? `Thank you, <em>${esc(S.firstName)}</em>. Everything goes to <em>${esc(S.email)}</em> the moment it is built.`
        : `Noted — <em>${esc(S.email)}</em>.`);
    } },
  { key: 'confirm', placeholder: 'Tap “Build the report”', async reply() {} },
];

const STEP_LABEL = { website:'Reading the site', relationship:'Whose site it is',
  viewerSite:'Your side', focus:'Choosing a lens', followup:'Sharpening it',
  role:'Your role', email:'Delivery', confirm:'Ready' };

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
  promptInput.placeholder = typeof q.placeholder === 'function' ? q.placeholder() : q.placeholder;
  $('#chatStep').textContent = STEP_LABEL[q.key] || 'Ready';

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
  focusPrompt();
  if (pending !== null) { const p = pending; pending = null; submit(p); }
}

promptInput.addEventListener('focus', () => {
  if (FINE) return;
  setTimeout(() => $('.chat__panel').scrollIntoView({ block: 'end', behavior: 'smooth' }), 320);
});
promptInput.addEventListener('input', () =>
  prompt.classList.toggle('is-ready', promptInput.value.trim().length > 0));
promptForm.addEventListener('submit', e => {
  e.preventDefault();
  const val = promptInput.value;
  /* the kit conversation (machine/convo.js) owns the composer once it has
     taken over — every other submit while it's live is a free-text answer
     to whatever question it's showing */
  if (window.SAICONVO && window.SAICONVO.active()) { window.SAICONVO.submit(val); return; }
  /* every first submission from the landing hands off to the kit conversation
     when it's available; the old scripted SCRIPT flow only ever runs again
     from here on via window.startDashboard's internal call to submit() */
  if (window.SAIFLOW && window.SAICONVO && !S.busy && S.step === 0 && !S.done
      && window.SAICONVO.begin(val)) return;
  submit(val);
});
$$('.chat__eg').forEach(b => b.addEventListener('click', () => submit(b.dataset.eg)));

/* Options arrive a beat before the machine is ready for them — hold an eager
   tap rather than dropping it on the floor. */
let pending = null;

async function submit(raw) {
  if (S.busy) { if ((raw || '').trim()) pending = raw; return; }
  const text = (raw || '').trim();
  const q = SCRIPT[S.step];
  if (!q) { if (S.done) followUp(text); return; }
  if (q.key === 'confirm') return runMachine();
  if (!text) { prompt.classList.add('is-shake'); setTimeout(() => prompt.classList.remove('is-shake'), 440); return; }

  if (q.key === 'email' && !okEmail(text)) {
    prompt.classList.add('is-shake'); setTimeout(() => prompt.classList.remove('is-shake'), 440);
    if (!S.emailNudged) {
      S.emailNudged = true; S.busy = true;
      promptInput.value = ''; prompt.classList.remove('is-ready');
      addUser(text);
      await say(`I need an email address to send it to — something like <em>${esc(emailExample())}</em>.`);
      S.busy = false; focusPrompt();
    }
    return;
  }

  /* the fold asks for a problem first: until the kit's conversation engine
     lands (Sprint 2), a problem sentence gets a bridge reply inviting the
     website; a domain builds the dashboard right here, exactly as before */
  if (q.key === 'website' && (/\s/.test(text) || text.endsWith('?'))) {
    S.busy = true;
    promptInput.value = ''; prompt.classList.remove('is-ready');
    addUser(text);
    thread.hidden = false;
    await say('Heard. Paste your website — like <em>nike.com</em> — and I’ll pull a live read of your brand with that problem in mind.');
    S.busy = false; focusPrompt();
    return;
  }

  S.busy = true;
  promptInput.value = ''; prompt.classList.remove('is-ready');
  clearOptions();

  if (q.key === 'website') {
    S.profile = readWebsite(text);
    S.rivalProfile = null; S.viewerProfile = null; S.rel = 'owner'; S.mode = 'owner';
    S.domain = S.profile.domain; S.brand = S.profile.name; S.pages = S.profile.pages;
    S.industryLabel = S.profile.ind;
    S.data = INDUSTRIES[S.profile.ind] || DEFAULT_INDUSTRY;
    S.comps = S.profile.peers.slice(0, 3);
    Object.assign(S, numbersFor(S.domain, S.brand));
    thread.hidden = false;
    $('#chatBar').hidden = false;
    if ($('#chatHint')) $('#chatHint').hidden = true;
    $('#solveChips').hidden = true;
    $('#heroEyebrow').textContent = '';
    hero.classList.add('is-chatting');
  }

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

  if (q.key === 'viewerSite') {
    const skip = /^(skip|no|none|rather not|just read)/i.test(text);
    const vp = skip ? null : readWebsite(text);
    if (vp && vp.domain !== S.profile.domain) {
      S.rivalProfile = S.rivalProfile || S.profile;
      S.viewerProfile = vp;
      S.profile = vp;
      S.domain = vp.domain; S.brand = vp.name; S.pages = vp.pages;
      S.industryLabel = vp.ind;
      S.data = INDUSTRIES[vp.ind] || DEFAULT_INDUSTRY;
      S.comps = [S.rivalProfile.name,
                 ...vp.peers.filter(p => p.toLowerCase() !== S.rivalProfile.name.toLowerCase())].slice(0, 3);
      Object.assign(S, numbersFor(S.domain, S.brand));
    } else if (skip && S.rivalProfile) {
      S.profile = S.rivalProfile; S.rivalProfile = null; S.viewerProfile = null;
      S.domain = S.profile.domain; S.brand = S.profile.name;
      S.industryLabel = S.profile.ind;
      S.data = INDUSTRIES[S.profile.ind] || DEFAULT_INDUSTRY;
      S.comps = S.profile.peers.slice(0, 3);
      Object.assign(S, numbersFor(S.domain, S.brand));
    }
    S.mode = modeFor(S);
  }

  if (q.key === 'focus') {
    const keys = parseFocus(text, S.mode);
    S.focus = keys.length ? keys : ['ai'];
    S.focusLead = FOCUS[S.focus[0]].lead;
    if (!keys.length) S.challenge = text.slice(0, 90);
    S.query = S.belief = S.worry = S.growthMode = S.windowLabel = '';
    S.live = null;
  }

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

  const at = k => SCRIPT.findIndex(s => s.key === k);
  S.step++;
  if (S.editing && q.key !== 'focus') {
    const needRole = (S.mode === 'owner' || S.mode === 'duel') && !S.role;
    S.step = needRole ? at('role') : at('confirm');
    S.editing = needRole;
  }
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
  /* the three "what do the models say" questions run behind the loader */
  const quotesP = fetchLiveQuotes(S).catch(() => []);
  /* the mini-audit rides the same wait — three buying prompts, asked for real */
  const auditP = fetchAudit(S).catch(() => null);
  const think = $('#think'), status = $('#thinkStatus'), meter = $('#thinkMeter');
  status.innerHTML = ''; meter.style.width = '0';
  think.hidden = false; think.classList.remove('is-out');
  document.body.style.overflow = 'hidden';
  await wait(REDUCED ? 30 : 220);

  const LINES = statusLines(S, 'dashboard');
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
  /* one race for both, so the audit adds no second wait */
  const [liveQ, audit] = await Promise.race([Promise.all([quotesP, auditP]),
    new Promise(r => setTimeout(() => r([null, null]), REDUCED ? 400 : 5000))]);
  S.liveQuotes = liveQ; S.audit = audit;
  await wait(REDUCED ? 20 : 260);

  buildDashboard();
  /* the transcript has done its job — the hero goes back to being a hero */
  thread.innerHTML = ''; thread.hidden = true;
  hero.classList.remove('is-chatting');
  $('#hero2Title').innerHTML = `Here is <span class="accent">${esc(S.brand)}.</span>`;
  (window.revealLines||blurWords)($('#hero2Title'));
  $('#hero2Sub').textContent = `Built from one link, ${S.firstName || 'for you'} — ask me anything else below, or read the dashboard.`;
  $('#heroEyebrow').innerHTML = '<i class="pulse"></i>Analysis complete';
  promptInput.placeholder = 'Ask a follow-up, or type another website';
  S.done = true;
  showFollowChips();
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
        <h2>${brandMark(S.domain, 30)}${esc(S.brand)}</h2>
        <div class="dash__meta">
          <span>Built <b>${today}</b></span><span>Elapsed <b>41s</b></span>
          <span>Engines <b>10</b></span><span>Category <b>${esc(S.industryLabel)}</b></span>
          <span>Window <b>${A.win}</b></span>
          <span>Leading on <b>${esc(focusLabel(S.focus[0], S.mode))}</b></span>
          ${S.rivalProfile ? `<span>Against <b>${esc(S.rivalProfile.name)}</b></span>` : ''}
          ${S.email ? `<span>Sent to <b>${esc(S.email)}</b></span>` : ''}
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
              <!-- the measured version of the bars below: real prompts, real answers -->
              ${S.audit ? `<div class="pnl g12">
                <div class="pnl__h"><h4>Live audit</h4>
                  <span class="pnl__k audit__k"><i class="pulse"></i>${S.audit.total} prompts · measured seconds ago</span></div>
                <div class="audit audit--flat">
                  <div class="audit__verdict${S.audit.hits ? ' is-on' : ''}">
                    <span class="audit__fig">Named in <b>${S.audit.hits}</b> of <b>${S.audit.total}</b></span></div>
                  <div class="audit__rows">
                    ${S.audit.rows.map(r => `<div class="audit__row" title="${esc(r.answer).replace(/"/g, '&quot;')}">
                      <p class="audit__q">“${esc(r.prompt)}”</p>
                      <span class="audit__m${r.hit ? ' is-on' : ''}">${esc(A.b)}<i>${r.hit ? 'named' : 'absent'}</i></span>
                      <span class="audit__r">${esc(r.model)} · ${r.ms}ms</span></div>`).join('')}
                  </div>
                  <p class="audit__note">Three real buying prompts, asked live during this build. The full GEOPulse index runs this across eight models, daily.</p>
                </div>
              </div>` : ''}
              ${A.tested ? `<div class="pnl g12">
                <div class="pnl__h"><h4>Your prompt, tested</h4><span class="pnl__k">8 models · ${A.win}</span></div>
                <p class="tested__q" style="padding:6px 0 14px">“${esc(A.tested.prompt)}”</p>
                ${A.tested.live ? `<div class="live" style="margin:0 0 16px">
                  <div class="live__bar"><i class="pulse"></i><b>${esc(A.tested.live.model)}</b><span class="sp"></span>
                    <span>answered in ${A.tested.live.ms}ms · not simulated</span></div>
                  <p class="live__a">${esc(A.tested.live.answer)}</p>
                  <div class="live__marks">
                    ${[S.brand, ...S.comps].filter(Boolean).map(n => {
                      const on = A.tested.live.named.some(x => x.toLowerCase() === n.toLowerCase());
                      return `<span class="live__m${on ? ' is-on' : ''}">${brandMark(n, 15)}${esc(n)}<i>${on ? 'named' : 'not named'}</i></span>`;
                    }).join('')}
                  </div></div>` : ''}
                <div class="tested__grid" style="padding:0 0 14px">
                  ${MODELS.map(m => { const on = A.tested.named.includes(m);
                    return `<span class="tested__m${on ? ' is-on' : ''}">${m}<i>${on ? 'named' : 'absent'}</i></span>`;
                  }).join('')}
                </div>
                <p style="font-size:var(--t-sm);color:var(--ink-2);line-height:1.58"><b>${esc(A.b)}</b> is named by ${A.tested.named.length} of 8 models on that prompt, at an average position of ${A.tested.rank}. <b>${esc(A.tested.winner)}</b> is named by all eight.</p>
              </div>` : ''}
              <div class="pnl g8">
                <div class="pnl__h"><h4>Share of relevant answers</h4><span class="pnl__k">8 models · ${A.win}</span></div>
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
                  ${q[2] ? '<span class="quote__live" style="margin-bottom:7px"><i class="pulse"></i>Live</span>' : ''}
                  <p style="font-family:var(--serif);font-size:1rem;line-height:1.5;letter-spacing:-.01em">${q[0]}</p>
                  <b class="pnl__k" style="display:block;margin-top:9px;font-weight:400${q[2] ? ';color:var(--teal)' : ''}">${q[1]}</b></div>`).join('')}
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
                    <span class="sovrow__n">${brandMark(r.n, 17)}${esc(r.n)}</span>
                    <span class="sovrow__t"><i style="--w:${Math.round(r.v / top * 100)}%"></i></span>
                    <span class="sovrow__v num">${r.v}</span></div>`).join('')}
                </div>
              </div>
              ${A.competitors.map(c => `<div class="pnl g4">
                <div class="pnl__h"><h4>${brandMark(c.name, 18)}${esc(c.name)}</h4>
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
            ${whatIfHTML(S, A, { wrap: true })}
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
                <div class="pnl__h"><h4>${A.V.mine ? 'Your audience' : 'Their audience'}</h4><span class="pnl__k">SATS · 260M ID graph</span></div>
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
  wireMarks($('#dash'));
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
  wireWhatIf($('#dash'), S, A);
  /* Open on the lens they asked for rather than always on Overview. */
  const want = FOCUS[S.focus[0]].tab;
  if (want && want !== 'overview') setTab(want);
}

/* ─────────────────────────── VIDEO ─────────────────────────── */

/* DoReel's presenter cut, opened over the page and closable. */
function openVideo() {
  const A = computeAnalysis(S);
  const v = V();
  const script = [
    `${S.firstName ? S.firstName + ', here' : 'Here'} is ${S.brand}'s diagnosis — generated forty seconds ago.`,
    `${v.Pos} brand equity is strong. ${v.Pos} visibility inside AI answers is not.`,
    `${A.c1} is named ${S.gap} points more often than ${v.sub} are.`,
    S.query ? `Nobody asking “${S.query}” is being told about ${S.brand}.`
            : `Three moves close that gap. The first one costs almost nothing.`,
  ];
  modalBody.innerHTML = `
    <div class="modal__brand"><svg><use href="#sw-logo"/></svg></div>
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

/* ── After the dashboard: the composer keeps working ──
   "Ask me anything else below, or type another website" was an empty promise —
   the input did nothing once S.done was set. Now a domain starts a fresh
   analysis and anything else is answered live, in character, in the thread. */
let chatBusy = false;

async function followUp(text) {
  if (!text) {
    prompt.classList.add('is-shake');
    setTimeout(() => prompt.classList.remove('is-shake'), 440);
    return;
  }

  /* they took the "type another website" offer */
  const stripped = text.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!/\s/.test(stripped) && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(stripped)) {
    resetB();
    setTimeout(() => submit(text), REDUCED ? 100 : 700);
    return;
  }

  if (chatBusy) return;
  chatBusy = true;
  promptInput.value = ''; prompt.classList.remove('is-ready');

  thread.hidden = false;
  $('#chatBar').hidden = false;
  $('#chatStep').textContent = 'Live · unscripted';
  addUser(text);

  const body = aiTurn();
  const d = await chatAsk(text, S);
  $('.thinking', body)?.remove();
  const p = document.createElement('p'); p.className = 'ai__text';
  body.appendChild(p);
  if (d) {
    await typeHTML(p, esc(d.answer));
    const meta = document.createElement('p');
    meta.className = 'chat__livemeta';
    meta.innerHTML = `<i class="pulse"></i>${esc(d.model)} · answered live in ${d.ms}ms · unscripted`;
    body.appendChild(meta);
  } else {
    await typeHTML(p, `I want to give you a considered answer to that one, and the line to the engines is busy — ask me again in a moment.`);
  }
  scrollThread();
  chatBusy = false;
  focusPrompt();
}

/* Three safe taps so the room never has to improvise a question. */
function showFollowChips() {
  removeFollowChips();
  const wrap = document.createElement('div');
  wrap.className = 'chat__followups'; wrap.id = 'followChips';
  chatChips(S).forEach((q, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chat__eg';
    b.textContent = q;
    b.style.animationDelay = `${i * 60}ms`;
    b.addEventListener('click', () => followUp(q));
    wrap.appendChild(b);
  });
  $('.chat__panel').appendChild(wrap);
}
const removeFollowChips = () => $('#followChips')?.remove();

/* ─────────────────────────── START OVER ─────────────────────────── */

/* Anyone already holding a dashboard can run another company without reloading. */
function resetB() {
  if (S.busy) return;
  Object.assign(S, BLANK, { focus:['ai'], comps:[] });
  pending = null;
  thread.innerHTML = ''; thread.hidden = true;
  removeFollowChips();
  chatBusy = false;
  $('#chatBar').hidden = true;
  if ($('#chatHint')) $('#chatHint').hidden = false;
  /* THE FRONT DOOR IS THE PICKER (machine/hero.js). Restoring the older
     chip strip and its standfirst here left Back-from-/chat on a headline
     floating over 400px of nothing, with #heroPick still hidden (QA, Sep 2).
     When the picker exists it comes back and owns the title and standfirst;
     the legacy strip only returns on a page that never had a picker. */
  const pick = $('#heroPick');
  if (pick) {
    pick.hidden = false;
    $('#solveChips').hidden = true;
    if (window.SAIHERO && typeof window.SAIHERO.reset === 'function') window.SAIHERO.reset();
  } else {
    $('#solveChips').hidden = false;
  }
  $('#dash').hidden = true; $('#dash').innerHTML = '';
  $('#navNew').hidden = true;
  $('.mnav__new').hidden = true;
  hero.classList.remove('is-chatting', 'is-convo');
  if (!pick) {
    $('#heroEyebrow').innerHTML = '<i class="pulse"></i>Stagwell AI · Agentic solutions grounded in real-world marketing expertise';
    $('#hero2Title').innerHTML = 'What do you need help <span class="accent">solving today?</span>';
    (window.revealLines||blurWords)($('#hero2Title'));
    $('#hero2Sub').textContent = 'Tell the agent what you\u2019re trying to do \u2014 or just paste your website \u2014 and it will point you to the right solution, with a live snapshot of your brand to show for it.';
  }
  promptInput.value = ''; promptInput.placeholder = SCRIPT[0].placeholder;
  prompt.classList.remove('is-ready');
  scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
  if (!pick) setTimeout(focusPrompt, 420);
}
$('#navNew').addEventListener('click', resetB);
document.addEventListener('click', e => { if (e.target.closest('[data-new]')) resetB(); });

/* ─────────────────────────── KIT CONVERSATION HANDOFF ───────────────────────────
   machine/convo.js drives S3's qualification chat; once SAIFLOW reaches
   phase 'done' with a company_domain, it calls this to run the existing
   website → profile → build machinery so the dashboard "wow" still happens.
   Interim handoff — Sprint 3 replaces this with the kit's own snapshot
   reveal (S4) instead of reusing this SCRIPT's later questions. It works
   while the convo UI is still on screen: submit() takes the thread over
   exactly as it does when a domain is typed straight into the box. */
window.startDashboard = domain => {
  const d = String(domain || '').trim();
  if (!d) return;
  if (S.busy) { pending = d; return; }
  submit(d);
};
window.resetLanding = resetB;

/* ─────────────────────────── NAV / MODAL ─────────────────────────── */

/* The header stays put.

   It used to hide on the way down and come back on the way up. Two rounds of
   bugs came out of that. First it could be stranded off-screen: distance was
   accumulated in BOTH directions, and because browsers coalesce scroll events
   a gesture arrives as a few large deltas with sub-pixel jitter between them,
   so every sign flip reset the upward accumulator before it reached its
   threshold. Then, once that was fixed, it slid away the moment the hero
   stopped being behind it — which is exactly where the chat begins, so the
   header vanished at the point you were reaching for it.

   A header that leaves while you are still reading the first screen is worse
   than one that simply stays, and nothing at the top of this page needs the
   sixty pixels back. Only its background changes now: transparent at rest,
   frosted while there is artwork behind it, solid past the hero. */
(() => {
  const nav = $('#nav');
  let ticking = false;

  const onScroll = () => {
    ticking = false;
    nav.classList.toggle('is-stuck', Math.max(0, scrollY) > 8);
    nav.classList.remove('is-up');   // nothing sets it; this is the belt
  };

  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true; requestAnimationFrame(onScroll);
  }, { passive: true });
  onScroll();
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
  session:   ['Book a strategy session','Sixty minutes with the strategists behind Stagwell AI. We arrive with your dashboard already open.'],
  expert:    ['Talk to an AI expert','A working conversation about the problem you’re facing — and which products in the Stagwell AI suite solve it.'],
  workspace: ['Request your full AI workspace','The whole Stagwell AI suite, pointed at your brand and running continuously. We provision in five working days.'],
  possible:  ['See every product','Every solution in the Marketing Cloud, grouped by the problem it solves.'],
  pdf:       ['Export this dashboard','We will send the full analysis as a designed PDF, plus the raw engine outputs.'],
  callback:  ['Stagwell AI will call you','A NewVoices agent will call within two minutes, already briefed on what you told the agent.'],
};

/* The lead form now lives in machine/lead.js — one modal for "/", /p/{id} and
   /ads, so "Talk to an AI expert" collects the same three fields wherever it
   is clicked. This stays the entry point (the delegated [data-cta] handler
   below is unchanged); everything under the SAILEAD branch is the inline
   original, kept only as the fallback for lead.js failing to load. The
   prefill hands over exactly what this file used to fill in by itself. */
function openModal(kind, fromForm) {
  if (window.SAILEAD && typeof window.SAILEAD.open === 'function') {
    /* a number typed into the inline "let Stagwell AI call you" field rides
       into the modal instead of being asked for twice (QA, Sep 2) */
    const tel = fromForm && fromForm.querySelector ? fromForm.querySelector('input[type="tel"], input[name="phone"]') : null;
    const phone = tel && tel.value ? String(tel.value).trim() : '';
    window.SAILEAD.open(kind, { name: S.who || '', brand: S.brand || '', phone });
    return;
  }
  const [t, p] = CTA_COPY[kind] || CTA_COPY.expert;
  modalBody.innerHTML = `
    <div class="modal__brand"><svg><use href="#sw-logo"/></svg></div>
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
        <h3>Stagwell AI has your brief.</h3>
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
  if (e.target.matches('form[data-cta]')) { e.preventDefault(); openModal(e.target.dataset.cta, e.target); }
});

/* ─────────────────────────── STATIC ─────────────────────────── */

/* 'See every product' goes to /products — the client, pointing at this
   card: "instead of a sidebar with the companies, i want to see a dedicated
   page that showcases all the companies." The card is a real link now; this
   handler only remains for any older [data-dir] markup still in the wild. */
document.addEventListener('click', e => {
  const d = e.target.closest('[data-dir]');
  if (!d) return;
  e.preventDefault();
  location.href = '/next-v1/products';
});

/* the landing chips render from data/questions.json q1.chips (SPEC S1 —
   the client tunes them with a data edit, no code change), falling back
   to the static markup if the data file fails to load. Rendering from
   the JSON also keeps the labels byte-identical to what the flow's chip
   matcher expects, apostrophes included. */
if (window.STAGDATA) window.STAGDATA.then(d => {
  const chips = d && d.questions && d.questions.questions
    && (d.questions.questions.find(q => q.id === 'q1') || {}).chips;
  const wrap = $('#solveChips');
  if (!wrap || !Array.isArray(chips) || !chips.length) return;
  wrap.innerHTML = chips.map(c =>
    `<button type="button" data-solve="${esc(c.domain || '')}">${esc(c.label)}</button>`).join('');
});

/* the four solution chips pre-fill the one prompt box (wireframe W1) —
   the conversation engine takes it from there once Sprint 2 lands */
document.addEventListener('click', e => {
  const c = e.target.closest('[data-solve]');
  if (!c) return;
  const label = c.textContent.trim();
  const already = promptInput.value.trim() === label;
  promptInput.value = label;
  prompt.classList.add('is-ready');
  promptInput.focus();
  /* the box already carries this chip's text — a second tap on it is asking
     to go, same as pressing "Ask the agent" */
  if (already) {
    if (promptForm.requestSubmit) promptForm.requestSubmit();
    else promptForm.dispatchEvent(new Event('submit', { cancelable: true }));
  }
});

/* Two rows drifting in opposite directions, each doubled so the loop is seamless. */
const mCell = ([k, n]) => `<div class="mcell" title="${n}"><img src="${partnerSrc(k)}" alt="${n}"
  loading="lazy" style="--s:${LOGO_SCALE[k] || 1}"></div>`;
const row = PARTNERS.map(mCell).join('');
/* the landing's news sections are gone, so these hosts may not exist —
   the dashboard's own research panel builds its list inline */
const mq = $('#marquee');
if (mq) mq.innerHTML = `<div class="mrow">${row}${row}</div>`;   // doubled → -50% loops seamlessly
const st = $('#studies');
if (st) st.innerHTML = STUDIES.map(s =>
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
    S.email = params.get('email') || '';
    S.rel = params.get('rel') || 'owner';
    if (S.rel === 'rival' && params.get('vs')) {
      S.rivalProfile = readWebsite(params.get('vs')); S.viewerProfile = p;
      S.comps = [S.rivalProfile.name, ...p.peers].slice(0, 3);
    }
    S.mode = modeFor(S);
    const f = (params.get('focus') || 'ai').split(',').map(x => x.trim()).filter(k => FOCUS[k]);
    S.focus = f.length ? f.slice(0, 2) : ['ai'];
    S.focusLead = FOCUS[S.focus[0]].lead;
    S.query = params.get('q') || '';
    S.windowLabel = params.get('window') || '';
    Object.assign(S, numbersFor(S.domain, S.brand));
    S.step = SCRIPT.length; S.done = true;
    buildDashboard();
    $('#hero2Title').innerHTML = `Here is <span class="accent">${esc(S.brand)}.</span>`;
    (window.revealLines||blurWords)($('#hero2Title'), 120);
    if ($('#chatHint')) $('#chatHint').hidden = true;
    $('#solveChips').hidden = true;
    $('#navNew').hidden = false;
    $('.mnav__new').hidden = false;
    return;
  }
  (window.revealLines||blurWords)($('#hero2Title'), 120);
  focusPrompt();
})();

})();
