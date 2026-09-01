/* ═══════════════════════════════════════════════════════════════════════════
   SNAPSHOT — the S4 reveal (reference/kit/W4-Snapshot-Output.png).

   Takes over from machine/convo.js the moment SAIFLOW reaches phase 'done':
   a full-width page section replacing the conversation, built entirely from
   window.SAISNAPDATA's contract (machine/snapshot-data.js, built in
   parallel — this file never invents a number of its own). Three modules,
   a capture band, a dark bottom band of routed actions.

   window.SAISNAP — the surface machine/convo.js hands off to:
     .show(session)   → mounts the snapshot for this session, pushes /snapshot

   Nothing here touches engine.js, flow.js, research.js or b.js — it reads
   window.SAI / window.SAIFLOW / window.SAISNAPDATA and the two globals b.js
   exposes for the handoff (window.startDashboard, window.resetLanding), and
   renders what it's told.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* dependency-free — this file sits between convo.js and shared.js in the
   script order (see machine/b.html), so window.SWAI isn't guaranteed yet at
   parse time even though every function below only ever runs later, off a
   user interaction well after the whole script order has executed. Kept
   local anyway, same reasoning convo.js uses for its own esc(). */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
  { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

const LOCK_ICON = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
  <path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  <rect x="3.25" y="7" width="9.5" height="6.5" rx="1.4" stroke="currentColor" stroke-width="1.4" fill="none"/>
</svg>`;
const DOWNLOAD_ICON = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
  <path d="M8 2.5v7M5 6.7 8 9.7l3-3M3.25 12.75h9.5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
const ARROW_ICON = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
  <path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/* the three tiles this contract always returns, in case SAISNAPDATA hasn't
   loaded (a broken script tag shouldn't blank the page) */
const DEFAULT_ACTIONS = [
  { id: 'session',   title: 'Book a working session',            line: 'Walk through your snapshot with the team behind these numbers.', primary: true },
  { id: 'workspace', title: 'Request your full AI workspace',    line: 'Your snapshot, tracked and updated, in a workspace of your own.' },
  { id: 'callback',  title: 'Let the machine call you',          line: 'A five-minute call, at a time you pick.' },
];

const isValidEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());

/* ─────────────────────────── DATA (with a defensive fallback) ─────────────────────────── */

function fallbackData(session) {
  const domain = session && session.slots && session.slots.company_domain;
  const company = (session && session.slots && session.slots.company) ||
    (domain ? domain.split('.')[0].replace(/^\w/, c => c.toUpperCase()) : 'Your brand');
  return {
    company,
    builtLine: 'Built from your answers · ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    illustrative: true,
    modules: {
      comp: { rows: [{ name: company, score: 41, you: true }, { name: 'A category leader', score: 60 }, { name: 'A smaller rival', score: 33 }],
        finding: 'Awareness is healthy, but the category leader is out ahead on consideration.' },
      ai: { query: 'best in the category right now', rows: [{ engine: 'ChatGPT', n: 2, of: 10 }, { engine: 'Gemini', n: 3, of: 10 }, { engine: 'Perplexity', n: 1, of: 10 }],
        finding: 'Coverage is thin across all three assistants.' },
      signal: { score: 55, delta: '+3 pts', window: 'last 90 days', finding: 'Momentum is modest but positive.' },
    },
    actions: DEFAULT_ACTIONS.map(a => Object.assign({}, a)),
  };
}

function buildData(session) {
  try {
    if (window.SAISNAPDATA && typeof window.SAISNAPDATA.build === 'function') {
      const d = window.SAISNAPDATA.build(session);
      if (d && d.modules) return d;
    }
  } catch (e) { /* fall through to the fallback below */ }
  return fallbackData(session);
}

/* ─────────────────────────── RENDER PIECES ─────────────────────────── */

function buildBars(rows) {
  return (rows || []).map(r => `
    <div class="snapbar${r.you ? ' is-you' : ''}">
      <span class="snapbar__n">${esc(r.name)}</span>
      <span class="snapbar__t"><i data-w="${Math.max(0, Math.min(100, Number(r.score) || 0))}" style="width:0%"></i></span>
      <span class="snapbar__v">${esc(String(r.score))}</span>
    </div>`).join('');
}

function buildEngineRows(rows) {
  return (rows || []).map(r => `
    <div class="snapeng__row">
      <b>${esc(r.engine)}</b>
      <span>${esc(String(r.n))} of ${esc(String(r.of))} answers</span>
    </div>`).join('');
}

const DIAL_R = 52;
const DIAL_C = 2 * Math.PI * DIAL_R;

function buildDial(signal) {
  const score = Math.max(0, Math.min(100, Number(signal.score) || 0));
  const deltaText = String(signal.delta == null ? '' : signal.delta);
  const isDown = /^-/.test(deltaText.trim());
  return `
    <div class="snapmod__body">
      <div class="snapdial">
        <svg class="snapdial__svg" viewBox="0 0 120 120" role="img" aria-label="Brand signal score ${score} of 100">
          <circle class="snapdial__bg" cx="60" cy="60" r="${DIAL_R}"/>
          <circle class="snapdial__fg" cx="60" cy="60" r="${DIAL_R}"
            stroke-dasharray="${DIAL_C.toFixed(2)}" stroke-dashoffset="${DIAL_C.toFixed(2)}"
            data-offset="${(DIAL_C * (1 - score / 100)).toFixed(2)}"/>
        </svg>
        <div class="snapdial__num">${score}</div>
      </div>
      <div class="snapdial__meta">
        <span class="snapdial__label">Momentum vs. category</span>
        <b class="snapdial__delta${isDown ? ' is-down' : ''}">${esc(deltaText)}</b>
        <span class="snapdial__window">${esc(signal.window || '')}</span>
      </div>
    </div>`;
}

function buildTiles(actions, domain) {
  let list = Array.isArray(actions) && actions.length ? actions.slice() : DEFAULT_ACTIONS.slice();
  if (!list.some(a => a.primary)) list = list.map((a, i) => Object.assign({}, a, { primary: i === 0 }));
  return list.map(a => {
    const cls = 'snaptile' + (a.primary ? ' is-primary' : '');
    /* the workspace tile IS the live dashboard when we have a domain to point
       it at; with no domain it falls back to the same lead-capture modal the
       other two tiles use */
    /* …and only where the dashboard actually exists to preview. The snapshot
       also mounts on the solution pages, which carry no #dash section, so
       promising a preview "below" there would point at nothing. */
    if (a.id === 'workspace' && domain && document.getElementById('dash')) {
      return `<button type="button" class="${cls}" data-action="workspace-live">
        <b>${esc(a.title)}${ARROW_ICON}</b>
        <span>${esc(a.line)}</span>
        <em class="snaptile__note">Preview it live below</em>
      </button>`;
    }
    const cta = a.id === 'callback' ? 'callback' : (a.id === 'workspace' ? 'workspace' : 'session');
    return `<button type="button" class="${cls}" data-cta="${cta}">
      <b>${esc(a.title)}${ARROW_ICON}</b>
      <span>${esc(a.line)}</span>
    </button>`;
  }).join('');
}

function captureFormHTML() {
  return `
    <div class="snapcap__text">
      <b>Get the full report — and keep it updated.</b>
      <span>The complete snapshot as a PDF, plus what we'd do about it.</span>
    </div>
    <form class="snapcap__form" id="snapCaptureForm" novalidate>
      <div class="snapcap__field">
        <input class="snapcap__email" id="snapEmail" type="email" placeholder="Work email" aria-label="Work email" autocomplete="email">
        <p class="snapcap__hint" id="snapEmailHint" hidden>That doesn't look like a work email yet.</p>
      </div>
      <label class="snapcap__consent">
        <input type="checkbox" id="snapConsent">
        <span>It's OK to contact me about these results</span>
      </label>
      <button class="btn btn--gold" type="submit">Send my report</button>
    </form>
    <button type="button" class="snapcap__decline" id="snapDecline">No thanks — just browsing</button>`;
}

function sectionHTML(data, session) {
  const domain = session && session.slots && session.slots.company_domain;
  return `
    <div class="snap__in">
      <header class="snap__printhead" aria-hidden="true">
        <svg><use href="#sw-logo"/></svg>
        <div><b>Your Stagwell.AI Snapshot</b><span>${esc(data.company)}</span></div>
      </header>

      <div class="snap__head">
        <div class="snap__headtext">
          <p class="eyebrow snap__eyebrow"><i class="pulse"></i>YOUR STAGWELL.AI SNAPSHOT</p>
          <h1 class="display snap__title">${esc(data.company)} vs. your market, <span class="accent">right now</span></h1>
          <p class="snap__sub">${esc(data.builtLine)}</p>
        </div>
        <div class="snap__pdf">
          <button type="button" class="snap__pdfbtn" id="snapPdfBtn" disabled aria-disabled="true">
            <span class="snap__pdficon" id="snapPdfIcon">${LOCK_ICON}</span><span>Download PDF</span>
          </button>
          <span class="snap__pdfhint" id="snapPdfHint">Unlocks when we send your report</span>
        </div>
      </div>

      <div class="snap__modules">
        <article class="snapmod" data-mod="comp">
          <div class="snapmod__head"><h3>Competitive position</h3><span class="snapmod__tag">Illustrative</span></div>
          <div class="snapbars">${buildBars(data.modules.comp.rows)}</div>
          <p class="snapmod__finding">${esc(data.modules.comp.finding)}</p>
        </article>
        <article class="snapmod" data-mod="ai">
          <div class="snapmod__head"><h3>AI-search visibility</h3><span class="snapmod__tag">Illustrative</span></div>
          <div class="snapeng">${buildEngineRows(data.modules.ai.rows)}</div>
          <p class="snapmod__finding">${esc(data.modules.ai.finding)}</p>
        </article>
        <article class="snapmod snapmod--signal" data-mod="signal">
          <div class="snapmod__head"><h3>Brand signal</h3><span class="snapmod__tag">Illustrative</span></div>
          ${buildDial(data.modules.signal)}
          <p class="snapmod__finding">${esc(data.modules.signal.finding)}</p>
        </article>
      </div>

      <div class="snapcap" id="snapCapture">${captureFormHTML()}</div>

      <p class="snap__printfoot">Demo print view — designed PDF export ships with the workspace. Figures are illustrative.</p>
    </div>

    <div class="snapband">
      <div class="snapband__in">
        <h2>This is the preview. <span class="accent">The workspace is the product.</span></h2>
        <div class="snaptiles">${buildTiles(data.actions, domain)}</div>
      </div>
    </div>`;
}

/* ─────────────────────────── POST-MOUNT WIRING ─────────────────────────── */

function animateIn(root) {
  const bars = $$('.snapbar__t i', root);
  const dial = $('.snapdial__fg', root);
  const apply = () => {
    bars.forEach(i => { i.style.width = i.dataset.w + '%'; });
    if (dial) dial.style.strokeDashoffset = dial.dataset.offset;
  };
  if (REDUCED) { apply(); return; }
  requestAnimationFrame(() => requestAnimationFrame(apply));
}

function printSnapshot(session) {
  let meta = null;
  try { if (window.SAISNAPDATA && typeof window.SAISNAPDATA.pdfMeta === 'function') meta = window.SAISNAPDATA.pdfMeta(session); }
  catch (e) { /* the print still works without a nicer filename */ }
  const prevTitle = document.title;
  if (meta && meta.title) document.title = meta.title;
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    document.title = prevTitle;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  setTimeout(restore, 5000);
  window.print();
}

function unlockPdf(root) {
  const btn = $('#snapPdfBtn', root);
  const hint = $('#snapPdfHint', root);
  const icon = $('#snapPdfIcon', root);
  if (btn) { btn.disabled = false; btn.removeAttribute('aria-disabled'); }
  if (icon) icon.innerHTML = DOWNLOAD_ICON;
  if (hint) hint.textContent = 'Ready — opens the print view.';
}

function shakeCap(cap) {
  cap.classList.remove('is-shake');
  void cap.offsetWidth; /* restart the animation on a repeat miss */
  cap.classList.add('is-shake');
}

/* the routing screen's own entry point — swapped in defensively so a
   missing/broken machine/path.js still leaves the confirmation intact. */
function goToPath(session) {
  try {
    if (window.SAIPATH && typeof window.SAIPATH.show === 'function') window.SAIPATH.show(session);
  } catch (e) { /* the confirmation already shown is the fallback */ }
}

function wireCapture(root, session) {
  const cap = $('#snapCapture', root);
  if (!cap) return;
  const form = $('#snapCaptureForm', cap);
  const decline = $('#snapDecline', cap);

  if (form) form.addEventListener('submit', e => {
    e.preventDefault();
    const emailInput = $('#snapEmail', cap);
    const hint = $('#snapEmailHint', cap);
    const val = emailInput ? emailInput.value.trim() : '';
    if (!isValidEmail(val)) {
      shakeCap(cap);
      if (hint) hint.hidden = false;
      if (emailInput) emailInput.focus();
      return;
    }
    const consent = !!($('#snapConsent', cap) && $('#snapConsent', cap).checked);
    try {
      if (window.SAISNAPDATA && typeof window.SAISNAPDATA.emailCaptured === 'function')
        window.SAISNAPDATA.emailCaptured(val, consent);
    } catch (err) { /* the confirmation still shows — a broken bus isn't the visitor's problem */ }
    unlockPdf(root);
    cap.classList.add('is-done');
    cap.innerHTML = `<p class="snapcap__quiet">Sent. Your report is on its way to <b>${esc(val)}</b>.</p>
      <button type="button" class="btn btn--gold snapcap__pathbtn" id="snapPathGo">See your recommended path →</button>`;
    const goBtn = $('#snapPathGo', cap);
    if (goBtn) goBtn.addEventListener('click', () => goToPath(session));
  });

  if (decline) decline.addEventListener('click', () => {
    try {
      if (window.SAISNAPDATA && typeof window.SAISNAPDATA.declined === 'function') window.SAISNAPDATA.declined();
    } catch (err) { /* still collapses the band */ }
    cap.classList.add('is-quiet');
    cap.innerHTML = `<p class="snapcap__quiet">No problem — the snapshot stays right here.</p>
      <button type="button" class="snapcap__pathlink" id="snapPathGoDeclined">See your recommended path →</button>`;
    const goBtn = $('#snapPathGoDeclined', cap);
    if (goBtn) goBtn.addEventListener('click', () => goToPath(session));
  });
}

function wirePdf(root, session) {
  const btn = $('#snapPdfBtn', root);
  if (!btn) return;
  btn.addEventListener('click', () => { if (!btn.disabled) printSnapshot(session); });
}

function wireBottom(root, session) {
  $$('[data-action="workspace-live"]', root).forEach(btn => {
    btn.addEventListener('click', () => {
      const domain = session && session.slots && session.slots.company_domain;
      if (domain && typeof window.startDashboard === 'function') window.startDashboard(domain);
    });
  });
  /* [data-cta] tiles (session / callback / the no-domain workspace fallback)
     are picked up by machine/b.js's own delegated document click listener —
     nothing to wire here. */
}

/* ─────────────────────────── MOUNT / TEARDOWN ─────────────────────────── */

const HIDE_SELECTORS = '#hero2, #dash, #cloud, #cta';
let mounted = false;
let savedHidden = null;

function ensureSection() {
  let el = $('#snapView');
  if (el) return el;
  el = document.createElement('section');
  el.id = 'snapView';
  el.className = 'snap';
  el.hidden = true;
  el.setAttribute('aria-label', 'Your Stagwell.AI snapshot');
  const main = $('#top');
  const hero2 = $('#hero2');
  if (main && hero2 && hero2.parentElement === main) main.insertBefore(el, hero2.nextSibling);
  else if (main) main.appendChild(el);
  else document.body.appendChild(el);
  return el;
}

function hideRestOfPage() {
  const targets = $$(HIDE_SELECTORS);
  savedHidden = targets.map(el => ({ el, hidden: el.hidden }));
  targets.forEach(el => { el.hidden = true; });
}

function restoreRestOfPage() {
  if (!savedHidden) return;
  savedHidden.forEach(({ el, hidden }) => { el.hidden = hidden; });
  savedHidden = null;
}

function teardown() {
  const el = $('#snapView');
  if (el) { el.hidden = true; el.innerHTML = ''; }
  restoreRestOfPage();
  mounted = false;
}

function show(session) {
  const data = buildData(session);
  hideRestOfPage();
  const el = ensureSection();
  el.innerHTML = sectionHTML(data, session);
  el.hidden = false;
  mounted = true;

  wireCapture(el, session);
  wirePdf(el, session);
  wireBottom(el, session);
  animateIn(el);

  try { history.pushState({}, '', '/snapshot'); } catch (e) { /* fine, still works without a real route */ }
  try { if (window.SAISNAPDATA && typeof window.SAISNAPDATA.viewed === 'function') window.SAISNAPDATA.viewed(); }
  catch (e) { /* the view still renders without the event */ }

  requestAnimationFrame(() => el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }));
}

window.addEventListener('popstate', () => {
  if (location.pathname === '/snapshot') return;
  if (!mounted) return;
  teardown();
  if (typeof window.resetLanding === 'function') window.resetLanding();
  else location.href = '/';
});

window.SAISNAP = { show };

})();
