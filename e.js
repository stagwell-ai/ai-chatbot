/* ═══════════════════════════════════════════════════════════════════════════
   STAGWELL AI — VERSION E · the agent

   One sentence in, a finished campaign out — the run is scripted theatre.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const { esc, reveal, whenVisible } = window.SWAI;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ══════════════════════ THE PLAN ══════════════════════ */

const STEPS = [
  { ws: 'newintel', tag: 'NewIntel', title: 'Analysing competitor signals',
    doneTitle: 'Analysed 1,240 competitor signals',
    subs: ['Reading pricing pages…', 'Scanning hiring feeds…', 'Cross-referencing earned coverage…'],
    count: [0, 1240, ' signals'] },
  { ws: 'newindex', tag: 'NewIndex', title: 'Testing how AI answers rank you',
    doneTitle: 'Found you rank 4th in ChatGPT answers',
    subs: ['Asking the money question eight ways…', 'Scoring who gets named first…'] },
  { ws: 'imai', tag: 'InfluencerMarketing.ai', title: 'Shortlisting creators',
    doneTitle: 'Shortlisted 18 creators from 400M profiles',
    subs: ['Filtering 400M profiles…', 'Checking brand safety…', 'Ranking by audience overlap…'],
    count: [400, 18, ' creators'] },
  { ws: 'doreel', tag: 'DoReel', title: 'Generating video ads',
    doneTitle: 'Generated 6 video ads',
    subs: ['Writing scripts from the findings…', 'Rendering presenter variants…'],
    count: [0, 6, ' ads'] },
  { ws: 'research', tag: 'Activation', title: 'Launching the campaign',
    doneTitle: 'Launched campaign across Meta and TikTok',
    subs: ['Building audiences…', 'Setting pacing…', 'Going live…'] },
  { ws: 'newvoices', tag: 'NewVoices', title: 'Standing up the voice agent',
    doneTitle: 'Voice agent live, answering inbound calls',
    subs: ['Briefing it on the campaign…', 'Connecting the number…'] },
];

const PLACEHOLDER = 'Win back the market share we lost to our biggest rival this quarter.';

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

/* the fast-forward flag folds every remaining wait down to almost nothing */
const tick = ms => wait(hurried ? Math.min(ms, 60) : ms);

/* ══════════════════════ CHIPS ══════════════════════ */

$$('.chip[data-fill]', chips).forEach(c => c.addEventListener('click', () => {
  input.value = c.dataset.fill;
  input.focus();
}));

/* ══════════════════════ RUN RENDER ══════════════════════ */

function stepMarkup(step) {
  return `<li class="estep" data-state="pending">
    <span class="estep__mark"></span>
    <span class="estep__t"><b>${esc(step.title)}</b><i></i></span>
    <span class="estep__ws">${esc(step.tag)}</span></li>`;
}

function renderPlan(sentence) {
  erun.innerHTML = `<div class="eplan">
    <p class="eplan__q">“${esc(sentence)}”</p>
    <p class="eplan__meta" id="eplanMeta"><i class="spin"></i>Planning across six workspaces…</p>
    <ol class="esteps">${STEPS.map(stepMarkup).join('')}</ol>
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

async function runStep(step, i, li) {
  li.dataset.state = 'running';
  const row = railRow(step.ws);
  row?.classList.add('is-live');
  const sub = $('.estep__t i', li);

  const total = REDUCED ? 200 : 2600 + i * 130;
  const subs = step.subs;
  const beatMs = Math.max(REDUCED ? 40 : 300, Math.floor(total / subs.length));

  for (let s = 0; s < subs.length - 1; s++) {
    sub.textContent = subs[s];
    await tick(REDUCED ? 80 : Math.min(900, beatMs));
  }
  /* the final beat: for steps with a count, the count-up plays alongside
     the last sub — it replaces the text as the running total climbs */
  if (step.count) {
    await runCount(sub, step.count, REDUCED ? 200 : Math.max(500, beatMs));
  } else {
    sub.textContent = subs[subs.length - 1];
    await tick(REDUCED ? 80 : Math.min(900, beatMs));
  }

  li.dataset.state = 'done';
  $('.estep__mark', li).innerHTML = CHECK;
  $('.estep__t b', li).textContent = step.doneTitle;
  sub.textContent = '';
  row?.classList.remove('is-live');
}

/* ══════════════════════ RESULTS RENDER ══════════════════════ */

function renderDone() {
  edone.innerHTML = `<div class="ekit">
    <p class="ekit__k">The finished campaign</p>
    <div class="ekit__grid">
      <article class="ecard ecard--findings"><h4>Why you’re losing share</h4>
        <p class="ecard__row"><b>They cut price where it hurts.</b><em>Their hero SKU undercut yours by 4% in May — your consideration dipped within two weeks.</em></p>
        <p class="ecard__row"><b>They own the question.</b><em>Asked the money question, the models name them first. You rank 4th in ChatGPT answers.</em></p>
        <p class="ecard__row"><b>Their creators outspend yours 2:1.</b><em>And earned coverage follows the creators.</em></p></article>
      <article class="ecard ecard--creators"><h4>18 creators, shortlisted</h4>
        <div class="ecard__avatars"><span class="eavatar">MK</span><span class="eavatar">DT</span><span class="eavatar">AS</span><span class="eavatar eavatar--more">+15</span></div>
        <p class="ecard__sub">Vetted, on-audience, ranked by overlap with the buyers you’re losing.</p></article>
      <article class="ecard ecard--ads"><h4>6 video ads, generated</h4>
        <div class="eads">
          <span class="ead"><video src="./assets/img/doreel.mp4" autoplay muted loop playsinline></video></span>
          <span class="ead"><video src="./assets/img/imai.mp4" autoplay muted loop playsinline></video></span>
          <span class="ead ead--stub ead--s1"></span><span class="ead ead--stub ead--s2"></span>
          <span class="ead ead--stub ead--s3"></span><span class="ead ead--stub ead--s4"></span>
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
  hurried = false;

  hideHero();
  input.disabled = true;
  send.disabled = true;

  renderPlan(sentence);

  await tick(REDUCED ? 120 : 1200);
  const meta = $('#eplanMeta');
  if (meta) meta.textContent = 'Working — the agent moves between workspaces as each step needs it.';

  const lis = $$('.estep', erun);
  for (let i = 0; i < STEPS.length; i++) {
    await runStep(STEPS[i], i, lis[i]);
  }

  const doneMsg = $('#eplanDone');
  if (doneMsg) doneMsg.hidden = false;

  input.disabled = false;
  send.disabled = false;
  input.value = '';
  input.placeholder = 'Run another sentence…';

  renderDone();
  edone.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });

  running = false;
}

/* fast-forward: any click outside the switcher/links, or Enter, while a
   run is in progress hurries every remaining wait down to almost nothing */
document.addEventListener('click', e => {
  if (!running || hurried) return;
  if (e.target.closest('.ab') || e.target.closest('a')) return;
  hurried = true;
});
document.addEventListener('keydown', e => {
  if (!running || hurried) return;
  if (e.key === 'Enter') hurried = true;
});

/* ══════════════════════ SUBMIT / RESET ══════════════════════ */

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

  /* deep link: run=<sentence> starts the run automatically, boot skipped
     to a minimum wait but pacing left un-hurried */
  const params = new URLSearchParams(location.search);
  if (params.has('run')) {
    const sentence = params.get('run').trim() || PLACEHOLDER;
    startRun(sentence);
  }
});

})();
