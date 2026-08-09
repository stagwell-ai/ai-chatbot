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
    subs: ['Reading Hoka and On’s pricing pages…', 'Scanning Adidas hiring feeds…', 'Cross-referencing earned coverage…'],
    doneTitle: n => `Analysed ${n.signals.toLocaleString()} competitor signals`,
    count: n => [0, n.signals, ' signals'] },
  { ws: 'newindex', tag: 'NewIndex', title: 'Testing how AI answers rank you',
    subs: ['Asking the money question eight ways…', 'Scoring who gets named first…'],
    doneTitle: n => `Found Nike ranks ${n.rankWord} when buyers ask` },
  { ws: 'imai', tag: 'InfluencerMarketing.ai', title: 'Shortlisting creators',
    subs: ['Filtering 400M profiles…', 'Checking brand safety…', 'Ranking by audience overlap…'],
    doneTitle: n => `Shortlisted ${n.creators} creators from 400M profiles`,
    count: n => [400, n.creators, ' creators'] },
  { ws: 'doreel', tag: 'DoReel', title: 'Generating video ads',
    subs: ['Writing scripts from the findings…', 'Rendering presenter variants…'],
    doneTitle: n => `Generated ${n.ads} Pegasus spot variants`,
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
  /* the two audience-overlap figures the creator workspace shows — same
     seed, so the shortlist reads identically every time that sentence runs */
  const overlapA = 58 + (Math.floor(h / 13) % 22);           // 58–79
  const overlapB = 31 + (Math.floor(h / 211) % 18);          // 31–48
  return { h, signals, rankIdx, rankWord: ORDINALS[rankIdx], creators, ads, overlapA, overlapB };
}

/* byte-identical to the placeholder attribute on #promptInput in e.html —
   an empty submit runs this sentence, so the two must never drift */
const PLACEHOLDER = 'Win back running-shoe share from Hoka this quarter.';

/* the drop-zone manifest: assets/img/nike/README.md describes the four slots.
   The files may or may not be there at runtime — a tile whose clip fails to
   load swaps itself back to the gradient stub it would otherwise have been. */
const NIKE_CLIPS = [
  './assets/img/nike/ad-1.mp4',
  './assets/img/nike/ad-2.mp4',
  './assets/img/nike/ad-3.mp4',
  './assets/img/nike/ad-4.mp4',
];

/* ══════════════════════ DOM ══════════════════════ */

const form   = $('#promptForm');
const input  = $('#promptInput');
const send   = $('#promptSend');
const chips  = $('#chips');
const hero   = $('#ehero');
const erun   = $('#erun');
const edone  = $('#edone');

const sheet     = $('#esheet');
const sheetBody = $('#esheetBody');

const railRow  = ws => $(`.rail__item.erail[data-ws="${ws}"]`);
const railRows = () => $$('.rail__item.erail');
const litRows  = () => $$('.rail__item.erail.is-live');

/* ══════════════════════ WHAT THE LAST RUN LEFT ══════════════════════
   The single record of the run just performed. The workspace sheet is
   rendered from this and nothing else, on every open — so what a
   workspace shows can never drift from what the run actually did.
   Empty here means empty there. */
const LAST = {
  seed: null,          // the seeded numbers — null until the first run
  sentence: '',
  indices: null,       // the profile's step indexes; anything not in it was skipped
  done: false,
  runningWs: null,     // the workspace the agent is inside right now
  doneWs: [],          // workspaces whose step has already finished this run
  liveAnswer: null,    // { question, answer, model, ms } — only when a model really answered
  liveFindings: null,  // { rows, model, ms } — ditto
};

function resetLast() {
  LAST.seed = null;
  LAST.sentence = '';
  LAST.indices = null;
  LAST.done = false;
  LAST.runningWs = null;
  LAST.doneWs = [];
  LAST.liveAnswer = null;
  LAST.liveFindings = null;
}

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
  /* a long sentence set at hero size wraps to four lines and pushes the plan
     off the fold — past ~90 characters it drops to the smaller cut */
  const qClass = sentence.length > 90 ? 'eplan__q eplan__q--long' : 'eplan__q';
  erun.innerHTML = `<div class="eplan">
    <p class="${qClass}">“${esc(sentence)}”</p>
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
      const t = Math.min(1, (now - start) / dur);
      /* eased out: the number leaps away and settles onto its landing figure,
         rather than arriving at a constant machine pace */
      const p = 1 - Math.pow(1 - t, 3);
      const v = Math.round(from + (to - from) * p);
      el.textContent = `${v.toLocaleString()}${suffix}`;
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

/* ── The sub-line swap ────────────────────────────────────────
   A step's second line changes three or four times as the step runs.
   Snapping the text reads as a glitch; .is-swap fades it out, the text is
   written while it is invisible, and removing the class fades it back.
   Deliberately not awaited: the fade overlaps the beat that follows, so
   the run's pacing is exactly what it was before the crossfade existed.
   Reduced motion and a hurried run both write the text outright. */
const SWAP_MS = 240;
function swapSub(el, text, stale) {
  if (!el) return;
  if (REDUCED || hurried) { el.textContent = text; return; }
  el.classList.add('is-swap');
  setTimeout(() => {
    if (stale && stale()) return;
    el.textContent = text;
    el.classList.remove('is-swap');
  }, SWAP_MS);
}

/* ── The elapsed clock ────────────────────────────────────────
   Sits at the right edge of the plan header and counts while the agent
   works. It stops at the finish with the final time left on screen — the
   run took what it took — and is cleared whenever the plan is torn down. */
let timerId = 0;
let timerFrom = 0;

const clockText = ms => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function startTimer() {
  stopTimer();
  const meta = $('#eplanMeta');
  if (!meta) return;
  /* renderPlan rewrites #erun wholesale, so a stale node can't survive —
     but a second call within one run must not print a second clock */
  if (!$('#etimer')) meta.insertAdjacentHTML('beforeend', '<span class="etimer" id="etimer">0:00</span>');
  timerFrom = performance.now();
  timerId = setInterval(() => {
    const el = $('#etimer');
    if (!el) { stopTimer(); return; }
    el.textContent = clockText(performance.now() - timerFrom);
  }, 1000);
}

function stopTimer() {
  if (!timerId) return;
  clearInterval(timerId);
  timerId = 0;
  /* the last interval can be up to a second behind the finish — land the
     real figure rather than whichever second happened to tick last */
  const el = $('#etimer');
  if (el) el.textContent = clockText(performance.now() - timerFrom);
}

/* opts.echo: the key-phrase line inserted as this step's second sub-line
   opts.isStale: () => boolean — true once this run has been superseded (see
   the generation token in startRun). Checked after every await, before any
   write: a run the visitor has cleared away must not finish in the dark and
   deposit its step onto the screen that replaced it.
   opts.onTheatreDone: async () => null | { doneTitle, html } — run right
   after the theatre finishes and before the step is marked done, so a
   live surface (e.g. the NewIndex answer card) can override the scripted
   done-title and append markup into this step's <li>. */
async function runStep(step, i, li, seed, opts = {}) {
  const stale = opts.isStale || (() => false);
  if (stale() || !li) return;

  li.dataset.state = 'running';
  const row = railRow(step.ws);
  row?.classList.add('is-live');
  LAST.runningWs = step.ws;
  const sub = $('.estep__t i', li);

  /* paced to be read, not skimmed — a click fast-forwards for the presenter
     who has seen it before */
  const total = REDUCED ? 200 : 5200 + i * 250;
  let subs = step.subs;
  if (opts.echo) subs = [subs[0], `Focusing on: “${opts.echo}…”`, ...subs.slice(1)];
  const beatMs = Math.max(REDUCED ? 40 : 600, Math.floor(total / subs.length));

  for (let s = 0; s < subs.length - 1; s++) {
    swapSub(sub, subs[s], stale);
    await tick(REDUCED ? 80 : Math.min(1700, beatMs));
    if (stale()) return;
  }
  /* the final beat: for steps with a count, the count-up plays alongside
     the last sub — it replaces the text as the running total climbs */
  if (step.count) {
    await runCount(sub, step.count(seed), REDUCED ? 200 : Math.max(1100, beatMs));
    if (stale()) return;
  } else {
    swapSub(sub, subs[subs.length - 1], stale);
    await tick(REDUCED ? 80 : Math.min(1700, beatMs));
    if (stale()) return;
  }

  let doneTitle = step.doneTitle(seed);
  let extraHTML = '';
  if (opts.onTheatreDone) {
    const r = await opts.onTheatreDone();
    if (stale()) return;
    if (r) {
      doneTitle = r.doneTitle;
      extraHTML = r.html || '';
    }
  }

  li.dataset.state = 'done';
  $('.estep__mark', li).innerHTML = CHECK;
  $('.estep__t b', li).textContent = doneTitle;
  swapSub(sub, '', stale);
  if (extraHTML) li.insertAdjacentHTML('beforeend', extraHTML);
  row?.classList.remove('is-live');
  /* the agent has left the room: the workspace now holds artefacts */
  LAST.runningWs = null;
  if (!LAST.doneWs.includes(step.ws)) LAST.doneWs.push(step.ws);
}

/* ══════════════════════ RESULTS RENDER ══════════════════════
   Each artefact has exactly one renderer. The results card and the
   workspace sheet both call these, so a workspace can never show a
   different version of the thing the run produced. */

function scriptedFindings(seed) {
  return [
    { lead: 'Hoka cut price where it hurts.',
      detail: 'Their daily-trainer undercut the Pegasus by 4% in May — consideration dipped within two weeks.' },
    { lead: 'They own the question.',
      detail: `Asked for the best running shoes, the models name Hoka and Brooks first. Nike ranks ${seed.rankWord}.` },
    { lead: 'Their creators outspend yours 2:1.',
      detail: 'And earned coverage follows the creators.' },
  ];
}

const hasLiveRows = f => !!(f && Array.isArray(f.rows) && f.rows.length > 0);

function findingsRowsHTML(rows) {
  return rows.map(r =>
    `<p class="ecard__row"><b>${esc(r.lead)}</b><em>${esc(r.detail)}</em></p>`
  ).join('');
}

/* ── The two badge lines ──────────────────────────────────────
   These are the only two places the word "unscripted" is written, and
   both take a live result as their argument — there is no way to reach
   either one from a scripted path. Every caller (the run's NewIndex step,
   the run's findings card, and the two sheets that re-show a stored live
   result) hands over an object that came back from a real model. */
/* ── The audit row ────────────────────────────────────────────
   Which of the six brands the model actually put in its answer — the
   whole point of asking brand-blind. Reachable only from liveAnswerHTML,
   so like the badge it can never appear under a scripted answer.
   Every name is a string that came back over the wire: esc'd on the way
   in, and the favicon URL is built from it rather than interpolated raw. */
function auditHTML(named) {
  const P = window.ELIVE?.PERSONA;
  if (!P) return '';
  const mark = window.ELIVE?.markURL;
  const list = Array.isArray(named) ? named : [];
  const hit = b => list.some(n => String(n).trim().toLowerCase() === b.toLowerCase());

  /* the mark is looked up from the brand, never from the chip's label —
     "Nike · absent" is not a domain */
  const chip = (brand, label, cls) => {
    const img = mark ? `<img src="${esc(mark(brand))}" alt="" width="16" height="16">` : '';
    return `<span class="echip--brand${cls}">${img}${esc(label)}</span>`;
  };

  const mine = hit(P.brand);
  /* the rivals the model volunteered, in the persona's own order rather than
     whatever order the answer happened to mention them in */
  const rivals = (P.rivals || []).filter(hit);

  /* nothing named at all is still a finding, and the strongest one — it just
     has no chips to draw, so it is said in the kicker instead */
  if (!rivals.length && !mine) {
    return `<div class="eaudit"><span class="eaudit__k">Named in the answer: none of the six — ${esc(P.brand)} included</span></div>`;
  }

  const chips = rivals.map(b => chip(b, b, '')).join('')
              + (mine
                  ? chip(P.brand, `${P.brand} · named`, ' is-mine')
                  : chip(P.brand, `${P.brand} · absent`, ' is-absent is-mine'));
  return `<div class="eaudit"><span class="eaudit__k">Named in the answer</span>${chips}</div>`;
}

function liveAnswerHTML(live) {
  return `<div class="elive"><p class="elive__q">Asked, verbatim: “${esc(live.question)}”</p>`
       + `<p class="elive__a">“${esc(live.answer)}”</p>`
       + auditHTML(live.named)
       + `<p class="elive__meta"><i class="pulse"></i>${esc(live.model)} · answered live in ${esc(live.ms)}ms · unscripted</p></div>`;
}

function liveFindingsMetaHTML(live) {
  return `<p class="ecard__meta"><i class="pulse"></i>written for this run by ${esc(live.model)} · ${esc(live.ms)}ms · unscripted</p>`;
}

function avatarsHTML(seed) {
  return `<div class="ecard__avatars"><span class="eavatar">MK</span><span class="eavatar">DT</span><span class="eavatar">AS</span>`
       + `<span class="eavatar eavatar--more">+${esc(seed.creators - 3)}</span></div>`;
}

/* two repo clips, then whatever the Nike drop-zone holds, and coloured
   stubs for the rest — the tile grid the ads card shows, reused whole by
   the DoReel sheet. The first tile carries the winning tag.

   Every manifest tile names the stub it would have been, so a clip that
   404s (the drop zone is empty until someone fills it) can be replaced by
   exactly that stub — see the delegated failure handler below. */
const REPO_CLIPS = ['./assets/img/doreel.mp4', './assets/img/imai.mp4'];
const STUB_CLASSES = ['ead--s1', 'ead--s2', 'ead--s3', 'ead--s4', 'ead--s5', 'ead--s6'];
const stubClassFor = k => STUB_CLASSES[(k - REPO_CLIPS.length) % STUB_CLASSES.length];
const WIN_TAG = '<i class="ead__win">winning · +3.2×</i>';
const videoHTML = src => `<video src="${src}" autoplay muted loop playsinline></video>`;

function adsHTML(seed) {
  const tiles = Array.from({ length: Math.max(0, seed.ads) }, (_, k) => {
    const win = k === 0 ? WIN_TAG : '';
    if (k < REPO_CLIPS.length) return `<span class="ead">${videoHTML(REPO_CLIPS[k])}${win}</span>`;
    const clip = NIKE_CLIPS[k - REPO_CLIPS.length];
    const stub = stubClassFor(k);
    if (clip) return `<span class="ead ead--clip" data-stub="${stub}">${videoHTML(clip)}${win}</span>`;
    return `<span class="ead ead--stub ${stub}">${win}</span>`;
  }).join('');
  return `<div class="eads">${tiles}</div>`;
}

/* A drop-zone file that isn't there must leave no trace: the tile becomes
   the gradient stub it would have been if the manifest slot were empty.
   error and stalled don't bubble, so both are caught on the way down. */
function clipFailed(video) {
  const host = video?.closest?.('.ead--clip');
  if (!host || !host.parentElement) return;
  const stub = document.createElement('span');
  stub.className = `ead ead--stub ${host.dataset.stub || STUB_CLASSES[0]}`;
  /* the winning tag belongs to the first tile, not to the clip in it */
  if ($('.ead__win', host)) stub.innerHTML = WIN_TAG;
  host.replaceWith(stub);
}

document.addEventListener('error', e => {
  const t = e.target;
  if (!t || !t.tagName) return;
  if (t.tagName === 'VIDEO') { clipFailed(t); return; }
  /* a favicon that 404s leaves a broken-image glyph in the chip — drop the
     image and let the brand name stand on its own */
  if (t.tagName === 'IMG' && t.parentElement?.classList.contains('echip--brand')) t.remove();
}, true);

document.addEventListener('stalled', e => {
  const t = e.target;
  /* readyState 0 is HAVE_NOTHING: stalled before a single byte of media —
     a mid-playback stall is a slow network, not a missing file */
  if (t && t.tagName === 'VIDEO' && t.readyState === 0) clipFailed(t);
}, true);

const VOICE_QUOTE = '“Booked you in for Tuesday at 2pm — you’ll get a calendar invite in a second.”';

function renderDone(seed, findingsLive) {
  const hasLive = hasLiveRows(findingsLive);
  const rowsHTML = findingsRowsHTML(hasLive ? findingsLive.rows : scriptedFindings(seed));
  const findingsMeta = hasLive ? liveFindingsMetaHTML(findingsLive) : '';

  const creatorsTotal = seed.creators;
  const adsTotal = seed.ads;

  edone.innerHTML = `<div class="ekit">
    <p class="ekit__k">The finished campaign</p>
    <div class="ekit__grid">
      <article class="ecard ecard--findings"><h4>Why Nike is losing share</h4>
        ${rowsHTML}${findingsMeta}</article>
      <article class="ecard ecard--creators"><h4>${creatorsTotal} creators, shortlisted</h4>
        ${avatarsHTML(seed)}
        <p class="ecard__sub">Vetted, on-audience, ranked by overlap with the runners Nike is losing.</p></article>
      <article class="ecard ecard--ads"><h4>${adsTotal} video ads, generated</h4>
        ${adsHTML(seed)}
        <p class="ecard__sub">Presenter and UGC variants, written from the findings above.</p></article>
      <article class="ecard ecard--campaign"><h4>Campaign, live</h4>
        <p class="ecard__chips"><span class="echip">Meta</span><span class="echip">TikTok</span></p>
        <p class="ecard__sub">Pegasus spring push — pacing $1.8k a day against the audiences the shortlist reaches. The winning variant promotes itself.</p></article>
      <article class="ecard ecard--voice"><h4>Voice agent, on the phones</h4>
        <p class="ecard__quote">${VOICE_QUOTE}</p>
        <p class="ecard__sub"><em class="edot"></em>Answering inbound from the campaign, briefed on everything above.</p></article>
    </div>
    <div class="ekit__acts">
      <button class="btn btn--dark" type="button" data-act="reset">Run another sentence</button>
      <a class="btn" href="./d.html">See the platform</a>
    </div>
  </div>`;
  edone.hidden = false;
}

/* ══════════════════════ WORKSPACE PEEK ══════════════════════
   A rail row opens a sheet showing what the agent left in that
   workspace. It is rendered from LAST on every open and never cached,
   so an empty workspace stays empty, a skipped one says so, and a live
   answer is the only thing that ever carries a badge. */

const WS = {
  newintel: {
    name: 'NewIntel · competitor signals',
    /* which sentences bring the agent here — read off INTENT_RULES above */
    uses: 'A sentence about share, rivals or the market sends the agent in here first.',
  },
  newindex: {
    name: 'NewIndex · AI answer visibility',
    skipHead: 'This run didn’t test AI answers.',
    uses: 'A sentence about AI answers, ChatGPT, visibility or where you rank would put the agent in here.',
  },
  imai: {
    name: 'InfluencerMarketing.ai · creator shortlist',
    uses: 'A sentence about creators, influencers or a campaign launch brings the agent in here.',
  },
  doreel: {
    name: 'DoReel · generated creative',
    uses: 'Any sentence that ends in a campaign has its creative made in here.',
  },
  newvoices: {
    name: 'NewVoices · the conversation layer',
    uses: 'A sentence about calls, customers or the phones stands the voice agent up in here.',
  },
  research: {
    name: 'Research · findings',
    uses: 'Any sentence that asks why something is happening is worked out in here.',
  },
};

/* a workspace took part in this run only if the profile listed its step */
const wsRan = ws => !!LAST.indices && LAST.indices.some(i => STEPS[i].ws === ws);

function emptyHTML(head, p, btnLabel) {
  return `<div class="esheet__empty">
    <h3 class="esheet__h">${esc(head)}</h3>
    <p class="esheet__p">${esc(p)}</p>
    ${btnLabel ? `<button class="btn btn--dark" type="button" data-sheet-run>${esc(btnLabel)}</button>` : ''}
  </div>`;
}

/* what the workspace is holding once its step has run — every figure comes
   from LAST.seed through the same helpers the results card uses */
function wsArtifactsHTML(ws, seed) {
  switch (ws) {

    case 'newintel':
      return `<h3 class="esheet__h">What rivals did while you read this.</h3>
        <p class="esheet__stat">${esc(seed.signals.toLocaleString())} signals analysed this run</p>
        <div class="esheet__feed">
          <span><i class="pulse"></i><b>Hoka cut prices 4%</b><em>2h</em></span>
          <span><i class="pulse"></i><b>Adidas hiring spike in growth</b><em>9h</em></span>
          <span><i class="pulse"></i><b>New On creator campaign</b><em>1d</em></span>
        </div>`;

    /* the only branch in the sheet that can carry a badge: a stored answer
       from a model that really replied during this run */
    case 'newindex':
      if (LAST.liveAnswer) return liveAnswerHTML(LAST.liveAnswer);
      return `<h3 class="esheet__h">Nike ranks ${esc(seed.rankWord)} when buyers ask.</h3>
        <p class="esheet__p">Across the answer engines, rivals get named first. The campaign below is built to change that.</p>`;

    case 'imai':
      return `<h3 class="esheet__h">${esc(seed.creators)} creators, shortlisted.</h3>
        ${avatarsHTML(seed)}
        <p class="esheet__stat esheet__stat--mid">Audience overlap</p>
        <div class="esheet__bars">
          <span><b>Buyers you’re losing</b><span class="ebar"><i style="--w:${esc(seed.overlapA)}%"></i></span><em>${esc(seed.overlapA)}%</em></span>
          <span><b>The wider category</b><span class="ebar"><i style="--w:${esc(seed.overlapB)}%"></i></span><em>${esc(seed.overlapB)}%</em></span>
        </div>`;

    case 'doreel':
      return `<h3 class="esheet__h">${esc(seed.ads)} variants, ready.</h3>
        ${adsHTML(seed)}
        <p class="esheet__p">Written from the findings, rendered as presenter and UGC variants.</p>`;

    case 'newvoices':
      /* the dot is decoration, not a claim — nothing here was answered live */
      return `<h3 class="esheet__h">On the phones.</h3>
        <p class="ecard__quote">${VOICE_QUOTE}</p>
        <p class="estatus"><i class="pulse"></i>Answering inbound from the campaign.</p>`;

    case 'research': {
      const live = LAST.liveFindings;
      const isLive = hasLiveRows(live);
      const rows = isLive ? live.rows : scriptedFindings(seed);
      /* the same heading the results card carries — one artefact, one name */
      return `<h3 class="esheet__h">Why Nike is losing share</h3>
        ${findingsRowsHTML(rows)}
        ${isLive ? liveFindingsMetaHTML(live) : ''}
        <p class="esheet__k esheet__k--mid">Ask the market a follow-up</p>
        <div class="esheet__ask">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7.1" cy="7.1" r="4.2" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M10.3 10.3l3.1 3.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          <input type="text" disabled aria-label="Ask the market a follow-up" placeholder="Which of these would move first if we fixed it?">
        </div>
        <p class="esheet__note">Prototype — research on demand ships with the product.</p>`;
    }

    default: return '';
  }
}

function sheetHTML(ws) {
  const meta = WS[ws];
  if (!meta) return '';
  const head = `<p class="esheet__k">${esc(meta.name)}</p>`;

  /* 1 — nothing has run yet, so nothing is in here */
  if (!LAST.seed) {
    return head + emptyHTML('Nothing here yet.',
      'Run a sentence and the agent fills this workspace as it works.',
      'Run a sentence');
  }

  /* 4 — the sentence didn't call for this workspace */
  if (!wsRan(ws)) {
    return head + (LAST.done
      ? emptyHTML(meta.skipHead || 'The agent didn’t need this workspace for that sentence.',
          meta.uses, 'Run a different sentence')
      : emptyHTML('Nothing here yet.',
          `This run doesn’t use this workspace. ${meta.uses}`, ''));
  }

  /* 2 — the run is still going */
  if (!LAST.done) {
    if (LAST.runningWs === ws) {
      return head + `<h3 class="esheet__h">The agent is in here now…</h3>
        <p class="esheet__p">This workspace is doing its part of the run. The artifacts land when the step completes.</p>
        <p class="esheet__work"><i class="spin"></i>Working</p>`;
    }
    if (!LAST.doneWs.includes(ws)) {
      return head + emptyHTML('Nothing here yet.',
        'The agent hasn’t reached this workspace yet — it comes later in this run.', '');
    }
  }

  /* 3 — the step has finished: show what it left */
  return head + wsArtifactsHTML(ws, LAST.seed);
}

/* the row that opened the sheet, so focus can go back to it on close */
let sheetOpener = null;

function openSheet(ws) {
  if (!sheet || !sheetBody || !WS[ws]) return;
  const panel = $('.esheet__panel', sheet);
  panel?.setAttribute('aria-label', WS[ws].name);
  sheetBody.innerHTML = sheetHTML(ws);
  sheet.hidden = false;
  if (panel) panel.scrollTop = 0;
  $('.esheet__x', sheet)?.focus({ preventScroll: true });
}

function closeSheet() {
  if (!sheet || sheet.hidden) return;
  sheet.hidden = true;
  /* emptied, not hidden: nothing is cached between opens and the ad
     clips stop playing behind a closed sheet */
  if (sheetBody) sheetBody.innerHTML = '';
  const opener = sheetOpener;
  sheetOpener = null;
  opener?.focus({ preventScroll: true });
}

railRows().forEach(row => row.addEventListener('click', () => {
  const ws = row.dataset.ws;
  if (!ws) return;
  sheetOpener = row;
  openSheet(ws);
}));

sheet?.addEventListener('click', e => {
  if (e.target.closest('[data-sheet-close]')) { closeSheet(); return; }
  if (e.target.closest('[data-sheet-run]')) {
    closeSheet();
    scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
    if (FINE) input?.focus({ preventScroll: true });
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sheet && !sheet.hidden) closeSheet();
});

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

/* ── The generation token ─────────────────────────────────────
   A run is a chain of awaits that outlives any single frame: forty-odd
   seconds of theatre, plus two live calls with their own grace windows.
   Resetting mid-run used to leave that chain running in the dark, and it
   would surface later to mark the rail and drop a finished campaign onto
   a screen the visitor had already cleared. Every run takes a number on
   the way in; anything that comes back to a stale number stops rather
   than writes. resetAll bumps it too, so a reset with no run after it
   kills the loop just the same. */
let RUN = 0;

async function startRun(sentence) {
  if (running) return;
  const my = ++RUN;
  const isStale = () => my !== RUN;
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

  /* the record the workspace sheet reads — from this moment on a workspace
     shows this run and not the one before it */
  resetLast();
  LAST.seed = seed;
  LAST.sentence = sentence;
  LAST.indices = indices;
  railRows().forEach(r => r.classList.remove('is-done'));

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
  startTimer();

  await tick(REDUCED ? 120 : 2000);
  if (isStale()) return;
  const meta = $('#eplanMeta');
  if (meta) {
    /* the swap clears the line — including the planning spinner, as it always
       has. The clock is lifted out and put back, so it keeps its own time. */
    const timer = $('#etimer');
    meta.textContent = 'Working — the agent moves between workspaces as each step needs it.';
    if (timer) meta.appendChild(timer);
  }

  const lis = $$('.estep', erun);
  const phrase = keyPhrase(sentence);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const isNewIndex = step.ws === 'newindex';
    /* a breath between steps, so each check lands before the next spinner */
    if (i) await tick(REDUCED ? 40 : 650);
    if (isStale()) return;
    await runStep(step, i, lis[i], seed, {
      echo: i === 0 ? phrase : null,
      isStale,
      onTheatreDone: isNewIndex ? async () => {
        const graceMs = hurried ? 800 : 6000;
        const r = await Promise.race([qLive, wait(graceMs).then(() => null)]);
        if (!r || isStale()) return null;
        /* stored so the NewIndex sheet can re-show the same real answer —
           the badge and the audit row travel with it and only with it */
        LAST.liveAnswer = { question, answer: r.answer, model: r.model, ms: r.ms, named: r.named };
        return {
          doneTitle: 'Asked a real model how Nike ranks',
          html: liveAnswerHTML(LAST.liveAnswer),
        };
      } : null,
    });
    if (isStale()) return;
  }

  const doneMsg = $('#eplanDone');
  if (doneMsg) doneMsg.hidden = false;
  stopTimer();

  input.disabled = false;
  send.disabled = false;
  input.value = '';
  input.placeholder = 'Run another sentence…';

  /* let the completion line land before the campaign takes over */
  await tick(REDUCED ? 60 : 1400);
  if (isStale()) return;

  const fGraceMs = hurried ? 500 : 5000;
  const findingsLive = await Promise.race([fLive, wait(fGraceMs).then(() => null)]);
  if (isStale()) return;
  /* only a real result is stored; a miss leaves null and the Research
     sheet falls back to the scripted three, unbadged */
  LAST.liveFindings = hasLiveRows(findingsLive) ? findingsLive : null;

  renderDone(seed, findingsLive);

  /* the run is over: every workspace it used now holds something */
  LAST.done = true;
  LAST.runningWs = null;
  indices.forEach(i => railRow(STEPS[i].ws)?.classList.add('is-done'));

  edone.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });

  running = false;
}

/* fast-forward: any click outside the switcher/links, or Enter, while a
   run is in progress hurries every remaining wait down to almost nothing */
/* .rail and #esheet are exempt on both handlers: opening a workspace to
   look at what the agent left there is reading, not skipping — and the
   sheet's own buttons (close, "run a sentence") must never double as a
   fast-forward. */
document.addEventListener('click', e => {
  if (!running || hurried) return;
  if (performance.now() - runStartedAt < SETTLE) return;
  if (e.target.closest('.ab') || e.target.closest('a')) return;
  if (e.target.closest('#promptForm') || e.target.closest('.chips')) return;
  if (e.target.closest('.rail') || e.target.closest('#esheet')) return;
  hurried = true;
});
document.addEventListener('keydown', e => {
  if (!running || hurried) return;
  if (performance.now() - runStartedAt < SETTLE) return;
  if (e.target === input) return;
  if (e.target?.closest?.('.rail') || e.target?.closest?.('#esheet')) return;
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
  /* orphan whatever is still awaiting: the run in flight now holds a number
     nobody answers to, and stops at its next check instead of writing */
  RUN++;
  stopTimer();
  closeSheet();
  erun.innerHTML = '';
  erun.hidden = true;
  edone.innerHTML = '';
  edone.hidden = true;
  showHero();
  input.disabled = false;
  send.disabled = false;
  input.value = '';
  input.placeholder = PLACEHOLDER;
  litRows().forEach(r => r.classList.remove('is-live'));
  railRows().forEach(r => r.classList.remove('is-done'));
  /* the workspaces empty with the page — nothing is kept from a run the
     visitor has cleared away */
  resetLast();
  running = false;
  hurried = false;
  scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
}

/* "New run" also puts the cursor back where the next sentence is typed */
function newRun() {
  resetAll();
  if (FINE) input.focus({ preventScroll: true });
}

$('#newRun')?.addEventListener('click', newRun);
document.addEventListener('click', e => {
  if (e.target.closest('[data-act="reset"]')) resetAll();
});

/* ══════════════════════ THE ACCOUNT MARK ══════════════════════
   The rail says who is signed in. The monogram square is rendered by the
   stylesheet and is always correct; the favicon is an optimistic layer over
   it, requested by the browser at render time. It arrives hidden and is only
   revealed once it has actually decoded — a 404 (or an offline dev sandbox)
   removes the <img> and the N underneath is what stays. Nothing here is on
   the run's path, so a failure costs the page nothing. */
function mountAccount() {
  const L = window.ELIVE;
  const img = $('#eacct .eacct__mark img');
  if (!img || !L?.markURL || !L?.PERSONA?.domain) return;
  img.addEventListener('load', () => { img.hidden = false; }, { once: true });
  img.addEventListener('error', () => { img.remove(); }, { once: true });
  img.src = L.markURL(L.PERSONA.domain);
}

mountAccount();

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
