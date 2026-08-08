/* ═══════════════════════════════════════════════════════════════════════════
   STAGWELL AI — VERSION E · the agent

   One sentence in, a finished campaign out — the run is scripted theatre.
   Two exceptions: when window.ELIVE (built in e-live.js) can reach a real
   model within its own budget, the "how AI answers rank you" step and the
   findings card go live and carry a badge naming the model + latency.
   Everything else stays an enactment — no badge, no "unscripted" copy.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const { esc, reveal, whenVisible } = window.SWAI;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
/* Only a real pointer gets auto-focus. On touch, focus() summons the keyboard
   unasked and covers the very field it just focused (see machine/b.js). */
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;

/* ══════════════════════ THE PLAN ══════════════════════ */

const NEWINTEL = 0, NEWINDEX = 1, IMAI = 2, DOREEL = 3, RESEARCH = 4, NEWVOICES = 5;

const STEPS = [
  { ws: 'newintel', tag: 'NewIntel', title: 'Analysing competitor signals',
    subs: ['Reading pricing pages…', 'Scanning hiring feeds…', 'Cross-referencing earned coverage…'],
    doneTitle: n => `Analysed ${n.signals.toLocaleString()} competitor signals`,
    count: n => [0, n.signals, ' signals'] },
  { ws: 'newindex', tag: 'NewIndex', title: 'Testing how AI answers rank you',
    subs: ['Asking the money question eight ways…', 'Scoring who gets named first…'],
    doneTitle: n => `Found you rank ${n.rankWord} in ChatGPT answers` },
  { ws: 'imai', tag: 'InfluencerMarketing.ai', title: 'Shortlisting creators',
    subs: ['Filtering 400M profiles…', 'Checking brand safety…', 'Ranking by audience overlap…'],
    doneTitle: n => `Shortlisted ${n.creators} creators from 400M profiles`,
    count: n => [400, n.creators, ' creators'] },
  { ws: 'doreel', tag: 'DoReel', title: 'Generating video ads',
    subs: ['Writing scripts from the findings…', 'Rendering presenter variants…'],
    doneTitle: n => `Generated ${n.ads} video ads`,
    count: n => [0, n.ads, ' ads'] },
  { ws: 'research', tag: 'Activation', title: 'Launching the campaign',
    subs: ['Building audiences…', 'Setting pacing…', 'Going live…'],
    doneTitle: () => 'Launched campaign across Meta and TikTok' },
  { ws: 'newvoices', tag: 'NewVoices', title: 'Standing up the voice agent',
    subs: ['Briefing it on the campaign…', 'Connecting the number…'],
    doneTitle: () => 'Voice agent live, answering inbound calls' },
];

/* ── Intent engine ─────────────────────────────────────────────
   Each profile is an ordered list of indexes into STEPS. Order matters,
   omissions are skips — the plan only renders the profile's steps. */
const PROFILES = {
  share:    [NEWINTEL, NEWINDEX, IMAI, DOREEL, RESEARCH, NEWVOICES],
  ai:       [NEWINDEX, NEWINTEL, IMAI, DOREEL, RESEARCH],
  creators: [IMAI, DOREEL, RESEARCH, NEWVOICES],
  voice:    [NEWVOICES, NEWINTEL, NEWINDEX, IMAI, RESEARCH],
};

const INTENT_RULES = [
  { profile: 'ai',       kws: ['ai answers', 'chatgpt', 'named', 'visibility', 'rank'] },
  { profile: 'creators', kws: ['creator', 'influencer', 'campaign', 'launch', 'drop'] },
  { profile: 'voice',    kws: ['calls', 'customers', 'voice', 'phones', 'book'] },
  { profile: 'share',    kws: ['share', 'losing', 'rival', 'competitor', 'market'] },
];

function classifyIntent(sentence) {
  const s = sentence.toLowerCase();
  for (const { profile, kws } of INTENT_RULES) {
    if (kws.some(k => s.includes(k))) return profile;
  }
  return 'share';
}

/* the visitor's key phrase — first six words, cleaned up at the edges —
   echoed back in the first step's second sub-line */
function keyPhrase(sentence) {
  const words = sentence.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  return words.join(' ').replace(/^[“"'\s]+/, '').replace(/[.,;:!?"'”\s]+$/, '');
}

/* deterministic seed: same sentence → same numbers, always */
const ORDINALS = ['2nd', '3rd', '4th', '5th', '6th'];

function hashSentence(sentence) {
  let h = 0;
  for (let i = 0; i < sentence.length; i++) h = ((h * 31 + sentence.charCodeAt(i)) >>> 0);
  return h;
}

function seedFor(sentence) {
  const h = hashSentence(sentence);
  const signals = 900 + (h % 701);                          // 900–1,600
  const rankIdx = Math.floor(h / 7) % 5;                     // 0–4 → 2nd–6th
  const creators = 12 + (Math.floor(h / 97) % 13);           // 12–24
  const ads = 4 + (Math.floor(h / 977) % 5);                 // 4–8
  return { h, signals, rankIdx, rankWord: ORDINALS[rankIdx], creators, ads };
}

const PLACEHOLDER = 'Find out why we’re losing share to our top competitor, then fix it.';

/* ══════════════════════ DOM ══════════════════════ */

const form   = $('#promptForm');
const input  = $('#promptInput');
const send   = $('#promptSend');
const chips  = $('#chips');
const hero   = $('#ehero');
const erun   = $('#erun');
const edone  = $('#edone');

const railRow = ws => $(`.rail__item.erail[data-ws="${ws}"]`);
const litRows = () => $$('.rail__item.erail.is-live');

let running = false;
let hurried = false;
/* Set when a run starts. The click (or Enter) that STARTED the run bubbles
   up to the hurry listeners after startRun has already flagged the run as
   in progress — without a settle window, every mouse-started run would
   fast-forward itself instantly. */
let runStartedAt = 0;
const SETTLE = 800;

/* the fast-forward flag folds every remaining wait down to almost nothing */
const tick = ms => wait(hurried ? Math.min(ms, 60) : ms);

/* ══════════════════════ CHIPS ══════════════════════ */

/* clicking a chip fills the input and runs it immediately, through the
   same submit path the form itself uses (trim/placeholder fallback included) */
$$('.chip[data-fill]', chips).forEach(c => c.addEventListener('click', () => {
  input.value = c.dataset.fill;
  if (form?.requestSubmit) form.requestSubmit();
  else startRun(input.value.trim() || PLACEHOLDER);
}));

/* ══════════════════════ RUN RENDER ══════════════════════ */

function stepMarkup(step) {
  return `<li class="estep" data-state="pending">
    <span class="estep__mark"></span>
    <span class="estep__t"><b>${esc(step.title)}</b><i></i></span>
    <span class="estep__ws">${esc(step.tag)}</span></li>`;
}

function renderPlan(sentence, steps) {
  erun.innerHTML = `<div class="eplan">
    <p class="eplan__q">“${esc(sentence)}”</p>
    <p class="eplan__meta" id="eplanMeta"><i class="spin"></i>Planning across ${steps.length} workspaces…</p>
    <ol class="esteps">${steps.map(stepMarkup).join('')}</ol>
    <p class="eplan__done" id="eplanDone" hidden>Completed in 4 minutes · No dashboards opened</p>
  </div>`;
  erun.hidden = false;
}

const CHECK = `<svg viewBox="0 0 14 14" width="10" height="10"><path d="M2.5 7.4l3 3 6-6.6"
  stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

async function runCount(el, [from, to, suffix], ms) {
  const start = performance.now();
  const dur = hurried ? Math.min(ms, 60) : ms;
  return new Promise(resolve => {
    const frame = now => {
      const p = Math.min(1, (now - start) / dur);
      const v = Math.round(from + (to - from) * p);
      el.textContent = `${v.toLocaleString()}${suffix}`;
      if (p < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

/* opts.echo: the key-phrase line inserted as this step's second sub-line
   opts.onTheatreDone: async () => null | { doneTitle, html } — run right
   after the theatre finishes and before the step is marked done, so a
   live surface (e.g. the NewIndex answer card) can override the scripted
   done-title and append markup into this step's <li>. */
async function runStep(step, i, li, seed, opts = {}) {
  li.dataset.state = 'running';
  const row = railRow(step.ws);
  row?.classList.add('is-live');
  const sub = $('.estep__t i', li);

  /* paced to be read, not skimmed — a click fast-forwards for the presenter
     who has seen it before */
  const total = REDUCED ? 200 : 5200 + i * 250;
  let subs = step.subs;
  if (opts.echo) subs = [subs[0], `Focusing on: “${opts.echo}…”`, ...subs.slice(1)];
  const beatMs = Math.max(REDUCED ? 40 : 600, Math.floor(total / subs.length));

  for (let s = 0; s < subs.length - 1; s++) {
    sub.textContent = subs[s];
    await tick(REDUCED ? 80 : Math.min(1700, beatMs));
  }
  /* the final beat: for steps with a count, the count-up plays alongside
     the last sub — it replaces the text as the running total climbs */
  if (step.count) {
    await runCount(sub, step.count(seed), REDUCED ? 200 : Math.max(1100, beatMs));
  } else {
    sub.textContent = subs[subs.length - 1];
    await tick(REDUCED ? 80 : Math.min(1700, beatMs));
  }

  let doneTitle = step.doneTitle(seed);
  let extraHTML = '';
  if (opts.onTheatreDone) {
    const r = await opts.onTheatreDone();
    if (r) {
      doneTitle = r.doneTitle;
      extraHTML = r.html || '';
    }
  }

  li.dataset.state = 'done';
  $('.estep__mark', li).innerHTML = CHECK;
  $('.estep__t b', li).textContent = doneTitle;
  sub.textContent = '';
  if (extraHTML) li.insertAdjacentHTML('beforeend', extraHTML);
  row?.classList.remove('is-live');
}

/* ══════════════════════ RESULTS RENDER ══════════════════════ */

function renderDone(seed, findingsLive) {
  const scriptedRows = [
    { lead: 'They cut price where it hurts.',
      detail: 'Their hero SKU undercut yours by 4% in May — your consideration dipped within two weeks.' },
    { lead: 'They own the question.',
      detail: `Asked the money question, the models name them first. You rank ${seed.rankWord} in ChatGPT answers.` },
    { lead: 'Their creators outspend yours 2:1.',
      detail: 'And earned coverage follows the creators.' },
  ];

  const hasLive = findingsLive && Array.isArray(findingsLive.rows) && findingsLive.rows.length > 0;
  const rows = hasLive ? findingsLive.rows : scriptedRows;
  const rowsHTML = rows.map(r =>
    `<p class="ecard__row"><b>${esc(r.lead)}</b><em>${esc(r.detail)}</em></p>`
  ).join('');
  const findingsMeta = hasLive
    ? `<p class="ecard__meta"><i class="pulse"></i>written for this run by ${esc(findingsLive.model)} · ${findingsLive.ms}ms · unscripted</p>`
    : '';

  const creatorsTotal = seed.creators;
  const creatorsMore = creatorsTotal - 3;
  const adsTotal = seed.ads;
  const stubClasses = ['ead--s1', 'ead--s2', 'ead--s3', 'ead--s4', 'ead--s5', 'ead--s6'];
  const stubCount = Math.max(0, adsTotal - 2);
  const stubsHTML = Array.from({ length: stubCount }, (_, i) =>
    `<span class="ead ead--stub ${stubClasses[i % stubClasses.length]}"></span>`
  ).join('');

  edone.innerHTML = `<div class="ekit">
    <p class="ekit__k">The finished campaign</p>
    <div class="ekit__grid">
      <article class="ecard ecard--findings"><h4>Why you’re losing share</h4>
        ${rowsHTML}${findingsMeta}</article>
      <article class="ecard ecard--creators"><h4>${creatorsTotal} creators, shortlisted</h4>
        <div class="ecard__avatars"><span class="eavatar">MK</span><span class="eavatar">DT</span><span class="eavatar">AS</span><span class="eavatar eavatar--more">+${creatorsMore}</span></div>
        <p class="ecard__sub">Vetted, on-audience, ranked by overlap with the buyers you’re losing.</p></article>
      <article class="ecard ecard--ads"><h4>${adsTotal} video ads, generated</h4>
        <div class="eads">
          <span class="ead"><video src="./assets/img/doreel.mp4" autoplay muted loop playsinline></video></span>
          <span class="ead"><video src="./assets/img/imai.mp4" autoplay muted loop playsinline></video></span>
          ${stubsHTML}
        </div>
        <p class="ecard__sub">Presenter and UGC variants, written from the findings above.</p></article>
      <article class="ecard ecard--campaign"><h4>Campaign, live</h4>
        <p class="ecard__chips"><span class="echip">Meta</span><span class="echip">TikTok</span></p>
        <p class="ecard__sub">Pacing $1.8k a day against the audiences the shortlist reaches. The winning variant promotes itself.</p></article>
      <article class="ecard ecard--voice"><h4>Voice agent, on the phones</h4>
        <p class="ecard__quote">“Booked you in for Tuesday at 2pm — you’ll get a calendar invite in a second.”</p>
        <p class="ecard__sub"><em class="edot"></em>Answering inbound from the campaign, briefed on everything above.</p></article>
    </div>
    <div class="ekit__acts">
      <button class="btn btn--dark" type="button" data-act="reset">Run another sentence</button>
      <a class="btn" href="./d.html">See the platform</a>
    </div>
  </div>`;
  edone.hidden = false;
}

/* ══════════════════════ THE RUN ══════════════════════ */

function hideHero() {
  hero?.classList.add('is-gone');
  chips?.classList.add('is-gone');
  setTimeout(() => {
    if (hero) hero.hidden = true;
    if (chips) chips.hidden = true;
  }, 400);
}

function showHero() {
  if (hero) { hero.hidden = false; hero.classList.remove('is-gone'); }
  if (chips) { chips.hidden = false; chips.classList.remove('is-gone'); }
}

async function startRun(sentence) {
  if (running) return;
  running = true;
  runStartedAt = performance.now();
  hurried = false;

  /* window.ELIVE is a layer built in e-live.js — it may not be loaded at
     all. Every use below is guarded; when it's undefined the whole run
     behaves exactly like the scripted original, plus intent/seeding. */
  const L = window.ELIVE;
  const seed = seedFor(sentence);
  const profileKey = classifyIntent(sentence);
  const indices = PROFILES[profileKey] || PROFILES.share;
  const steps = indices.map(i => STEPS[i]);

  /* kick both live calls off immediately — they run alongside the theatre
     and are only consulted when the relevant step/moment arrives. The answer
     call only fires when this profile actually runs the NewIndex step:
     nothing would ever render it otherwise, and the endpoint is unmetered. */
  const asksModel = indices.includes(NEWINDEX);
  const question = L && asksModel ? L.deriveQuestion(sentence) : null;
  const qLive = L && asksModel ? L.ask(question) : Promise.resolve(null);
  const fLive = L ? L.findings(sentence) : Promise.resolve(null);

  hideHero();
  input.disabled = true;
  send.disabled = true;

  renderPlan(sentence, steps);

  await tick(REDUCED ? 120 : 2000);
  const meta = $('#eplanMeta');
  if (meta) meta.textContent = 'Working — the agent moves between workspaces as each step needs it.';

  const lis = $$('.estep', erun);
  const phrase = keyPhrase(sentence);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const isNewIndex = step.ws === 'newindex';
    /* a breath between steps, so each check lands before the next spinner */
    if (i) await tick(REDUCED ? 40 : 650);
    await runStep(step, i, lis[i], seed, {
      echo: i === 0 ? phrase : null,
      onTheatreDone: isNewIndex ? async () => {
        const graceMs = hurried ? 800 : 6000;
        const r = await Promise.race([qLive, wait(graceMs).then(() => null)]);
        if (!r) return null;
        return {
          doneTitle: 'Asked a real model how you rank',
          html: `<div class="elive"><p class="elive__q">Asked, verbatim: “${esc(question)}”</p>`
              + `<p class="elive__a">“${esc(r.answer)}”</p>`
              + `<p class="elive__meta"><i class="pulse"></i>${esc(r.model)} · answered live in ${r.ms}ms · unscripted</p></div>`,
        };
      } : null,
    });
  }

  const doneMsg = $('#eplanDone');
  if (doneMsg) doneMsg.hidden = false;

  input.disabled = false;
  send.disabled = false;
  input.value = '';
  input.placeholder = 'Run another sentence…';

  /* let the completion line land before the campaign takes over */
  await tick(REDUCED ? 60 : 1400);

  const fGraceMs = hurried ? 500 : 5000;
  const findingsLive = await Promise.race([fLive, wait(fGraceMs).then(() => null)]);

  renderDone(seed, findingsLive);
  edone.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });

  running = false;
}

/* fast-forward: any click outside the switcher/links, or Enter, while a
   run is in progress hurries every remaining wait down to almost nothing */
document.addEventListener('click', e => {
  if (!running || hurried) return;
  if (performance.now() - runStartedAt < SETTLE) return;
  if (e.target.closest('.ab') || e.target.closest('a')) return;
  if (e.target.closest('#promptForm') || e.target.closest('.chips')) return;
  hurried = true;
});
document.addEventListener('keydown', e => {
  if (!running || hurried) return;
  if (performance.now() - runStartedAt < SETTLE) return;
  if (e.target === input) return;
  if (e.key === 'Enter') hurried = true;
});

/* ══════════════════════ SUBMIT / RESET ══════════════════════ */

/* The stylesheet ships the send button dark-but-dead (opacity .22,
   pointer-events none) until the form carries is-ready — the Workspace
   toggles it as you type. Here an empty submit runs the placeholder
   sentence, so the button is always meaningful and stays lit. */
form?.classList.add('is-ready');

form?.addEventListener('submit', e => {
  e.preventDefault();
  const sentence = input.value.trim() || PLACEHOLDER;
  startRun(sentence);
});

function resetAll() {
  erun.innerHTML = '';
  erun.hidden = true;
  edone.innerHTML = '';
  edone.hidden = true;
  showHero();
  input.disabled = false;
  input.value = '';
  input.placeholder = PLACEHOLDER;
  litRows().forEach(r => r.classList.remove('is-live'));
  running = false;
  hurried = false;
  scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
}

$('#newRun')?.addEventListener('click', resetAll);
document.addEventListener('click', e => {
  if (e.target.closest('[data-act="reset"]')) resetAll();
});

/* ══════════════════════ MOTION ══════════════════════ */

reveal($$('.r'));

addEventListener('load', async () => {
  await wait(REDUCED ? 40 : 560);
  document.body.dataset.state = 'ready';
  $('#boot')?.classList.add('is-out');
  setTimeout(() => $('#boot')?.remove(), 700);

  /* invite the visitor in — but only where focus won't summon a keyboard
     over the very field it just focused */
  if (FINE) input.focus({ preventScroll: true });

  /* deep link: run=<sentence> starts the run automatically, boot skipped
     to a minimum wait but pacing left un-hurried */
  const params = new URLSearchParams(location.search);
  if (params.has('run')) {
    const sentence = params.get('run').trim() || PLACEHOLDER;
    startRun(sentence);
  }
});

})();
