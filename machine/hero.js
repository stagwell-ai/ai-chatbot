/* ═══════════════════════════════════════════════════════════════════════════
   HERO — the landing as a chooser, not a blank prompt.

   The client, pointing at Meta's ad-objective dialog: "we want to continue
   using the phrase 'What do you need help solving today?' but we want to
   have the user select from a few options. on the lower right there would be
   a button 'Ask AI' and to the left of it a text input 'My business email'…
   after they click the button, then we go to the ai chat window with the
   first conversation put in already of which option they selected."

   So this file renders that dialog and nothing else:

     · a radio list of what the visitor might be solving, LEFT;
     · a detail pane for whichever row is focused, RIGHT — what that choice
       means and what it is good for, the shape Meta's panel uses;
     · a footer bar, the business email beside the Ask AI button.

   WHERE THE OPTIONS COME FROM. data/questions.json q1.chips — the same list
   the conversation's first question uses. That is the point: the picker IS
   q1, asked on the landing, so the choice arrives in the flow as a real chip
   answer (deterministic domain, no classifier round-trip) rather than as
   text the machine has to interpret. Detail copy is hero.byDomain, keyed by
   the same domain ids. One data edit changes both surfaces.

   THE EMAIL IS NOT A TOLL. It buys the visitor something immediately: the
   company comes out of its domain, research starts on it before they answer
   another question, and q2 is skipped because we no longer need to ask. A
   personal address can't do that, which is what the refusal copy says.

   WHAT IT NEVER DOES: invent a domain, keep the address anywhere but the
   session, or send it to an event — capture_email carries the domain only,
   the same rule every other capture on the site follows.

   window.SAIHERO:
     .mounted()   → true once the picker is on the page
     .select(id)  → choose an option programmatically (tests, deep links)
     .state()     → { option, email, error } for the suites
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const root = document.getElementById('heroPick');
if (!root) return;

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const $ = (s, r = document) => r.querySelector(s);

/* the copy floor: if data/questions.json fails to load, the picker still
   renders something honest rather than an empty box */
const FALLBACK = {
  title: 'What do you need help solving today?',
  sub: '',
  listLabel: "Choose what you're solving",
  emailLabel: 'My business email',
  emailHint: '',
  submit: 'Ask AI',
  otherLabel: "Something else — I'll describe it",
  otherLine: 'Describe the problem in your own words, or paste your website.',
  otherPlaceholder: 'Describe your problem — or paste your website',
  otherGoodFor: [],
  personalDomains: ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com'],
  errors: {
    noOption: "Pick what you're solving first — that's where the agent starts.",
    noEmail: 'We need your business email to get started.',
    badEmail: "That doesn't look like an email address yet — check it over.",
    personalEmail: 'That’s a personal address — please use your work email.',
    noText: "Tell the agent what you're solving and it will take it from there."
  },
  byDomain: {}
};

const OTHER = '__other__';

/* ── icons: one per option, drawn rather than imported so the row has a mark
      at the same weight as Meta's, with nothing to load ─────────────────── */
const ICONS = {
  brand_health: '<path d="M3 14.5 7 9l3.2 3.6L15 5.5" /><path d="M11.6 5.5H15v3.4" />',
  competitive: '<rect x="2.6" y="9" width="3.4" height="6.4" rx="1"/><rect x="8.3" y="5.4" width="3.4" height="10" rx="1"/><rect x="14" y="7.4" width="3.4" height="8" rx="1"/>',
  ai_visibility: '<circle cx="9" cy="9" r="5.6"/><path d="M13.2 13.2 17 17"/>',
  influencer: '<circle cx="7.4" cy="6.6" r="2.8"/><path d="M2.8 15.4c0-2.6 2.1-4.2 4.6-4.2s4.6 1.6 4.6 4.2"/><path d="M13.4 5.2a2.6 2.6 0 0 1 0 5"/><path d="M14.4 11.6c1.7.5 2.9 1.8 2.9 3.8"/>',
  audiences: '<path d="M10 2.6 17 6.4 10 10.2 3 6.4z"/><path d="M3 10.4 10 14.2l7-3.8"/>',
  research: '<path d="M4.4 3.4h11v13h-11z"/><path d="M7 7h5.4M7 10h5.4M7 13h3"/>',
  __other__: '<circle cx="10" cy="10" r="7.2"/><path d="M7.8 8a2.3 2.3 0 1 1 2.6 2.3v1.2"/><path d="M10.4 14.1h.01"/>'
};
const icon = id => `<svg class="pick__icon" viewBox="0 0 20 20" aria-hidden="true" fill="none"
  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${
  ICONS[id] || ICONS[OTHER]}</svg>`;

/* ── state ───────────────────────────────────────────────────────────────── */
let COPY = FALLBACK;
let OPTIONS = [];
let selected = null;      /* option id (a routing domain, or __other__) */
let lastError = null;

const optionById = id => OPTIONS.find(o => o.id === id) || null;

/* ── the email rule ──────────────────────────────────────────────────────── */
function emailDomain(value) {
  const m = String(value == null ? '' : value).trim().toLowerCase()
    .match(/^[^\s@]+@([a-z0-9.-]+\.[a-z]{2,})$/);
  return m ? m[1] : null;
}

function isPersonal(domain) {
  const list = Array.isArray(COPY.personalDomains) ? COPY.personalDomains : [];
  return list.indexOf(String(domain || '').toLowerCase()) !== -1;
}

/* returns null when the address is usable, else the error key to show */
function emailProblem(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return 'noEmail';
  const domain = emailDomain(raw);
  if (!domain) return 'badEmail';
  if (isPersonal(domain)) return 'personalEmail';
  return null;
}

/* ── render ──────────────────────────────────────────────────────────────── */
function rowHTML(o, i) {
  return `<button type="button" class="pick__row" role="radio" aria-checked="false"
      id="pickRow-${esc(o.id)}" data-pick="${esc(o.id)}" tabindex="${i === 0 ? '0' : '-1'}">
      <span class="pick__radio" aria-hidden="true"></span>
      <span class="pick__mark" aria-hidden="true">${icon(o.id)}</span>
      <span class="pick__label">${esc(o.label)}</span>
    </button>`;
}

/* THE EMPTY PANE — what stands there before a row is chosen.

   Meta puts an illustration in this space; ours was a line of grey text,
   which reads as a hole in the card ("it shouldn't be blank and boring").
   So the pane shows the thing the visitor is about to get: the snapshot,
   abstracted — bars, a trend line through them, a momentum ring.

   It is DRAWN, not loaded: inline SVG in the brand's own colours, so there
   is no asset to fetch, nothing to go stale, and it scales with the card.
   It is also deliberately abstract — no numbers, no axis labels, nothing a
   reader could mistake for a claim about anybody's brand. */
const EMPTY_ART = `
<svg class="pick__illo" viewBox="0 0 320 200" role="img" aria-hidden="true" fill="none">
  <defs>
    <linearGradient id="pickGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" class="pick__illo-g1"/><stop offset="1" class="pick__illo-g2"/>
    </linearGradient>
  </defs>
  <circle cx="252" cy="42" r="58" fill="url(#pickGlow)"/>
  <circle cx="62" cy="168" r="40" fill="url(#pickGlow)"/>

  <rect class="pick__illo-card" x="38" y="28" width="244" height="146" rx="16"/>

  <g class="pick__illo-bars">
    <rect class="pick__illo-bar" x="68"  y="112" width="26" height="40" rx="6" style="--d:0ms"/>
    <rect class="pick__illo-bar" x="108" y="90"  width="26" height="62" rx="6" style="--d:70ms"/>
    <rect class="pick__illo-bar" x="148" y="102" width="26" height="50" rx="6" style="--d:140ms"/>
    <rect class="pick__illo-bar pick__illo-bar--you" x="188" y="66" width="26" height="86" rx="6" style="--d:210ms"/>
  </g>
  <line class="pick__illo-base" x1="58" y1="152.5" x2="262" y2="152.5"/>

  <polyline class="pick__illo-line" points="81,122 121,100 161,110 201,76"/>
  <circle class="pick__illo-dot" cx="81"  cy="122" r="3.4"/>
  <circle class="pick__illo-dot" cx="121" cy="100" r="3.4"/>
  <circle class="pick__illo-dot" cx="161" cy="110" r="3.4"/>
  <circle class="pick__illo-dot pick__illo-dot--you" cx="201" cy="76" r="4.6"/>

  <g transform="translate(238,52)">
    <circle class="pick__illo-ring-bg" r="21"/>
    <circle class="pick__illo-ring" r="21" transform="rotate(-90)"/>
  </g>
</svg>`;

function detailHTML(o) {
  if (!o) {
    return `<div class="pick__detail-empty">
      ${EMPTY_ART}
      <p class="pick__empty-h">${esc(COPY.emptyTitle || COPY.listLabel || '')}</p>
      ${COPY.emptyLine ? `<p class="pick__empty-l">${esc(COPY.emptyLine)}</p>` : ''}
    </div>`;
  }
  const tags = (o.goodFor || []).filter(Boolean);
  return `
    <div class="pick__art" aria-hidden="true">${icon(o.id)}</div>
    <h2 class="pick__dh">${esc(o.detailTitle || o.label)}</h2>
    <p class="pick__dl">${esc(o.line || '')}</p>
    ${tags.length ? `<p class="pick__dgood">Good for:</p>
      <ul class="pick__tags">${tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    ${o.id === OTHER ? `<label class="pick__free">
        <span class="vh">${esc(COPY.otherPlaceholder || '')}</span>
        <textarea id="pickFree" rows="3" placeholder="${esc(COPY.otherPlaceholder || '')}"></textarea>
      </label>` : ''}`;
}

function render() {
  root.innerHTML = `
    <div class="pick">
      <div class="pick__panes">
        <div class="pick__list" role="radiogroup" aria-label="${esc(COPY.listLabel || '')}" id="pickList">
          ${OPTIONS.map(rowHTML).join('')}
        </div>
        <div class="pick__detail" id="pickDetail">${detailHTML(null)}</div>
      </div>
      <div class="pick__foot">
        <p class="pick__err" id="pickErr" role="alert" hidden></p>
        <div class="pick__act">
          <label class="pick__email" id="pickEmailWrap">
            <span class="vh">${esc(COPY.emailLabel || 'Work email')}</span>
            <input id="pickEmail" type="email" inputmode="email" autocomplete="email"
              placeholder="${esc(COPY.emailLabel || 'Work email')}"
              aria-describedby="pickErr">
          </label>
          <button type="button" class="btn btn--gold pick__go" id="pickGo">${esc(COPY.submit || 'Ask AI')}</button>
        </div>
      </div>
    </div>`;
  wire();
}

function paintDetail() {
  const detail = $('#pickDetail', root);
  if (detail) detail.innerHTML = detailHTML(optionById(selected));
}

function select(id, opts) {
  const o = optionById(id);
  if (!o) return false;
  selected = id;
  root.querySelectorAll('.pick__row').forEach(b => {
    const on = b.getAttribute('data-pick') === id;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
    b.tabIndex = on ? 0 : -1;
  });
  paintDetail();
  clearError('noOption');
  if (opts && opts.focus === false) return true;
  const free = $('#pickFree', root);
  if (free && id === OTHER) free.focus();
  return true;
}

/* ── errors: the box is highlighted AND told why (client's ask) ─────────── */
function showError(key, focusEl) {
  const box = $('#pickErr', root);
  const wrap = $('#pickEmailWrap', root);
  const list = $('#pickList', root);
  lastError = key;
  const msg = (COPY.errors && COPY.errors[key]) || FALLBACK.errors[key] || '';
  if (box) { box.textContent = msg; box.hidden = false; }

  const onEmail = key === 'noEmail' || key === 'badEmail' || key === 'personalEmail';
  if (wrap) wrap.classList.toggle('is-bad', onEmail);
  if (list) list.classList.toggle('is-bad', key === 'noOption');

  const shakeTarget = onEmail ? wrap : (key === 'noOption' ? list : null);
  if (shakeTarget) {
    shakeTarget.classList.remove('is-shake');
    void shakeTarget.offsetWidth;                     /* restart the animation */
    shakeTarget.classList.add('is-shake');
    setTimeout(() => shakeTarget.classList.remove('is-shake'), 460);
  }
  if (focusEl) { try { focusEl.focus(); } catch (e) { /* never fatal */ } }
}

function clearError(onlyKey) {
  if (onlyKey && lastError !== onlyKey) return;
  lastError = null;
  const box = $('#pickErr', root);
  if (box) { box.hidden = true; box.textContent = ''; }
  const wrap = $('#pickEmailWrap', root);
  if (wrap) wrap.classList.remove('is-bad');
  const list = $('#pickList', root);
  if (list) list.classList.remove('is-bad');
}

/* ── the handoff ─────────────────────────────────────────────────────────── */
function engine() { return (typeof window !== 'undefined' && window.SAI) || null; }

/* The email pays for itself here: the company comes out of its domain, the
   session records where it came from, and research starts immediately —
   which is also why flow.js can skip q2 (see skipReason 'company_from_work_email'). */
function seedFromEmail(address) {
  const S = engine();
  const domain = emailDomain(address);
  if (!S || !domain) return null;
  try {
    S.setSlot('work_email', String(address).trim(), 'visitor');
    if (!S.session.slots.company_domain) S.setSlot('company_domain', domain, 'work_email');
    S.events.emit('capture_email', { domain, kind: 'hero' });
  } catch (e) { /* a slot the engine refuses is not worth losing the click over */ }
  return domain;
}

function go() {
  if (!selected) { showError('noOption', root.querySelector('.pick__row')); return; }

  const emailEl = $('#pickEmail', root);
  const problem = emailProblem(emailEl ? emailEl.value : '');
  if (problem) { showError(problem, emailEl); return; }

  const o = optionById(selected);
  let text = o.label;
  if (selected === OTHER) {
    const free = $('#pickFree', root);
    text = free ? free.value.trim() : '';
    if (!text) { showError('noText', free); return; }
  }

  clearError();
  seedFromEmail(emailEl ? emailEl.value : '');

  /* hand the whole hero over to the conversation, with this as its first
     answer already given — the visitor never sees q1 asked again */
  const hero = document.getElementById('hero2');
  if (hero) hero.classList.add('is-chatting');
  root.hidden = true;

  if (window.SAICONVO && typeof window.SAICONVO.begin === 'function' && window.SAICONVO.begin(text)) return;

  /* the conversation could not take over (no flow.js): put the visitor's
     words in the composer rather than swallowing them */
  const input = document.getElementById('promptInput');
  if (input) { input.value = text; input.focus(); }
  if (hero) hero.classList.remove('is-chatting');
  root.hidden = false;
}

function wire() {
  root.addEventListener('click', e => {
    const row = e.target.closest('[data-pick]');
    if (row) { select(row.getAttribute('data-pick')); return; }
    if (e.target.closest('#pickGo')) go();
  });

  /* a radiogroup answers to the arrow keys */
  root.addEventListener('keydown', e => {
    const row = e.target.closest('[data-pick]');
    if (!row) return;
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const rows = [...root.querySelectorAll('.pick__row')];
    const i = rows.indexOf(row);
    const next = rows[(i + keys[e.key] + rows.length) % rows.length];
    if (next) { next.focus(); select(next.getAttribute('data-pick'), { focus: false }); }
  });

  const email = $('#pickEmail', root);
  if (email) {
    /* the error clears itself the moment the address becomes usable — no
       second click needed to find out you fixed it */
    email.addEventListener('input', () => { if (lastError && !emailProblem(email.value)) clearError(); });
    email.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  }
}

/* ── data ────────────────────────────────────────────────────────────────── */
function build(data) {
  const q = data && data.questions;
  const hero = (q && q.hero) || {};
  COPY = Object.assign({}, FALLBACK, hero, {
    errors: Object.assign({}, FALLBACK.errors, hero.errors || {}),
    personalDomains: Array.isArray(hero.personalDomains) && hero.personalDomains.length
      ? hero.personalDomains : FALLBACK.personalDomains
  });

  const chips = (q && q.questions && (q.questions.find(x => x.id === 'q1') || {}).chips) || [];
  const by = hero.byDomain || {};
  OPTIONS = chips.filter(c => c && c.domain).map(c => Object.assign(
    { id: c.domain, label: c.label, detailTitle: (by[c.domain] || {}).title || c.label },
    by[c.domain] || {}
  ));
  OPTIONS.push({
    id: OTHER,
    label: COPY.otherLabel,
    detailTitle: COPY.otherLabel,
    line: COPY.otherLine,
    goodFor: COPY.otherGoodFor || []
  });

  /* the page's own headline and standfirst come from the same block, so the
     client tunes the whole hero with one data edit */
  const title = document.getElementById('hero2Title');
  const sub = document.getElementById('hero2Sub');
  const eyebrow = document.getElementById('heroEyebrow');
  if (title && COPY.title) {
    /* keep the site's two-tone display treatment: the last clause is accented */
    const m = String(COPY.title).match(/^(.*?)(\s)(\S+\s+\S+)$/);
    title.innerHTML = m ? `${esc(m[1])}${m[2]}<span class="accent">${esc(m[3])}</span>` : esc(COPY.title);
  }
  if (sub && COPY.sub) sub.textContent = COPY.sub;
  if (eyebrow && COPY.eyebrow) eyebrow.innerHTML = `<i class="pulse"></i>${esc(COPY.eyebrow)}`;

  render();
}

const DATA = (typeof window !== 'undefined' && window.STAGDATA) || null;
if (DATA && typeof DATA.then === 'function') DATA.then(build, () => build(null));
else build(DATA);

window.SAIHERO = {
  mounted: () => !!root.querySelector('.pick'),
  select: id => select(id),
  submit: () => go(),
  state: () => ({
    option: selected,
    email: ($('#pickEmail', root) || {}).value || '',
    error: lastError
  }),
  _emailProblem: emailProblem
};
})();
