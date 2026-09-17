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
let pointerKey = null;                /* the way-finding last drawn, so the same products are not listed twice in a row */
let cardsDrawn = false;               /* the recommendation is drawn once; on the open path the composer stays open under it */
let previewDrawn = false;             /* …and the first look at the products, shown before the business questions, is drawn once too */
/* bumped by Start over. A turn already in flight when it is pressed carries the
   old number, so its answer is dropped on the floor instead of landing in the
   box the visitor has just emptied. */
let generation = 0;

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
const flags = () => ((S.data || {}).kimi || {}).flags || {};
/* ── VOICE MODE (voice.js, KIMI-VOICE-PLAN.md) ──
   While a voice session is open the agent SAYS the questions and the answers
   land as transcripts, drawn by voice.js. This file then draws only the
   structures — the fact list, the cards, the form, the Book-a-call button —
   and never a question's text, or the visitor would read it twice. */
const voiceLive = () => !!(window.SAIVOICE && window.SAIVOICE.live && window.SAIVOICE.live());

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

/* ── VALUE BEFORE THE NEXT QUESTION ──
   Amy (2026-09-10): "we're asking a lot of questions of the user without giving
   them any info … it feels very 'data miney' right now without giving them any
   value before asking for a ton of info", and "there should be an option for
   the user to visit the relevant product page from this chat". So the moment
   what they said points somewhere, the answer says where — the product's own
   line and a door to its page — and only then asks the next question. The list
   is drawn when it changes, not repeated under every question. */
const pointerKeyOf = P => (P && P.items.length) ? P.kind + ':' + P.items.map(p => p.id).join(',') : null;
const askText = s => (H.rich ? H.rich(s) : H.esc(s).replace(/\?/g, '<span class="q">?</span>'));

function pointersHtml(P) {
  const pc = copy().pointers || {};
  const intro = P.kind === 'goal' ? pc.introGoal : pc.introReco;
  return (intro ? '<p class="point__intro">' + H.esc(intro) + '</p>' : '') +
    '<div class="point">' + P.items.map(p =>
      '<a class="point__item" href="' + H.esc(p.url) + '" target="_blank" rel="noopener" data-kimi-pointer="' + H.esc(p.id) + '">' +
        '<span class="point__name">' + H.esc(p.name) + '</span>' +
        (p.line ? '<span class="point__line">' + H.esc(p.line) + '</span>' : '') +
        '<span class="point__go">' + H.esc(tpl(pc.read || 'Read about {product}', { product: p.name })) + ' →</span>' +
      '</a>').join('') + '</div>';
}
function wirePointers(el, from) {
  el.querySelectorAll('[data-kimi-pointer]').forEach(a => a.addEventListener('click', () => {
    try { K.clicked('LEARN_MORE', a.getAttribute('data-kimi-pointer'), a.getAttribute('href'), from); } catch (e) {}
  }));
}
function drawAsk(st) {
  const chips = st.suggestions.map(s => ({ label: s.label, value: s.value }));
  /* ── ONE ASK PER SCREEN ──
     The card used to carry its own line and three pills while the question
     underneath asked for something else — two funnels at once, and the visitor
     could not tell which was live ("I feel a little lost", client 2026-09-17).
     The way deeper is now ONE chip on this question's own row, beside its own
     answers: one turn, one row of options, one box. */
  if (st.exploreOffer && st.exploreOffer.label) chips.push({ label: st.exploreOffer.label, value: '__x__root' });
  const onChip = chip => send(chip.value, chip.label);
  /* flags.pointers is OFF: the client's order names products once, at step 6
     ("it jumped to 6 with giving recommendations, then went back to 2") */
  const P = flags().pointers ? st.pointers : null, pk = pointerKeyOf(P);
  if (!pk || pk === pointerKey) { H.ai(askText(st.message || ''), chips, null, onChip); return; }
  pointerKey = pk;
  /* ack → where to read → the question → its chips */
  const bubble = H.ai(st.ack ? askText(st.ack) : null, chips, null, onChip);
  const row = bubble.querySelector('.turnb__chips');
  const block = document.createElement('div');
  block.innerHTML = pointersHtml(P) + '<div class="turnb__text turnb__text--after">' + askText(st.prompt || st.message || '') + '</div>';
  while (block.firstChild) bubble.insertBefore(block.firstChild, row || null);
  wirePointers(bubble, 'chat');
  H.type(bubble);          /* the question arrived after the ack: it types in too */
  try { const a = window.SAIANALYTICS; if (a) a.track('kimi_pointer_shown', { kind: P.kind, products: P.items.map(p => p.id).join(','), at_step: (K.state() || {}).step }); } catch (e) {}
}

function render(st) {
  if (!st || ended) return;
  const quiet = voiceLive();           /* the agent is saying it: structures only */
  if (st.uiAction === 'ASK') {
    drawFindings(st);
    /* the value before the qualification (client, 2026-09-16): the products
       that fit are shown as soon as the address step is behind us, and the
       questions about the business carry on underneath them */
    if (st.previewed && st.cards.length && !previewDrawn) {
      /* what they just said is answered BEFORE anything is shown — "that's
         fine, you'll have the chance later" comes first, then the cards, then
         the question on its own (client, 2026-09-17: "acknowledge … and only
         after show the answer"). The ack is not repeated under the cards. */
      if (st.ack && !quiet) H.ai(askText(st.ack), null, null, null);
      drawPreview(st);
      st = Object.assign({}, st, { ack: null, message: st.prompt || st.message });
    }
    const key = 'ask|' + (st.question ? st.question.id : '') + '|' + st.message;
    if (key === lastKey) return;
    lastKey = key;
    if (!quiet) drawAsk(st);
    /* voice mode: the agent speaks the question; the answers still come as
       pills, hung under its words when they arrive ("there should be pills
       with reasonable answers to the questions the voice agent asks me") */
    else if (st.suggestions && st.suggestions.length && window.SAIVOICE.offerChips) {
      window.SAIVOICE.offerChips(st.suggestions.map(s => ({ label: s.label, value: s.value })), chip => send(chip.value, chip.label));
    }
    /* the work email is typed like any other address: the phone's keyboard
       gets the @ for it, and the placeholder says what shape the answer is */
    const f = st.question && st.question.field;
    inputMode(f === 'email' ? 'email' : 'text');
    H.placeholder(st.hint || (f === 'website' ? ((copy().hints || {}).website || 'yourcompany.com')
      : f === 'email' ? ((copy().hints || {}).email || 'you@company.com') : 'Type your answer…'));
    refocus();
    return;
  }
  /* ── EXPLORE: a detour into one product's detail ──
     A short line, a small panel of two to five rows dealt out one after
     another, and the chips that lead on from it. Never the whole page: the
     flow hands over one node at a time (client, 2026-09-17). */
  if (st.uiAction === 'EXPLORE') {
    const x = st.explore || {};
    const key = 'explore|' + x.productId + '|' + x.node + '|' + x.step;
    if (key === lastKey) return;
    lastKey = key;
    const chips = st.suggestions.map(sg => ({ label: sg.label, value: sg.value }));
    const onChip = chip => send(chip.value, chip.label);
    if (!quiet) {
      /* the bubble is built EMPTY and typed once at the end, the way drawCards
         does: H.ai() types whatever it is given at creation, so a lead line and
         a panel appended afterwards used to appear all at once under a summary
         that had already finished writing ("this text appears too quickly, it
         should all type in, like an LLM response" — client, 2026-09-17) */
      const bubble = H.ai(null, null, null, null);
      const head = document.createElement('div');
      head.className = 'turnb__text';
      head.innerHTML = String(askText(st.message || '')).replace(/\?/g, '<span class="q">?</span>');
      bubble.appendChild(head);
      let ul = null;
      if (x.panel && x.panel.items && x.panel.items.length) {
        /* a line introducing the rows, where the step has one ("Three things
           set it apart:" over the differentiators) */
        if (x.panel.after) {
          const lead = document.createElement('p');
          lead.className = 'turnb__text turnb__text--after';
          lead.textContent = x.panel.after;
          bubble.appendChild(lead);
        }
        ul = panelEl(x.panel);
        bubble.appendChild(ul);
      }
      /* the closing line goes UNDER the answer, never instead of it: when the
         detour has shown all it is going to, the reader still gets what they
         asked for and then "that's the shape of it" (client, 2026-09-17) */
      if (x.close) {
        const close = document.createElement('p');
        close.className = 'turnb__text turnb__text--close';
        close.textContent = x.close;
        bubble.appendChild(close);
      }
      if (chips.length) H.chips(bubble, chips, onChip);
      /* head-aligned, like the recommendation: an explore step is an ANSWER,
         and the reader should be at its first line. settle() alone left the
         panel below the fold — measured, every row of a second-level panel
         dealt itself out where nobody could see it (2026-09-17). */
      H.settle(bubble, { head: true });
      /* one stream, in reading order: the answer, the lead line, then each row
         as its words are written. Each <li> carries data-cue, so typeIn rises
         it at its first word; when nothing types, the rows deal themselves. */
      if (!H.type(bubble) && ul) dealIn(ul);
    } else if (chips.length && window.SAIVOICE.offerChips) {
      window.SAIVOICE.offerChips(chips, chip => send(chip.value, chip.label));
    }
    inputMode('text');
    H.placeholder(st.hint || 'Pick one, or ask me anything about it');
    refocus();
    return;
  }
  if (st.uiAction === 'CAPTURE_CONTACT') {
    if (lastKey === 'contact') return;
    lastKey = 'contact';
    drawFindings(st);
    drawForm(quiet ? Object.assign({}, st, { message: '' }) : st);
    return;
  }
  /* the open path (client's order, 2026-09-10): the cards are drawn first, then
     the composer asks for the email, then the phone — a wrong answer re-asks */
  if (st.uiAction === 'CAPTURE_EMAIL' || st.uiAction === 'CAPTURE_PHONE') {
    if (st.cards.length && !cardsDrawn) drawCards(st, { open: true });
    const key = st.uiAction + '|' + st.message + '|' + (st.holds || 0);
    if (key === lastKey) return;
    lastKey = key;
    if (!quiet) H.ai(askText(st.message || ''), null, null, null);
    inputMode(st.uiAction === 'CAPTURE_EMAIL' ? 'email' : 'tel');
    H.placeholder(st.hint || '');
    refocus();
    return;
  }
  if (st.uiAction === 'BOOK') {
    if (lastKey === 'book') return;
    lastKey = 'book';
    /* with the email asked up front the flow goes from the last question
       STRAIGHT to the call, so this is the first render that has cards to
       show: draw the recommendation before the button, or the visitor is
       offered a call about a product they were never shown (2026-09-16) */
    if (st.cards.length && !cardsDrawn) drawCards(st, { open: true });
    drawBook(quiet ? Object.assign({}, st, { message: '' }) : st);
    return;
  }
  if (st.uiAction === 'SHOW_RECOMMENDATIONS' || st.uiAction === 'COMPLETE') {
    if (cardsDrawn) return;
    drawCards(st, { open: false });
  }
}

/* what the phone keyboard offers: letters for an answer, @ for the email,
   digits for the number */
function inputMode(m) {
  if (!input) return;
  input.setAttribute('inputmode', m);
  input.setAttribute('autocomplete', m === 'email' ? 'email' : m === 'tel' ? 'tel' : 'off');
}

/* the last step: a call, one button, the composer closes */
function drawBook(st) {
  const c = copy();
  const a = st.action || {};
  const bubble = H.ai(askText(st.message || ''), null, null, null);
  bubble.classList.add('turnb--book');
  bubble.insertAdjacentHTML('beforeend',
    '<button type="button" class="btn btn--ink turnb__go" data-cta="' + H.esc(a.cta || 'demo') + '" data-kimi-cta="BOOK">' + H.esc(a.label || 'Book a call') + '</button>' +
    (st.after ? '<p class="reco__after">' + H.esc(st.after) + '</p>' : ''));
  /* lead.js opens the booking on [data-cta]; the flow only records the click */
  bubble.querySelector('[data-kimi-cta="BOOK"]').addEventListener('click', () => {
    try { K.clicked('BOOK', (st.recommendation || {}).primary || null, null, 'book'); } catch (e) {}
  });
  /* …or have the agent ring them instead of picking a slot (client, 2026-09-15).
     call.js is form-free, so this is safe inside the thread, which lives in a
     form; the widget keeps everything it knows to itself and posts on its own. */
  if (window.SAICALL) {
    const alt = document.createElement('div');
    alt.className = 'turnb__alt';
    alt.innerHTML = '<span class="turnb__or">' + H.esc(window.SAICALL.copy.lead) + '</span>';
    bubble.appendChild(alt);
    window.SAICALL.create(alt, { variant: 'thread', placement: 'chat-book' });
  }
  inputMode('text');
  H.close(c.composerClosedBook || c.composerClosed || 'We\'ll be in touch.');
  ended = true;
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
  const mine = generation;
  let goal = seed && seed.goal, domain = seed && seed.domain;
  if (!started && !goal && !domain) { const b = pillFor(v); if (b) { goal = b.dataset.goal || null; domain = b.dataset.domain || null; } }
  lastVia = (label != null || (seed && (seed.goal || seed.domain))) ? 'chip' : 'type';
  if (restartBtn) restartBtn.hidden = false;
  /* a voice session is open: the words go to the agent, which answers by
     voice and moves the flow through its tools (voice.js) */
  if (voiceLive() && window.SAIVOICE.sendText(label != null ? label : v)) { started = true; return; }
  busy = true;
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
  if (mine !== generation) return;     /* started over while this was in the air */
  w.remove(); H.think.off();
  waitEl = null;
  busy = false;
  render(K.state());
}

/* ── START OVER ──
   An empty box again, without a page reload (client, 2026-09-10). It is the
   one control that has to work at every point of the conversation: mid-answer,
   sitting on the contact form, and after the cards when the composer has been
   closed — which is exactly when someone most wants to ask a second thing. */
function restart(opts) {
  const o = opts || {};
  generation++;
  started = false; busy = false; ended = false; lastKey = null;
  formBubble = null; waitEl = null; shownFindings = false; lastVia = 'type'; pointerKey = null; cardsDrawn = false; previewDrawn = false;
  inputMode('text');
  try { K.reset(); } catch (e) {}
  H.think.off();
  H.clear((copy().hints || {}).start);
  /* the starting points come back: they were answered, not spent */
  document.querySelectorAll('#agentTags .tag').forEach(b => { b.disabled = false; b.setAttribute('aria-pressed', 'false'); });
  /* the voice, if open, stays open — the agent is told and greets again;
     when the agent itself asked (start_over tool) it is already answering */
  if (voiceLive()) { restartBtn.hidden = false; if (!o.fromVoice) window.SAIVOICE.onRestart(); }
  else if (restartBtn) restartBtn.hidden = true;
  try { const a = window.SAIANALYTICS; if (a) a.track('kimi_restarted', { via: o.fromVoice ? 'voice' : 'button' }); } catch (e) {}
  if (FINE && !voiceLive()) { try { H.focus(); } catch (e) {} }
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
  H.type(bubble);          /* the words above the fields, not the labels in them */
  /* the form is the way to a tailored recommendation and a specialist — not
     the only way to the product. The page is one click away, no details asked. */
  const P = flags().pointers ? st.pointers : null;
  if (P && P.items.length) {
    const p = P.items[0], pc = c.pointers || {};
    /* right under the button, before the small print — the small print reserves
       room at the foot of the form, and the way out belongs next to the way in */
    const bar = bubble.querySelector('.askform__bar');
    (bar || bubble).insertAdjacentHTML(bar ? 'afterend' : 'beforeend', '<a class="askform__skip" href="' + H.esc(p.url) + '" target="_blank" rel="noopener" data-kimi-pointer="' + H.esc(p.id) + '">' +
      H.esc(tpl(pc.skipForm || 'Or skip this and read about {product}', { product: p.name })) + ' →</a>');
    wirePointers(bubble, 'form');
  }
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
/* ── the rows of an explore panel ──
   They deal out one after another — but only once they are actually on screen.
   The panel is appended while the thread is still scrolling down to it, so a
   stagger that starts on append plays out below the fold: measured, every row
   of a second-level panel revealed itself where nobody could see it, on a
   desktop and on a phone (2026-09-17). Each row is handed its delay as it
   crosses into view instead, so a burst that arrives together deals out
   together, and a row scrolled to later simply appears.

   BURST_GAP is how long a burst stays open: rows that come into view within
   that window share one stagger, and a row arriving after it starts at zero
   rather than waiting out a queue nobody watched. */
const ROW_STEP = 85, BURST_GAP = 400;
function panelEl(panel) {
  const ul = document.createElement('ul');
  ul.className = 'xpanel xpanel--' + (panel.kind || 'rows');
  panel.items.forEach((it, i) => {
    const li = document.createElement('li');
    li.style.setProperty('--i', String(i));
    li.setAttribute('data-cue', '');          /* home.js: rise at my first word */
    /* turnb__typed: the row's words belong to the answer being written, so they
       are part of the same stream. The number is not — it arrives with the row */
    li.innerHTML = '<span class="xpanel__n">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<div class="turnb__typed"><b>' + H.esc(it.title) + '</b><span class="xpanel__l">' + H.esc(it.line) + '</span></div>';
    ul.appendChild(li);
  });
  return ul;
}
/* every row ends up visible whatever happens: no observer, a hidden thread, a
   panel that never intersects — the net below shows them anyway */
function dealIn(ul) {
  const rows = Array.prototype.slice.call(ul.children);
  const show = (li, d) => { li.style.setProperty('--d', (d || 0) + 'ms'); li.classList.add('is-in'); };
  if (REDUCED || typeof IntersectionObserver !== 'function') { rows.forEach(li => show(li, 0)); return; }
  let n = 0, last = 0;
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const now = Date.now();
      if (now - last > BURST_GAP) n = 0;      /* a new burst: start the stagger again */
      last = now;
      show(e.target, n++ * ROW_STEP);
    });
  }, { threshold: .2 });
  rows.forEach(li => io.observe(li));
  /* …and if none of that ever fires, they are shown a second later regardless */
  setTimeout(() => rows.forEach(li => { if (!li.classList.contains('is-in')) { io.unobserve(li); show(li, 0); } }), 1200);
}

/* the first look: the same cards, in their own bubble, with the composer left
   open and the conversation carrying on under them. It does not touch
   cardsDrawn — the full recommendation still draws itself at the end. */
function drawPreview(st) {
  const c = copy();
  const CARDS = window.SAICARDS;
  const html = (CARDS && st.cards.length) ? CARDS.renderCards(st.cards, c, H.esc) : '';
  if (!html) return;
  previewDrawn = true;
  const b = H.ai(null, null, null, null);
  b.classList.add('turnb--reco');
  b.innerHTML = '<div class="turnb__text">' + H.esc(st.cardsIntro || '') + '</div>' + html +
    (st.after ? '<p class="reco__after">' + H.esc(st.after) + '</p>' : '');
  b.querySelectorAll('[data-kimi-cta]').forEach(el => el.addEventListener('click', () => {
    try { K.clicked(el.dataset.kimiCta, el.dataset.kimiProduct, el.getAttribute('href')); } catch (e) {}
  }));
  H.type(b);
  H.settle(b, { head: true });
  try { const a = window.SAIANALYTICS; if (a) a.track('kimi_showcase_drawn', { cards: st.cards.length }); } catch (e) {}
}

function drawCards(st, opts) {
  const o = opts || {};
  const c = copy();
  const CARDS = window.SAICARDS;
  const html = (CARDS && st.cards.length) ? CARDS.renderCards(st.cards, c, H.esc) : '';
  const target = formBubble || H.ai(null, null, null, null);
  target.classList.remove('turnb--form');
  target.classList.add('turnb--reco');
  target.innerHTML = '<div class="turnb__text">' + H.esc(st.cardsIntro || st.message || '') + '</div>' + html +
    (st.after ? '<p class="reco__after">' + H.esc(st.after) + '</p>' : '');
  cardsDrawn = true;
  /* open: the conversation goes on under the cards (email, phone, a call);
     closed: the fast track's end, details already given */
  if (!o.open) { H.close(c.composerClosed || 'Your recommendation is above.'); ended = true; }

  /* every CTA is recorded; the booking modal (lead.js, [data-cta]) or the
     catalog URL does the rest */
  target.querySelectorAll('[data-kimi-cta]').forEach(el => el.addEventListener('click', () => {
    try { K.clicked(el.dataset.kimiCta, el.dataset.kimiProduct, el.getAttribute('href')); } catch (e) {}
  }));
  /* the words of the recommendation type themselves in, and the thread opens on
     the FIRST of them. scrollIntoView used to do this, and took the window with
     it: the answer arrived and the page was already at the email line, past
     everything it had just been asked for (client, 2026-09-16). */
  /* the cards carry [data-cue], so they arrive when the last word of the intro
     lands rather than while it is still being written. When nothing types —
     motion off, or an intro that is already on the thread — they are simply
     there, because a card nobody cues is a card nobody sees. */
  if (!H.type(target)) target.querySelectorAll('.reco__card').forEach(el => el.classList.add('is-in'));
  H.settle(target, { head: true });
}

/* ── wiring: the field, the starting points, the overlay's hand-offs ───── */
const form = $('#agentForm'), input = $('#agentInput'), restartBtn = $('#agentRestart');
if (restartBtn) restartBtn.addEventListener('click', () => restart());

/* ── EVERY LINK IN THE THREAD OPENS A NEW TAB ──
   "Anytime that we show a link in the chat history, it should open a new tab.
   Otherwise we're going to lose the whole conversation" (client, 2026-09-10).
   The links this file and cards.js write already carry target="_blank"; this
   is the net under them, for any anchor that reaches the thread another way
   (the small print's privacy link, a model-free fallback bubble, whatever
   comes next). Same-page anchors are left alone. */
const threadEl = $('#agentThread');
if (threadEl) threadEl.addEventListener('click', e => {
  const a = e.target && e.target.closest && e.target.closest('a[href]');
  if (!a || !threadEl.contains(a)) return;
  const href = a.getAttribute('href') || '';
  if (href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href)) return;
  a.target = '_blank';
  a.rel = a.rel ? (/\bnoopener\b/.test(a.rel) ? a.rel : a.rel + ' noopener') : 'noopener';
}, true);
form.addEventListener('submit', e => {
  e.preventDefault();
  if (ended) return;
  const v = input.value.trim();
  if (!v) { input.focus(); return; }
  input.value = '';
  if (H.grow) H.grow();      /* back to one line */
  send(v);
});
document.querySelectorAll('#agentTags .tag').forEach(b => b.addEventListener('click', () =>
  send(b.dataset.q || b.textContent.trim(), null, { goal: b.dataset.goal || null, domain: b.dataset.domain || null })));

/* a prefilled question in the URL starts the conversation: /?q=… */
try {
  const q = new URLSearchParams(location.search).get('q');
  if (q && q.trim()) setTimeout(() => send(q.trim()), REDUCED ? 0 : 500);
} catch (e) { /* no URL, no start */ }

window.SAIHEROAGENT = { send, restart, state: () => ({ started, busy, finished: ended }) };
})();
