/* ═══════════════════════════════════════════════════════════════════════════
   HERO AGENT — the homepage conversation, drawn from state (client,
   2026-09-09: "the AI chatbot needs to actually work … then give you a form
   with your name, email, phone number"; brief, 2026-09-10: goals → adaptive
   questions → contact → a personal recommendation, deterministic underneath).

   The box on the homepage (#agentForm / #agentThread, drawn by home.js) is
   driven by window.SAIKIMI (kimi-flow.js). Nothing here decides anything about
   the visitor: it renders what SAIKIMI.state() says — a question and its
   suggestions, the contact form, or the recommendation cards — and hands
   answers back with SAIKIMI.answer() / SAIKIMI.contact().

   The shape of a visit:
     1. a starting point is tapped, or a sentence typed          → SAIKIMI.start()
     2. the agent asks the questions that separate the products
        still in the running; pills or free text, always both   → SAIKIMI.answer()
     3. confident enough: "See your recommendation" — name,
        business email, phone — in a compact form, in the thread → SAIKIMI.contact()
     4. the recommendation cards: one best fit, up to two also
        worth considering; CTAs from the catalog only            → SAIKIMI.clicked()

   House rules kept: the full email address never enters an event (engine.js
   redacts; analytics.js refuses PII keys outright); the product is named as
   the closest fit, never as a promise; every URL comes from data/solutions.json.

   home.js exposes the drawing helpers as window.SAIHERO (me, ai, wait, open,
   close, placeholder, think, esc). This file wires the field, the tags, the
   form and the cards.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const H = window.SAIHERO, K = window.SAIKIMI, S = window.SAI;
if (!H || !K || !S) return;

const $ = (sel, root) => (root || document).querySelector(sel);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MIN_BEAT = REDUCED ? 0 : 650;   /* the agent never answers faster than a person reads */
/* a mouse, not a finger: on a touch screen an unasked-for focus raises the
   keyboard over half the page, so a pill tap must not do it */
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;

let started = false, busy = false, ended = false, lastKey = null, formBubble = null;
let waitEl = null, shownFindings = false;
let lastVia = 'type';                 /* how the visitor sent the last turn: 'type' | 'chip' */

/* ── THE CARET LIVES IN THE FIELD ──
   A conversation you cannot type into is not a conversation (client,
   2026-09-10: "I need to click around the text input for my typing to be
   recognized"). Two things drop focus on the floor:

     · a chip that has just been answered is DISABLED, and a disabled element
       loses focus — it lands on <body>, where keystrokes go nowhere;
     · the bar's chat bubble opens the overlay, and closing it hands focus
       back to the bubble (home.js closeChat) — the question travels to this
       box but the caret does not follow it.

   So the caret is put back at the start of every turn and again when the next
   question is drawn. Two restraints: never take focus away from something the
   visitor deliberately moved to OUTSIDE the chat (a nav link they tabbed to),
   and on a touch screen only raise the keyboard again when they were already
   typing. */
function refocus() {
  if (ended) return;
  if (!FINE && lastVia !== 'type') return;
  const el = document.activeElement;
  const loose = !el || el === document.body || el.closest('#agentForm, #agentTags');
  if (!loose) return;
  try { H.focus(); } catch (e) { /* a closed composer cannot take the caret */ }
}

const pause = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));
const copy = () => ((S.data || {}).kimi || {}).copy || {};

/* ── drawing what the flow says ─────────────────────────────────────────── */
/* ── what the lookup found ──
   Only ever what came back real: the endpoint answers known:false rather than
   guess, and nothing here fills a gap. A domain it did not recognise gets one
   honest line and the conversation moves on. */
function drawFindings(st) {
  if (shownFindings || !st.researched) return;
  shownFindings = true;
  const c = copy(), r = c.research || {}, L = r.labels || {};
  const f = st.findings;
  if (!f) {
    if (st.website && st.website !== '__skip__') H.ai(H.esc(tpl(r.notFound, { domain: st.website })), null, null, null);
    return;
  }
  const rows = [];
  if (f.industry) rows.push([L.industry || 'Industry', f.industry]);
  if (f.companySize) rows.push([L.size || 'Size', (r.sizeBands || {})[f.companySize] || f.companySize]);
  if (f.competitors && f.competitors.length) rows.push([L.competitors || 'Compared with', f.competitors.join(', ')]);
  const head = f.name ? tpl(r.foundHeader, { name: f.name }) : tpl(r.foundHeaderNoName, { domain: f.domain });
  const bubble = H.ai(H.esc(head), null, null, null);
  if (rows.length) {
    bubble.insertAdjacentHTML('beforeend',
      '<dl class="found">' + rows.map(([k, v]) =>
        '<div class="found__row"><dt>' + H.esc(k) + '</dt><dd>' + H.esc(v) + '</dd></div>').join('') + '</dl>');
  }
}

const tpl = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? '' : String(vars[k])));

function render(st) {
  if (!st || ended) return;
  if (st.uiAction === 'ASK') {
    drawFindings(st);
    const key = 'ask|' + (st.question ? st.question.id : '') + '|' + st.message;
    if (key === lastKey) return;
    lastKey = key;
    H.ai(H.esc(st.message || ''), st.suggestions.map(s => ({ label: s.label, value: s.value })), null, chip => send(chip.value, chip.label));
    H.placeholder(st.hint || (st.question && st.question.field === 'website' ? ((copy().hints || {}).website || 'yourcompany.com') : 'Type your answer…'));
    refocus();
    return;
  }
  if (st.uiAction === 'CAPTURE_CONTACT') {
    if (lastKey === 'contact') return;
    lastKey = 'contact';
    drawFindings(st);
    drawForm(st);
    return;
  }
  if (st.uiAction === 'SHOW_RECOMMENDATIONS' || st.uiAction === 'COMPLETE') {
    if (lastKey === 'cards') return;
    lastKey = 'cards';
    drawCards(st);
  }
}

K.onChange(st => {
  /* mid-turn the thread is showing the thinking dots; the only thing worth
     saying over them is which site is being read */
  if (busy) {
    if (st && st.uiAction === 'READING' && waitEl && st.message) {
      const label = waitEl.querySelector('.turnb__waitlabel');
      if (label) label.textContent = st.message;
      else waitEl.insertAdjacentHTML('beforeend', '<span class="turnb__waitlabel">' + H.esc(st.message) + '</span>');
    }
    return;
  }
  render(st);
});

/* ── one turn ───────────────────────────────────────────────────────────── */
/* a pill's words → the goal/domain it carries, so the same words typed into
   the overlay and handed to this box start the flow the same deterministic way */
function pillFor(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return null;
  return [...document.querySelectorAll('#agentTags .tag[data-domain], #agentTags .tag[data-goal]')]
    .find(x => String(x.dataset.q || x.textContent).trim().toLowerCase() === t) || null;
}

async function send(raw, label, seed) {
  const v = String(raw == null ? '' : raw).trim();
  if (!v || busy || ended) return;
  let goal = seed && seed.goal, domain = seed && seed.domain;
  if (!started && !goal && !domain) { const b = pillFor(v); if (b) { goal = b.dataset.goal || null; domain = b.dataset.domain || null; } }
  busy = true;
  lastVia = (label != null || (seed && (seed.goal || seed.domain))) ? 'chip' : 'type';
  H.open();
  H.me(label != null ? label : v);
  H.settleChips();
  refocus();          /* the chip just answered is disabled now; the caret goes back to the field */
  const w = H.wait();
  waitEl = w;
  const t0 = Date.now();
  try {
    if (!started) {
      started = true;
      /* a pill is a goal, not a sentence to interpret: the flow takes it and
         asks that goal's own first question */
      await K.start((goal || domain) ? { chipLabel: v, goal: goal || null, domain: domain || null } : { initialText: v });
    } else await K.answer(v);
  } catch (e) { /* the flow owns its error copy; whatever state it left is drawn below */ }
  await pause(MIN_BEAT - (Date.now() - t0));
  w.remove(); H.think.off();
  waitEl = null;
  busy = false;
  render(K.state());
}

/* ── the contact form (brief §24–§26): one compact form, not three turns ── */
function formHtml(st) {
  const c = copy();
  const f = c.contactFields || {};
  /* the words follow what they asked for: "Book a demo" for a demo, "Request
     a call" for a call, the recommendation wording for the ordinary path */
  const k = st.contact || {};
  const title = k.title || c.contactTitle || 'See your recommendation';
  const submit = k.submit || c.contactSubmit || 'Show my recommendations';
  const notice = H.esc(k.notice || c.contactNotice || '');
  const noticeHtml = c.contactNoticeUrl
    ? notice.replace(/privacy notice/i, m => '<a href="' + H.esc(c.contactNoticeUrl) + '" target="_blank" rel="noopener">' + m + '</a>')
    : notice;
  return '<div class="turnb__text">' + H.esc(st.message || '') + '</div>' +
    /* a <div>, not a <form>: the thread sits inside #agentForm and a nested
       form tag is dropped by the parser, so the fields are wired by hand */
    '<div class="askform" id="heroLeadForm" role="form" aria-label="' + H.esc(title) + '">' +
      '<p class="askform__title">' + H.esc(title) + '</p>' +
      '<label class="askform__row" data-field="name"><span class="askform__label">' + H.esc(f.name || 'Full name') + '</span><input name="name" type="text" autocomplete="name" required></label>' +
      '<label class="askform__row" data-field="email"><span class="askform__label">' + H.esc(f.email || 'Business email') + '</span><input name="email" type="email" autocomplete="email" inputmode="email" required></label>' +
      '<label class="askform__row" data-field="phone"><span class="askform__label">' + H.esc(f.phone || 'Phone') + '</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" required></label>' +
      '<p class="askform__hint" id="heroLeadHint" hidden></p>' +
      '<div class="askform__bar"><button class="btn btn--ink askform__go" type="button">' + H.esc(submit) + '</button></div>' +
      '<p class="askform__fine">' + noticeHtml + '</p>' +
    '</div>';
}

function shake(row, hint, text) {
  if (hint) { hint.textContent = text || ''; hint.hidden = !text; }
  if (!row) return;
  row.classList.remove('is-shake');
  void row.offsetWidth;   /* restart the animation */
  row.classList.add('is-shake');
}

function drawForm(st) {
  const c = copy();
  const bubble = H.ai(null, null, null, null);
  bubble.classList.add('turnb--form');
  bubble.innerHTML = formHtml(st);
  formBubble = bubble;
  H.close((st.contact && st.contact.closed) || c.composerClosedForm || 'Leave your details above to see your recommendation.');

  const form = $('#heroLeadForm', bubble);
  const hint = $('#heroLeadHint', bubble);
  const rows = { name: $('[data-field=name]', form), email: $('[data-field=email]', form), phone: $('[data-field=phone]', form) };
  const inputs = { name: $('[name=name]', form), email: $('[name=email]', form), phone: $('[name=phone]', form) };
  const go = $('.askform__go', form);
  Object.values(inputs).forEach(i => i.addEventListener('input', () => { if (hint && !hint.hidden) hint.hidden = true; i.closest('.askform__row').classList.remove('is-shake'); }));

  let sending = false;
  const submit = async () => {
    if (sending) return;
    const lead = { name: inputs.name.value, email: inputs.email.value, phone: inputs.phone.value };
    /* the shape checks answer at once, before anything is sent */
    const v = K.validate(lead);
    if (!v.ok) { if (rows[v.error]) { shake(rows[v.error], hint, v.message); inputs[v.error].focus(); } else shake(null, hint, v.message); return; }
    sending = true;
    const label = go.textContent;
    go.disabled = true; go.textContent = c.contactSubmitting || 'Sending…';
    const t0 = Date.now();
    let res;
    try { res = await K.contact(lead); } catch (e) { res = { ok: false, retry: true, message: (c.contactErrors || {}).failed }; }
    await pause(MIN_BEAT - (Date.now() - t0));
    sending = false;
    if (!res.ok) {
      go.disabled = false; go.textContent = label;
      if (res.error && rows[res.error]) { shake(rows[res.error], hint, res.message); inputs[res.error].focus(); }
      else shake(null, hint, res.message || (c.contactErrors || {}).failed);
      return;
    }
    render(K.state());
  };
  go.addEventListener('click', submit);
  /* Enter in any field sends the details, and never the hero's own form */
  Object.values(inputs).forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submit(); } }));
  /* the thread no longer scrolls inside itself once the form is on it (home.css),
     so the page is brought to the form's title rather than its last field */
  setTimeout(() => {
    try { $('.askform__title', form).scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' }); } catch (e) {}
    try { inputs.name.focus({ preventScroll: true }); } catch (e) {}
  }, 80);
}

/* ── the recommendation (brief §20–§23): cards from view models ─────────── */
function drawCards(st) {
  const c = copy();
  const CARDS = window.SAICARDS;
  const html = (CARDS && st.cards.length) ? CARDS.renderCards(st.cards, c, H.esc) : '';
  const target = formBubble || H.ai(null, null, null, null);
  target.classList.remove('turnb--form');
  target.classList.add('turnb--reco');
  target.innerHTML = '<div class="turnb__text">' + H.esc(st.message || '') + '</div>' + html +
    (st.after ? '<p class="reco__after">' + H.esc(st.after) + '</p>' : '');
  H.close(c.composerClosed || 'Your recommendation is above.');
  ended = true;

  /* every CTA is recorded; the booking modal (lead.js, [data-cta]) or the
     catalog URL does the rest */
  target.querySelectorAll('[data-kimi-cta]').forEach(el => el.addEventListener('click', () => {
    try { K.clicked(el.dataset.kimiCta, el.dataset.kimiProduct, el.getAttribute('href')); } catch (e) {}
  }));
  try { target.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' }); } catch (e) {}
}

/* ── wiring: the field, the starting points, the overlay's hand-offs ───── */
const form = $('#agentForm'), input = $('#agentInput');
form.addEventListener('submit', e => {
  e.preventDefault();
  if (ended) return;
  const v = input.value.trim();
  if (!v) { input.focus(); return; }
  input.value = '';
  send(v);
});
document.querySelectorAll('#agentTags .tag').forEach(b => b.addEventListener('click', () =>
  send(b.dataset.q || b.textContent.trim(), null, { goal: b.dataset.goal || null, domain: b.dataset.domain || null })));

/* a prefilled question in the URL starts the conversation: /?q=… */
try {
  const q = new URLSearchParams(location.search).get('q');
  if (q && q.trim()) setTimeout(() => send(q.trim()), REDUCED ? 0 : 500);
} catch (e) { /* no URL, no start */ }

window.SAIHEROAGENT = { send, state: () => ({ started, busy, finished: ended }) };
})();
