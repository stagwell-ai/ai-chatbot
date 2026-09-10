/* ═══════════════════════════════════════════════════════════════════════════
   HERO AGENT — the homepage conversation, for real (client, 2026-09-09):
   "the AI chatbot needs to actually work and ask you questions about your
   business and then after 3-6 questions it needs to give you a form with your
   name, email, phone number, to be contacted by Stagwell AI".

   The box on the homepage (#agentForm / #agentThread, drawn by home.js) is
   driven here by the same machine the full agent page runs on: engine.js
   holds the session and the routing matrix, flow.js decides which of the six
   questions to ask and which to skip, research.js reads a website in the
   background. Nothing here decides anything about the visitor; it only draws
   what SAIFLOW.state() says and hands answers back with SAIFLOW.answer().

   The shape of a visit:
     1. the visitor types, or taps a starting point           → SAIFLOW.start()
     2. the agent asks its questions, one bubble each, with
        the chips flow.js gives it; free text always works    → SAIFLOW.answer()
     3. when the flow is done, the agent names the closest
        fit from SAI.route() and asks for name, email, phone
        so a Stagwell AI specialist can call                  → the form, inline
     4. submitted: the events the demo console reads, a POST
        to /api/lead (forwarded when LEAD_WEBHOOK_URL is set),
        a confirmation, and the composer closes.

   House rules kept: the full email address never enters an event (engine.js
   redacts to the domain); the product is named as "the closest fit", never
   as a promise; nothing invented about the visitor's company.

   home.js exposes the drawing helpers as window.SAIHERO (me, ai, wait, open,
   close, placeholder, think, esc). This file wires the form and the tags.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const H = window.SAIHERO, FLOW = window.SAIFLOW, S = window.SAI;
if (!H || !FLOW || !S) return;

const $ = (sel, root) => (root || document).querySelector(sel);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MIN_BEAT = REDUCED ? 0 : 650;   /* the agent never answers faster than a person reads */
const KIND = 'specialist';            /* the CTA kind the events carry */
const HUMAN_TEXT = 'Talk to a Stagwell AI specialist';

let started = false, busy = false, finished = false, lastKey = null, waitEl = null;

const pause = ms => new Promise(r => setTimeout(r, Math.max(0, ms)));
const emit = (type, payload) => { try { S.events.emit(type, payload); } catch (e) { /* the log never costs a lead */ } };

/* the qualifying fact, and the only part of the address that is ever logged */
function emailDomain(email) {
  const m = String(email == null ? '' : email).trim().toLowerCase().match(/^[^\s@]+@([a-z0-9.-]+\.[a-z]{2,})$/);
  return m ? m[1] : null;
}

function chipsOf(q) {
  return (q && q.chips || []).filter(c => c && !c.placeholder && c.label).map(c => ({ label: c.label, value: c.value }));
}

/* the field's hint follows the question: a company wants a website, the rest want words */
function hintFor(q) {
  if (!q) return 'Type your answer…';
  if (q.id === 'q2') return 'Your company or website…';
  if (q.id === 'q4') return 'Roughly how many people?';
  return q.chips && q.chips.length ? 'Pick one, or type your answer…' : 'Type your answer…';
}

/* ── drawing what the flow says ─────────────────────────────────────────── */
function render(st) {
  if (finished) return;
  if (waitEl) { waitEl.remove(); waitEl = null; H.think.off(); }
  if (!st) return;
  if (st.phase === 'waiting-research') { waitEl = H.wait(st.waitingLabel || 'Reading the site…'); return; }
  if (st.phase === 'done') { finish(); return; }
  const q = st.question;
  if (!q) return;
  const key = q.id + '|' + q.copy;
  if (key === lastKey) return;
  lastKey = key;
  H.ai(H.esc(q.copy || ''), chipsOf(q), null, chip => send(chip.value, chip.label));
  H.placeholder(hintFor(q));
}

/* onChange fires inside start()/answer() too; those paths render themselves
   after the beat, so only the asynchronous changes (research landing, q4
   turning into a confirm) are drawn from here */
FLOW.onChange(st => { if (!busy) render(st); });

/* ── one turn ───────────────────────────────────────────────────────────── */
async function send(raw, label) {
  const v = String(raw == null ? '' : raw).trim();
  if (!v || busy || finished) return;
  busy = true;
  H.open();
  H.me(label != null ? label : v);
  H.settleChips();
  const w = H.wait();
  const t0 = Date.now();
  try {
    if (!started) { started = true; await FLOW.start({ initialText: v }); }
    else await FLOW.answer(v);
  } catch (e) { /* the flow owns its error copy; whatever state it left is drawn below */ }
  await pause(MIN_BEAT - (Date.now() - t0));
  w.remove(); H.think.off();
  busy = false;
  render(FLOW.state());
}

/* ── the end: the closest fit, then the form ────────────────────────────── */
function closestFit() {
  let r = null;
  try { r = FLOW.result(); } catch (e) { r = null; }
  const route = (r && r.route) || null;
  const top = route && Array.isArray(route.matched) && route.matched[0];
  const name = (top && top.solution) || null;
  let id = null;
  try {
    const list = ((S.data || {}).solutions || {}).solutions || [];
    const hit = list.find(x => x && x.name && name && x.name.toLowerCase() === String(name).toLowerCase());
    id = hit ? hit.id : null;
  } catch (e) { id = null; }
  return { route: route ? route.route : null, name, id, domains: route ? route.matched.map(m => m.domain) : [] };
}

function formHtml(fit, company) {
  const lead = 'Thanks — that’s everything I need.' +
    (fit.name ? ' From what you’ve told me, <b>' + H.esc(fit.name) + '</b> looks like the closest fit' + (company ? ' for <b>' + H.esc(company) + '</b>' : '') + '.' : '') +
    ' Leave your details and a Stagwell AI specialist will contact you to walk you through which Stagwell AI product is best for you.';
  return '<div class="turnb__text">' + lead + '</div>' +
    /* a <div>, not a <form>: the thread sits inside #agentForm and a nested
       form tag is dropped by the parser, so the fields are wired by hand */
    '<div class="askform" id="heroLeadForm" role="form" aria-label="Your details">' +
      '<label class="askform__row"><span class="vh">Full name</span><input name="name" type="text" autocomplete="name" placeholder="Full name" required></label>' +
      '<label class="askform__row" id="heroLeadEmailRow"><span class="vh">Work email</span><input name="email" type="email" autocomplete="email" inputmode="email" placeholder="Work email" required></label>' +
      '<label class="askform__row"><span class="vh">Phone number</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="Phone number"></label>' +
      '<p class="askform__hint" id="heroLeadHint" hidden></p>' +
      '<div class="askform__bar"><button class="btn btn--ink askform__go" type="button">Contact me</button>' +
      '<span class="askform__fine">We only use these to get in touch about Stagwell AI.</span></div>' +
    '</div>';
}

function shake(row, hint, text) {
  if (hint) { hint.textContent = text; hint.hidden = false; }
  if (!row) return;
  row.classList.remove('is-shake');
  void row.offsetWidth;   /* restart the animation */
  row.classList.add('is-shake');
}

function finish() {
  if (finished) return;
  finished = true;
  const fit = closestFit();
  const company = (FLOW.state() || {}).company || null;
  const bubble = H.ai(null, null, null, null);
  bubble.classList.add('turnb--form');
  bubble.innerHTML = formHtml(fit, company);
  H.close('Leave your details above and we’ll be in touch.');

  const form = $('#heroLeadForm', bubble);
  const emailRow = $('#heroLeadEmailRow', bubble);
  const hint = $('#heroLeadHint', bubble);
  const nameIn = $('[name=name]', form), emailIn = $('[name=email]', form), phoneIn = $('[name=phone]', form);
  emailIn.addEventListener('input', () => { if (hint && !hint.hidden && emailDomain(emailIn.value)) hint.hidden = true; });
  nameIn.addEventListener('input', () => { if (hint && !hint.hidden && nameIn.value.trim()) hint.hidden = true; });

  const submitLead = () => {
    const name = String(nameIn.value || '').trim();
    const email = String(emailIn.value || '').trim();
    const phone = String(phoneIn.value || '').trim();
    if (!name) { shake(nameIn.closest('.askform__row'), hint, 'Your name, so we know who to ask for.'); nameIn.focus(); return; }
    if (!emailDomain(email)) { shake(emailRow, hint, 'That does not look like a work email — check the address.'); emailIn.focus(); return; }

    /* the session keeps the contact; engine.js redacts both slots on the bus */
    try { S.setSlot('work_email', email, 'visitor'); } catch (e) {}
    if (phone) { try { S.setSlot('phone', phone, 'visitor'); } catch (e) {} }
    try { S.setSlot('contact_consent', true, 'visitor'); } catch (e) {}
    emit('capture_email', { domain: emailDomain(email), kind: KIND });
    emit('capture_phone', { given: !!phone, kind: KIND });
    emit('capture_consent', { consent: true });
    emit('human_requested', { kind: KIND, text: HUMAN_TEXT });
    emit('journey_converted', { kind: KIND, route: fit.route, product: fit.name });

    /* the lead leaves the page: /api/lead forwards it where LEAD_WEBHOOK_URL
       points; with nothing configured it answers 202 and the visitor still
       sees the confirmation — the console shows what was captured */
    const slots = (S.session && S.session.slots) || {};
    const payload = {
      name, email, phone: phone || null,
      company: slots.company || null, website: slots.company_domain || null,
      role: slots.role_seniority || null, size: slots.size_tier || null, timing: slots.timing_intent || null,
      problems: fit.domains, route: fit.route, product: fit.name,
      page: location.pathname + location.search, ts: new Date().toISOString()
    };
    try {
      fetch('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
    } catch (e) { /* a blocked request is not the visitor's problem */ }

    const first = name.split(/\s+/)[0];
    let done = 'Thanks, ' + H.esc(first) + '. A Stagwell AI specialist will contact you at <b>' + H.esc(email) + '</b>' +
      (phone ? ' or on <b>' + H.esc(phone) + '</b>' : '') + ' to walk you through the products that fit.';
    let more = '';
    if (fit.id && fit.name) more = '<a class="turnb__more" href="/next/s/' + encodeURIComponent(fit.id) + '">Meanwhile, read about ' + H.esc(fit.name) + '</a>';
    bubble.innerHTML = '<div class="turnb__text">' + done + '</div>' + more;
    bubble.classList.remove('turnb--form');
    H.close('We’ll be in touch shortly.');
  };
  $('.askform__go', form).addEventListener('click', submitLead);
  /* Enter in any field sends the details, and never the hero's own form */
  [nameIn, emailIn, phoneIn].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submitLead(); } }));

  setTimeout(() => { try { nameIn.focus({ preventScroll: true }); } catch (e) {} }, 80);
}

/* ── wiring: the field, the starting points, the overlay's hand-offs ───── */
const form = $('#agentForm'), input = $('#agentInput');
form.addEventListener('submit', e => {
  e.preventDefault();
  if (finished) return;   /* the conversation ended on the form above */
  const v = input.value.trim();
  if (!v) { input.focus(); return; }
  input.value = '';
  send(v);
});
document.querySelectorAll('#agentTags .tag').forEach(b => b.addEventListener('click', () => send(b.dataset.q || b.textContent.trim())));

/* a prefilled question in the URL starts the conversation the way the agent
   page does: /next?q=… */
try {
  const q = new URLSearchParams(location.search).get('q');
  if (q && q.trim()) setTimeout(() => send(q.trim()), REDUCED ? 0 : 500);
} catch (e) { /* no URL, no start */ }

window.SAIHEROAGENT = { send, state: () => ({ started, busy, finished }) };
})();
