/* ═══════════════════════════════════════════════════════════════════════════
   CONVO — the S3 qualification conversation (reference/kit/W3-Qualification.png).

   Owns the transition from the landing's one prompt box into the two-column
   kit conversation: chat spine left (the existing #chatPanel/#thread, reused
   verbatim), "YOUR SNAPSHOT" build rail right. Drives itself off three
   globals it never assumes exist eagerly — window.SAI (shipped), window.SAI
   FLOW and window.SAIRESEARCH (built in parallel; this file only renders
   what SAIFLOW/SAI's research events narrate, never runs research itself).

   window.SAICONVO — the surface machine/b.js hands off to:
     .begin(rawText)   → true if the conversation took over, false if
                         SAIFLOW isn't available (caller should fall back)
     .active()         → true from a successful begin() until the flow
                         hands off to the dashboard or the visitor leaves
     .submit(rawText)  → free-text answer while the flow has the composer

   Nothing here touches machine/engine.js, machine/flow.js, machine/
   research.js or api/ask.js — it only reads the documented contract and
   renders what it's told.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* minimal, dependency-free escaper — convo.js loads before shared.js in the
   script order (it sits right after engine.js), so it can't lean on
   window.SWAI.esc even though that exists by the time any of this actually
   runs (all of it fires off user interaction, well after every script tag
   has executed). Kept local anyway: one less cross-file assumption. */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
  { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

/* ─────────────────────────── STATE ─────────────────────────── */

let active = false;         // a SAIFLOW conversation is currently driving the composer
let busy = false;           // an answer is in flight — ignore taps/submits until it resolves
let finished = false;       // phase 'done' has been handled once
let lastQuestionId = null;  // dedupe: only append a bubble when the question actually changes
let waitingBubble = null;   // the quiet typing-dots turn shown during 'waiting-research'
let lastProgressPct = 0;
const moduleStatus = { competitive: 'idle', aisearch: 'idle', brand: 'idle' };
let cardStatus = 'idle';

const RAIL_TWO_LEFT = 'Two more answers and it’s yours to see.';

/* ─────────────────────────── DOM HELPERS ─────────────────────────── */

function els() {
  return {
    hero: $('#hero2'),
    heroIn: $('.hero2__in'),
    chat: $('#chat'),
    chatPanel: $('#chatPanel'),
    thread: $('#thread'),
    promptForm: $('#promptForm'),
    promptInput: $('#promptInput'),
    prompt: $('.prompt'),
    solveChips: $('#solveChips'),
  };
}

let stick = true;
function wireStick(thread) {
  thread.addEventListener('scroll', () => {
    stick = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 48;
  }, { passive: true });
}
function scrollThread() {
  const { thread } = els();
  if (!thread) return;
  stick = true;
  requestAnimationFrame(() => { if (stick) thread.scrollTop = thread.scrollHeight; });
}

function shakePrompt() {
  const { prompt } = els();
  if (!prompt) return;
  prompt.classList.add('is-shake');
  setTimeout(() => prompt.classList.remove('is-shake'), 440);
}

/* ─────────────────────────── BUBBLES ─────────────────────────── */

function aiTurn() {
  const { thread } = els();
  const t = document.createElement('div');
  t.className = 'turn';
  t.innerHTML = `<div class="ai">
      <svg class="ai__mark"><use href="#sw-mark"/></svg>
      <div class="ai__body"><p class="ai__who">Stagwell AI</p>
        <div class="thinking"><i></i><i></i><i></i></div></div></div>`;
  thread.appendChild(t);
  scrollThread();
  return t.querySelector('.ai__body');
}

function addAgentBubble(html) {
  const body = aiTurn();
  const dots = $('.thinking', body);
  if (dots) dots.remove();
  const p = document.createElement('p');
  p.className = 'ai__text';
  p.innerHTML = html;
  body.appendChild(p);
  scrollThread();
  return body;
}

function addUserBubble(text) {
  const { thread } = els();
  const t = document.createElement('div');
  t.className = 'turn turn--user';
  t.innerHTML = `<div class="bubble">${esc(text)}</div>`;
  thread.appendChild(t);
  scrollThread();
}

function addWaitingBubble(label) {
  if (waitingBubble) return;
  const body = aiTurn();
  waitingBubble = body.closest('.turn');
  if (label) {
    const p = document.createElement('p');
    p.className = 'ai__text ai__text--muted';
    p.textContent = label;
    body.appendChild(p);
  }
}
function removeWaitingBubble() {
  if (!waitingBubble) return;
  waitingBubble.remove();
  waitingBubble = null;
}

function clearChips() {
  $$('#thread .opts').forEach(o => {
    o.classList.add('is-gone');
    setTimeout(() => o.remove(), 460);
  });
}

function renderChips(body, chips) {
  const wrap = document.createElement('div');
  wrap.className = 'opts';
  chips.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt';
    b.innerHTML = `<span class="opt__dot"></span>${esc(c.label)}`;
    b.style.animationDelay = `${80 + i * 60}ms`;
    b.addEventListener('click', () => handleAnswer(c.value, c.label));
    wrap.appendChild(b);
  });
  body.appendChild(wrap);
  requestAnimationFrame(() =>
    wrap.scrollIntoView({ block: 'end', behavior: REDUCED ? 'auto' : 'smooth' }));
}

/* ─────────────────────────── COMPOSER ─────────────────────────── */

function updateComposerForQuestion(q) {
  const { promptInput } = els();
  if (!promptInput) return;
  const allow = q.allowFreeText !== false;
  promptInput.disabled = !allow;
  promptInput.placeholder = allow
    ? 'Or answer in your own words…'
    : 'Choose an option above…';
}

/* ─────────────────────────── PROGRESS HEADER ─────────────────────────── */

/* SAIFLOW.state() carries progressLabel/progressPct/questionsAhead at the
   top level too, not just nested under .question — which matters the
   moment .question goes null (phase 'waiting-research' or 'done'). Reading
   the top-level fields means the header and the rail keep their numbers
   through that gap instead of freezing on whatever the last question said. */
function updateProgress(st) {
  const label = $('#convoProgressLabel');
  const fill = $('#convoProgressFill');
  if (!label || !fill) return;
  const pct = typeof st.progressPct === 'number'
    ? Math.max(0, Math.min(100, st.progressPct)) : lastProgressPct;
  lastProgressPct = pct;
  if (st.progressLabel) label.textContent = st.progressLabel;
  fill.style.width = pct + '%';
}

/* ─────────────────────────── SNAPSHOT RAIL ─────────────────────────── */

function railTemplate() {
  return `
    <div class="rail__head">Your snapshot</div>
    <div class="rail__card">
      <div class="rail__cardbar">
        <b id="railCompanyTitle">Your snapshot</b>
        <span class="rail__cardstatus" id="railCardStatus" data-status="idle">—</span>
      </div>
      <div class="rail__modules" id="railModules">
        <div class="rail__mod" data-mod="competitive">
          <div class="rail__modhead"><span>Competitive position</span>
            <span class="rail__chip" data-status="idle">—</span></div>
          <div class="rail__modbar"><i></i></div>
        </div>
        <div class="rail__mod" data-mod="aisearch">
          <div class="rail__modhead"><span>AI-search visibility</span>
            <span class="rail__chip" data-status="idle">—</span></div>
          <div class="rail__modbar"><i></i></div>
        </div>
        <div class="rail__mod" data-mod="brand">
          <div class="rail__modhead"><span>Brand signal</span>
            <span class="rail__chip" data-status="idle">—</span></div>
          <div class="rail__modbar"><i></i></div>
        </div>
      </div>
      <div class="rail__narration" id="railNarration" aria-live="polite" hidden></div>
      <p class="rail__remaining" id="railRemaining">${RAIL_TWO_LEFT}</p>
    </div>
    <p class="rail__fine">Your answers shape the snapshot and the recommendation — nothing is shared until you say so.</p>`;
}

function setModuleStatus(key, status) {
  moduleStatus[key] = status;
  const row = $(`.rail__mod[data-mod="${key}"]`);
  if (!row) return;
  const chip = row.querySelector('.rail__chip');
  row.dataset.status = status;
  chip.dataset.status = status;
  chip.textContent = status === 'ready' ? 'Ready' : status === 'building' ? 'Building…' : '—';
}

function setCardStatus(status) {
  cardStatus = status;
  const chip = $('#railCardStatus');
  if (!chip) return;
  chip.dataset.status = status;
  chip.textContent = status === 'ready' ? 'Ready' : status === 'building' ? 'Building…' : '—';
}

function narrate(text, { live = false } = {}) {
  const log = $('#railNarration');
  if (!log || !text) return;
  log.hidden = false;
  const line = document.createElement('div');
  line.className = 'rail__logline';
  const dot = document.createElement('span'); dot.className = 'rail__logdot';
  const t = document.createElement('span'); t.className = 'rail__logtext'; t.textContent = text;
  line.appendChild(dot); line.appendChild(t);
  if (live) {
    const badge = document.createElement('span');
    badge.className = 'rail__live';
    badge.textContent = 'LIVE';
    line.appendChild(badge);
  }
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

/* "Two more answers…" is exact when two remain; everything else is a
   sensible variant off the same number. state().questionsAhead is SAIFLOW's
   own count of questions still to come after the one on screen (it's what
   progressLabel's "A couple more / One more / Last question" is built from
   too) — so this rides the same number rather than re-deriving one from
   the percentage. */
function remainingCopy(ahead) {
  if (ahead == null) return 'A few more answers and it’s yours to see.';
  if (ahead <= 0) return 'Almost there — finishing the read.';
  if (ahead === 1) return 'One more answer and it’s yours to see.';
  if (ahead === 2) return RAIL_TWO_LEFT;
  return 'A few more answers and it’s yours to see.';
}

function updateRemaining(st) {
  const el = $('#railRemaining');
  if (!el) return;
  el.textContent = remainingCopy(st.questionsAhead);
}

function prettyDomain(d) {
  const host = String(d || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  const base = host.split('.')[0] || host;
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : '';
}

function companyLabel(research) {
  const s = window.SAI && window.SAI.session;
  const named = s && s.slots && s.slots.company;
  if (named) return named;
  const r = research || (s && s.research);
  if (r && r.name) return r.name;
  const domain = (s && s.slots && s.slots.company_domain) || (r && r.domain);
  return domain ? prettyDomain(domain) : null;
}

function updateCompanyTitle(research) {
  const el = $('#railCompanyTitle');
  if (!el) return;
  const name = companyLabel(research);
  el.textContent = name ? `${name} vs. your market` : 'Your snapshot';
}

/* ─────────────────────────── RESEARCH NARRATION ─────────────────────────── */

function onSaiEvent(e) {
  if (!active) return;
  const detail = e.detail || {};
  const { type, payload } = detail;
  if (type === 'research_started') return onResearchStarted(payload);
  if (type === 'research_step') return onResearchStep(payload);
  if (type === 'research_done') return onResearchDone(payload);
}

function onResearchStarted(payload) {
  setCardStatus('building');
  setModuleStatus('competitive', 'building');
  setModuleStatus('aisearch', 'building');
  setModuleStatus('brand', 'building');
  narrate(`Starting the read on ${(payload && payload.domain) || 'your brand'}…`);
  updateCompanyTitle();
}

function onResearchStep(payload) {
  if (!payload) return;
  narrate(payload.label || payload.step, { live: !!payload.live });
  if (payload.step === 'peers') setModuleStatus('competitive', 'ready');
  if (payload.step === 'signals') setModuleStatus('brand', 'ready');
}

function onResearchDone(payload) {
  setModuleStatus('aisearch', 'ready');
  setModuleStatus('competitive', 'ready');
  setModuleStatus('brand', 'ready');
  setCardStatus('ready');
  narrate('Snapshot ready.');
  updateCompanyTitle(payload && payload.research);
}

/* ─────────────────────────── LAYOUT MOUNT / TEARDOWN ─────────────────────────── */

const RAIL_BREAK = matchMedia('(max-width:900px)');

function placeRail() {
  const rail = $('#snapshotRail');
  const { chatPanel, promptForm } = els();
  const wrap = $('#convoWrap');
  if (!rail) return;
  if (RAIL_BREAK.matches) {
    if (chatPanel && promptForm && rail.parentElement !== chatPanel) chatPanel.insertBefore(rail, promptForm);
    rail.classList.add('convo__rail--strip');
  } else {
    if (wrap && rail.parentElement !== wrap) wrap.appendChild(rail);
    rail.classList.remove('convo__rail--strip');
  }
}
RAIL_BREAK.addEventListener ? RAIL_BREAK.addEventListener('change', placeRail)
  : RAIL_BREAK.addListener && RAIL_BREAK.addListener(placeRail);

function mountLayout() {
  if ($('#convoWrap')) return;
  const { hero, heroIn, chat, solveChips, thread, promptInput, prompt } = els();
  hero.classList.add('is-chatting', 'is-convo');
  if (solveChips) solveChips.hidden = true;
  if (thread) thread.hidden = false;
  /* whatever the visitor typed to get here (their opening message, or a
     chip's pre-filled label) becomes the flow's initialText/chipLabel — it
     doesn't belong sitting in the box once the conversation owns it */
  if (promptInput) promptInput.value = '';
  if (prompt) prompt.classList.remove('is-ready');

  const progress = document.createElement('div');
  progress.className = 'convo__progress';
  progress.id = 'convoProgress';
  progress.innerHTML = `<span class="convo__progress-label" id="convoProgressLabel">A couple more questions</span>
    <span class="convo__progress-bar"><i id="convoProgressFill"></i></span>`;
  heroIn.insertBefore(progress, chat);

  const wrap = document.createElement('div');
  wrap.className = 'convo';
  wrap.id = 'convoWrap';
  heroIn.insertBefore(wrap, chat);

  const mainCol = document.createElement('div');
  mainCol.className = 'convo__main';
  wrap.appendChild(mainCol);
  mainCol.appendChild(chat);   // moves the existing chat node — listeners intact

  const railCol = document.createElement('aside');
  railCol.className = 'convo__rail';
  railCol.id = 'snapshotRail';
  railCol.setAttribute('aria-label', 'Your snapshot');
  railCol.innerHTML = railTemplate();
  wrap.appendChild(railCol);

  const railHead = $('.rail__head', railCol);
  if (railHead) railHead.addEventListener('click', () => {
    if (railCol.classList.contains('convo__rail--strip')) railCol.classList.toggle('is-open');
  });

  placeRail();
  wireStick($('#thread'));
}

function teardown() {
  const wrap = $('#convoWrap');
  const progress = $('#convoProgress');
  const { heroIn, chat, hero } = els();
  const rail = $('#snapshotRail');
  if (rail) rail.remove();
  if (wrap && chat && heroIn) heroIn.insertBefore(chat, wrap);
  if (wrap) wrap.remove();
  if (progress) progress.remove();
  if (hero) hero.classList.remove('is-convo');
  active = false; busy = false; finished = false; lastQuestionId = null;
  waitingBubble = null; lastProgressPct = 0;
  moduleStatus.competitive = moduleStatus.aisearch = moduleStatus.brand = 'idle';
  cardStatus = 'idle';
}

/* ─────────────────────────── FLOW DRIVER ─────────────────────────── */

function render() {
  if (!active) return;
  const FLOW = window.SAIFLOW;
  if (!FLOW) return;
  const st = FLOW.state() || {};
  updateProgress(st);
  updateRemaining(st);
  updateCompanyTitle();

  if (st.phase === 'asking' && st.question) {
    if (st.question.id !== lastQuestionId) {
      lastQuestionId = st.question.id;
      removeWaitingBubble();
      const body = addAgentBubble(st.question.copy);
      if (Array.isArray(st.question.chips) && st.question.chips.length) renderChips(body, st.question.chips);
      updateComposerForQuestion(st.question);
    }
  } else if (st.phase === 'waiting-research') {
    addWaitingBubble(st.waitingLabel);
  } else if (st.phase === 'done') {
    finish();
  }
}

async function handleAnswer(value, label) {
  if (busy || !active) return;
  busy = true;
  clearChips();
  addUserBubble(label != null ? label : value);
  const { promptInput, prompt } = els();
  if (promptInput) promptInput.value = '';
  if (prompt) prompt.classList.remove('is-ready');
  try { await window.SAIFLOW.answer(value); }
  catch (e) { /* the flow owns retry/error copy; convo just keeps rendering whatever state it lands on */ }
  busy = false;
  render();
}

function finish() {
  if (finished) return;
  finished = true;
  removeWaitingBubble();

  const FLOW = window.SAIFLOW;
  const result = (FLOW && typeof FLOW.result === 'function') ? FLOW.result() : null;
  const session = (result && result.session) || (window.SAI && window.SAI.session) || {};
  const domain = (session.slots && session.slots.company_domain) || null;

  setCardStatus('ready');
  setModuleStatus('competitive', 'ready');
  setModuleStatus('aisearch', 'ready');
  setModuleStatus('brand', 'ready');
  const remaining = $('#railRemaining');
  if (remaining) remaining.textContent = 'Ready to see.';

  if (domain) {
    addAgentBubble('Here’s your live read — the full snapshot view is on its way.');
    /* stay "active" through the handoff delay so a stray submit in this
       window reaches SAIFLOW.answer() (a safe no-op once phase is 'done')
       instead of b.js reading active()===false and restarting begin() on
       top of the startDashboard call about to land */
    setTimeout(() => {
      active = false;
      if (typeof window.startDashboard === 'function') window.startDashboard(domain);
    }, REDUCED ? 30 : 650);
  } else {
    addAgentBubble('I don’t have a website to read yet — paste one whenever you’re ready ' +
      '(like <em>nike.com</em>) and I’ll pull a live snapshot together.');
    const { promptInput } = els();
    if (promptInput) { promptInput.disabled = false; promptInput.placeholder = 'Paste your website…'; }
    active = false; // hands the composer straight to the old flow, idling at
                     // its first ("paste your website") step, ready for one
  }
}

/* ─────────────────────────── ENTRY ─────────────────────────── */

function matchingChip(text) {
  const data = window.SAI && window.SAI.data;
  const q1 = data && data.questions && (data.questions.questions || []).find(q => q.id === 'q1');
  const chips = (q1 && q1.chips) || [];
  const norm = s => String(s || '').trim().toLowerCase();
  return chips.find(c => norm(c.label) === norm(text)) || null;
}

async function bootstrap(raw) {
  mountLayout();
  try { history.pushState({}, '', '/chat'); } catch (e) { /* fine, still works without a real route */ }

  try { if (window.SAI && window.SAI.ready) await window.SAI.ready; } catch (e) { /* degrade gracefully */ }

  const chip = matchingChip(raw);
  const startArgs = chip ? { chipLabel: chip.label } : { initialText: raw };

  if (typeof window.SAIFLOW.onChange === 'function') window.SAIFLOW.onChange(render);

  try { await window.SAIFLOW.start(startArgs); }
  catch (e) { /* SAIFLOW owns its own error copy; render() below still reflects whatever state it left */ }

  render();
}

document.addEventListener('sai:event', onSaiEvent);
window.addEventListener('popstate', () => {
  if (location.pathname === '/chat') return;
  if ($('#convoWrap')) teardown();
  if (typeof window.resetLanding === 'function') window.resetLanding();
  else location.href = '/';
});

window.SAICONVO = {
  begin(raw) {
    if (!window.SAIFLOW) return false;
    if (active) return true;
    active = true;
    bootstrap(raw);
    return true;
  },
  active: () => active,
  submit(raw) {
    const text = (raw || '').trim();
    if (!text) { shakePrompt(); return; }
    const { promptInput } = els();
    if (promptInput && promptInput.disabled) { shakePrompt(); return; }
    if (busy) return;
    handleAnswer(text, text);
  },
};

})();
