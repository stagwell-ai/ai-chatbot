/* ═══════════════════════════════════════════════════════════════════════════
   PRODUCT-CHAT — the agent conversation that happens ON /s/{id}.

   Why it exists — the client, looking at the solution pages:
     "instead of asking the agent and it taking you to a different site, just
      have the agent text here and have the user ask questions and explain
      what is this product and try and collect the users info and get them to
      answer the questions and make them a report, we want to bring them back
      to the regular flow."

   The page used to carry a gold "Ask the agent about this →" that navigated
   to /?autostart=1&q={label}. It left the page, and the visitor lost the
   product they were reading. This file replaces that with one panel that
   never leaves /s/{id} until the snapshot mounts.

   ── WHAT THIS FILE DOES AND DOES NOT DO ────────────────────────────────────
   It is a SHELL, in exactly the sense machine/convo.js is a shell: it renders
   turns and drives the flow, and it decides nothing. Everything underneath is
   the site's existing machinery, reused whole:

     window.SAIFLOW      the six qualification questions, their chips, their
                         skip rules, the progress numbers. Not one question is
                         restated here — start()/state()/answer()/onChange().
     window.SAIRESEARCH  narrated through the same sai:event stream the home
                         page's rail listens to. This file never runs research.
     window.SAISNAP      the report. Same snapshot, same capture band, and it
                         leads on to window.SAIPATH exactly as it does on "/".
     window.SAILEAD      "Talk to an AI expert", the capture that happens now.
     /api/ask mode 'product'   every product word the agent says.

   The bubble markup is the site's existing conversation idiom, verbatim out
   of machine/styles.css — .turn / .ai / .ai__body / .ai__text / .thinking /
   .bubble / .opts / .opt. There is no third chat style on this site;
   solution.css only supplies the panel's own frame around it.

   ── WHY IT IS NOT machine/convo.js ─────────────────────────────────────────
   convo.js is the same job in the landing's shell, and reusing it was the
   first thing tried. It is welded to that shell in three ways this page
   cannot satisfy: it reads #hero2 / .hero2__in / #chat / #chatPanel /
   #promptForm and moves them into a layout of its own; the styling for those
   lives in b.css, which this page deliberately does not load (it would fight
   solution.css for .nav, .btn and the rest); and its bootstrap pushes /chat,
   which is precisely the navigation away from /s/{id} the client is
   complaining about. So the shell is rewritten — 200 lines of rendering — and
   everything that is actually a DECISION is delegated to the files above.

   ── HONESTY ────────────────────────────────────────────────────────────────
   Every product claim comes from data/solutions.json. In the live path it
   comes from there via the server, which resolves the id itself and never
   accepts a fact from this file (see api/ask.js). In the fallback path it
   comes from there via the same entry solution.js rendered the page from. A
   live answer is labelled with the model and the latency, the same way
   b.js labels its unscripted chat; a fallback answer says it came from the
   page's own data. Neither one is ever allowed to be mistaken for the other.

   window.SAIPRODUCT:
     .mount({ host, solution, domains })  → build the panel into `host`
     .ask(text)                           → put a question to the agent
     .startFlow(seedLabel)                → jump straight to qualification
     .focus()                             → scroll to + focus the composer
     .phase()                             → 'qa' | 'flow' | 'done'
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const arr = v => (Array.isArray(v) ? v : []);
const has = v => !!(v && String(v).trim());

/* After this many answered product questions the agent stops answering and
   starts qualifying — the panel exists to bring the visitor back into the
   flow, and a Q&A with no floor never gets there. The visitor can always
   reach it sooner by tapping the chip or pasting a website. */
const QA_LIMIT = 3;

/* ─────────────────────────── STATE ─────────────────────────── */

let sol = null;             /* the data/solutions.json entry this page renders */
let seedDomains = [];       /* routing.json domains that resolve to it */
let panel = null;
let phase = 'qa';           /* 'qa' | 'flow' | 'done' */
let busy = false;
let answered = 0;           /* product questions answered in this session */
let history = [];           /* [{role,text}] — the Q&A transcript, for /api/ask */
let lastQuestionId = null;
let waitingBubble = null;
let finished = false;
let flowWired = false;
let stick = true;

/* ─────────────────────────── PANEL SHELL ─────────────────────────── */

function shellHTML(s) {
  return `
    <div class="solconvo__head">
      <svg class="solconvo__mark" viewBox="0 0 28.44 28" aria-hidden="true"><use href="#sw-mark"/></svg>
      <b class="solconvo__who">Stagwell AI</b>
      <span class="solconvo__sep" aria-hidden="true">·</span>
      <span class="solconvo__stage" id="solStage">Ask about ${esc(s.name)}</span>
    </div>

    <div class="solconvo__prog" id="solProg" hidden>
      <span class="solconvo__proglab" id="solProgLab">A couple more questions</span>
      <span class="solconvo__progbar"><i id="solProgFill"></i></span>
    </div>

    <div class="solnarr" id="solNarr" aria-live="polite" hidden></div>

    <div class="solconvo__thread" id="solThread" role="log" aria-live="polite" aria-label="Conversation with the agent"></div>

    <form class="solconvo__form" id="solForm" novalidate>
      <div class="solconvo__field">
        <span class="solconvo__caret" aria-hidden="true"></span>
        <input class="solconvo__input" id="solInput" type="text" autocomplete="off"
               placeholder="Ask about ${esc(s.name)} — or paste your website"
               aria-label="Ask the agent about ${esc(s.name)}">
      </div>
      <button class="btn btn--gold solconvo__send" id="solSend" type="submit">Send</button>
    </form>

    <div class="solconvo__aside">
      <button class="solconvo__expert" type="button" data-cta="expert">Rather talk to a person? Talk to an AI expert &rarr;</button>
    </div>`;
}

/* ─────────────────────────── THREAD ─────────────────────────── */

const thread = () => $('#solThread', panel);

function wireStick() {
  const t = thread();
  if (!t) return;
  t.addEventListener('scroll', () => {
    stick = t.scrollHeight - t.scrollTop - t.clientHeight < 48;
  }, { passive: true });
}

function scrollThread() {
  const t = thread();
  if (!t) return;
  stick = true;
  requestAnimationFrame(() => { if (stick) t.scrollTop = t.scrollHeight; });
}

/* the same turn markup machine/convo.js appends, so the two conversations are
   one conversation as far as machine/styles.css is concerned */
function aiTurn() {
  const t = document.createElement('div');
  t.className = 'turn';
  t.innerHTML = `<div class="ai">
      <svg class="ai__mark" viewBox="0 0 28.44 28"><use href="#sw-mark"/></svg>
      <div class="ai__body"><p class="ai__who">Stagwell AI</p>
        <div class="thinking"><i></i><i></i><i></i></div></div></div>`;
  thread().appendChild(t);
  scrollThread();
  return t.querySelector('.ai__body');
}

function fillTurn(body, text) {
  const dots = $('.thinking', body);
  if (dots) dots.remove();
  const p = document.createElement('p');
  p.className = 'ai__text';
  p.innerHTML = esc(text);
  body.appendChild(p);
  scrollThread();
  return p;
}

function addAgentBubble(text) {
  return fillTurn(aiTurn(), text);
}

function addUserBubble(text) {
  const t = document.createElement('div');
  t.className = 'turn turn--user';
  t.innerHTML = `<div class="bubble">${esc(text)}</div>`;
  thread().appendChild(t);
  scrollThread();
}

/* b.js's own convention for an unscripted answer, restated on this panel:
   what answered, how fast, and that nobody wrote it down first. The fallback
   variant is the same line telling the opposite truth. */
function addMeta(body, detail) {
  const p = document.createElement('p');
  p.className = 'solmeta' + (detail.live ? '' : ' solmeta--script');
  p.innerHTML = detail.live
    ? `<i class="pulse"></i>${esc(detail.model || 'the model')} · answered live in ${esc(detail.ms)}ms · unscripted`
    : `Answered from this page's own data — the live line didn't come back.`;
  body.appendChild(p);
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
  $$('.opts', thread()).forEach(o => {
    o.classList.add('is-gone');
    setTimeout(() => o.remove(), 460);
  });
}

/* one chip row, styles.css's .opts/.opt, each chip carrying its own onPick */
function renderChips(body, chips) {
  const wrap = document.createElement('div');
  wrap.className = 'opts';
  chips.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt' + (c.placeholder ? ' opt--placeholder' : '');
    b.innerHTML = `<span class="opt__dot"></span>${esc(c.label)}`;
    b.style.animationDelay = `${80 + i * 60}ms`;
    if (c.placeholder) b.disabled = true;
    else b.addEventListener('click', () => c.pick());
    wrap.appendChild(b);
  });
  body.appendChild(wrap);
  scrollThread();
  return wrap;
}

/* ─────────────────────────── COMPOSER ─────────────────────────── */

function setStage(text) {
  const el = $('#solStage', panel);
  if (el) el.textContent = text;
}

function setPlaceholder(text) {
  const el = $('#solInput', panel);
  if (el) el.placeholder = text;
}

function setBusy(on) {
  busy = !!on;
  const send = $('#solSend', panel);
  if (send) send.disabled = busy;
  if (panel) panel.classList.toggle('is-busy', busy);
}

/* ─────────────────────────── THE Q&A PHASE ─────────────────────────── */

/* Three questions a visitor actually asks, phrased as they would phrase them.
   They are QUESTIONS, not claims — every answer still comes from the data. */
function suggestions(s) {
  const list = [
    { label: `What does ${s.name} actually do?`, q: `What does ${s.name} actually do?` },
    { label: `Who is it for?`, q: `Who is ${s.name} for?` },
    { label: `How would we get started?`, q: `How would we get started with ${s.name}?` },
  ];
  return list.map(c => ({ label: c.label, pick: () => submit(c.q) }));
}

const GO_CHIP_LABEL = 'Find my fit — start here';

function goChip() {
  return {
    label: GO_CHIP_LABEL,
    pick: () => { addUserBubble(GO_CHIP_LABEL); enterFlow({ text: '' }); }
  };
}

/* The opener: two lines, both out of the entry solution.js rendered the page
   from — the positioning's own first sentence and who it says it is for.
   Value first, name second: the bubble opens with what the product does for
   you, then pins the name to it. Never "You're reading X" — the visitor knows
   what page they're on. */
function firstSentence(text, max) {
  const t = String(text || '').trim();
  if (!t) return '';
  const m = t.match(/^[\s\S]*?[.!?](?=\s|$)/);
  const one = (m ? m[0] : t).trim();
  return one.length > (max || 240) ? one.slice(0, max || 240).replace(/\s+\S*$/, '') + '…' : one;
}

function intro(s) {
  const who = has(s.whoFor)
    ? `${String(s.whoFor).charAt(0).toLowerCase()}${String(s.whoFor).slice(1)}`
    : '';
  const lead = firstSentence(s.positioning);
  if (lead) {
    return `${lead} That's ${s.name}${who ? ` — built for ${who}` : ''}.`;
  }
  return `${s.name} is one of the ten AI products in the Stagwell Marketing Cloud${who ? `, built for ${who}` : ''}.`;
}

function invite() {
  return `Ask me anything — or drop your website and I'll start with your brand instead of the pitch.`;
}

/* ── the fallback answer ──
   The demo must never dead-end, and it must never improvise a product fact
   to avoid dead-ending. So the fallback is a lookup, not a generation: the
   question is matched to a shape, and the shape is filled from the SAME
   solutions.json entry the server would have been given. Anything the entry
   does not answer gets the honest sentence and the offer of a person. */
function fallbackAnswer(s, question) {
  const q = String(question || '').toLowerCase();
  const props = arr(s.valueProps).filter(has);
  const forward = ` What's your website? I'll read your brand before I say whether it fits.`;
  const human = ` I can have someone from the team answer that properly — tap "Talk to an AI expert" and it takes a moment.`;

  const hit = re => re.test(q);

  if (hit(/\b(price|pricing|cost|costs|how much|budget|licen[cs]e|quote|contract)\b/)) {
    return `I don't have pricing for ${s.name} on this page, and I'm not going to guess at it.${human}${forward}`;
  }
  if (hit(/\b(integrat|api|sso|export|connect to|works with|salesforce|hubspot|snowflake)\b/)) {
    return `This page doesn't carry the integration detail for ${s.name}, so I'd be inventing it if I answered.${human}${forward}`;
  }
  if (hit(/\b(case stud|customer|client|reference|who uses|logos|results|roi|uplift|%)\b/)) {
    return `I don't have named customers or results figures for ${s.name} here, and I won't make them up.${human}${forward}`;
  }
  if (hit(/\b(who|for whom|audience|team|role|fit for)\b/) && has(s.whoFor)) {
    return `${s.name} is built for ${s.whoFor.charAt(0).toLowerCase()}${s.whoFor.slice(1)}.${
      props.length ? ` What they get out of it: ${props.slice(0, 3).join(', ').toLowerCase()}.` : ''}${forward}`;
  }
  if (hit(/\b(start|started|trial|try|demo|buy|sign ?up|onboard|next step)\b/)) {
    return has(s.signupUrl)
      ? `${s.name} has a self-serve free trial — the "Start your free trial" button on this page opens it.${forward}`
      : `There's no self-serve trial for ${s.name}; the next step is a short conversation with our team.${forward}`;
  }
  if (props.length && hit(/\b(what|do|does|capabilit|feature|work|how)\b/)) {
    return `${firstSentence(s.positioning)} Concretely: ${props.join(', ').toLowerCase()}.${forward}`;
  }
  return `${firstSentence(s.positioning) || `${s.name} is one of the ten AI products in the Stagwell Marketing Cloud.`}${
    has(s.whoFor) ? ` It's for ${s.whoFor.charAt(0).toLowerCase()}${s.whoFor.slice(1)}.` : ''
  } If you want detail this page doesn't carry, I'd rather have a person answer it than guess.${forward}`;
}

/* /api/ask mode 'product'. This function sends an ID and a question — never a
   product fact. The server resolves the id against data/solutions.json and
   assembles the whole system prompt there (api/ask.js). Any failure at all,
   including a deployment that predates the mode, returns null and the caller
   falls back. */
async function askProduct(question) {
  const ctl = new AbortController();
  const bail = setTimeout(() => ctl.abort(), 14000);
  try {
    const r = await fetch('/api/ask', {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'product',
        productId: sol.id,
        question: String(question || '').slice(0, 400),
        history: history.slice(-6)
      })
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || d.ok !== true || !has(d.answer)) return null;
    return d;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(bail);
  }
}

async function answerProductQuestion(text) {
  const body = aiTurn();
  const d = await askProduct(text);
  const answer = d ? d.answer : fallbackAnswer(sol, text);
  fillTurn(body, answer);
  addMeta(body, d ? { live: true, model: d.model, ms: d.ms } : { live: false });
  history.push({ role: 'agent', text: answer });
  answered++;
  return body;
}

/* ─────────────────────────── READING THE VISITOR ─────────────────────────── */

const eng = () => (typeof window !== 'undefined' && window.SAI) || null;

function websiteIn(text) {
  const S = eng();
  if (!S || typeof S.extractDomain !== 'function') return null;
  try { return S.extractDomain(text); } catch (e) { return null; }
}

const GETSTARTED = /\b(get started|getting started|let'?s go|sign me up|i'?m in|start now|book a|talk to (someone|sales|a human|a person)|demo please|show me|find my fit|what fits|which product)\b/i;

/* Question-shaped, i.e. asking ABOUT the product rather than telling us about
   themselves. "Does it handle competitor benchmarking?" is a question for the
   Q&A; "we need help running creator campaigns" is a problem statement, and a
   problem statement is q1's answer — it belongs in the flow, not in another
   paragraph about the product. The test is deliberately shallow (a question
   mark or an opening interrogative) because the consequence of getting it
   wrong is small: the wrong branch still answers them, in the same panel. */
const QUESTION_SHAPED = /^(what|whats|who|whos|how|why|when|where|does|do|did|can|could|is|are|will|would|should|which|tell me|explain|any\b)/i;

function isQuestion(text) {
  const t = String(text || '').trim();
  return /\?\s*$/.test(t) || QUESTION_SHAPED.test(t);
}

function readsAsNeed(text) {
  if (isQuestion(text)) return false;
  return visitorNamedADomain(text);
}

/* engine.js already knows what "can I talk to someone" looks like, and
   already owns the event for it — reuse both rather than inventing either. */
function noteHumanAsk(text) {
  const S = eng();
  if (!S || typeof S.detectHumanAsk !== 'function') return false;
  let asked = false;
  try { asked = !!S.detectHumanAsk(text); } catch (e) { asked = false; }
  if (asked && S.session && S.session.humanAsk !== true) {
    S.session.humanAsk = true;
    try { S.events.emit('human_requested', { kind: 'solution-page', text: String(text) }); }
    catch (e) { /* the conversation carries on without the log line */ }
  }
  return asked;
}

/* ─────────────────────────── THE TURN HANDLER ─────────────────────────── */

async function submit(raw) {
  const text = String(raw == null ? '' : raw).trim();
  if (!text || busy) return;

  if (phase === 'flow') { handleFlowAnswer(text, text); return; }
  if (phase === 'done') return;

  setBusy(true);
  clearChips();
  addUserBubble(text);
  const input = $('#solInput', panel);
  if (input) input.value = '';
  history.push({ role: 'user', text });

  /* Three ways the Q&A ends and the qualification begins. A website is the
     answer to q2 and the trigger for research in one move (SPEC
     non-negotiable #1), so it ends the Q&A wherever it lands. So does asking
     to get going, and so does a problem statement — but ONLY when the visitor
     was not asking a question: "How would we get started?" contains "get
     started" and is still a question about the product, and deserves an
     answer before it deserves an interrogation. */
  const site = websiteIn(text);
  if (site || (!isQuestion(text) && GETSTARTED.test(text)) || readsAsNeed(text)) {
    setBusy(false);
    await enterFlow({ text });
    return;
  }

  noteHumanAsk(text);
  const body = await answerProductQuestion(text);
  setBusy(false);

  /* The answer itself ended by asking for a website (the server prompt makes
     that a rule, and the fallback copy honours it). These are the two replies
     to that question, one tap each. */
  if (answered >= QA_LIMIT) {
    addAgentBubble(`Let me flip this around — a few quick questions about you, and I can say whether ${sol.name} is actually the right call, and show you what it looks like on your problem.`);
    await enterFlow({ text: '' });
    return;
  }

  if (body) renderChips(body, [goChip()].concat(suggestions(sol).slice(0, 2)));
  focusInput();
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE FLOW PHASE — machine/flow.js drives, this file paints.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Seeding, and the correction rule that outranks it.

   A visitor reading the QuestBrand page who asks to get started has, in
   effect, already answered q1: routing.json says brand_health resolves here,
   and they walked in through that door. So the flow opens with that domain's
   own label as if it had been tapped on the landing — the same
   SAIFLOW.start({chipLabel}) the landing's chips use, so q1 is answered by
   the same mechanism and logged the same way.

   But "visitor corrections always win". If their own words carry a problem
   domain of their own, the seed is dropped entirely and their text starts the
   flow alone: someone on the QuestBrand page typing "I need influencer
   marketing" is telling us the page was the wrong door. engine.js's keyword
   classifier is the judge, because it is synchronous and it is the same one
   flow.js uses for short answers.

   A "Problems it solves" row seeds ITS OWN label rather than the page's
   first one — the visitor picked that problem, so it is theirs, not the
   product's default. */
function seedLabel(explicit) {
  if (has(explicit)) return String(explicit);
  return seedDomains.length ? seedDomains[0].label : null;
}

function visitorNamedADomain(text) {
  const S = eng();
  if (!S || typeof S.classifyKeywords !== 'function' || !has(text)) return false;
  try { return (S.classifyKeywords(text) || []).length > 0; } catch (e) { return false; }
}

function startArgsFor(text, explicitSeed) {
  const seed = seedLabel(explicitSeed);
  const t = String(text || '').trim();
  if (t && (visitorNamedADomain(t) || !seed)) return { initialText: t };
  if (!seed) return { initialText: t };
  return t ? { chipLabel: seed, initialText: t } : { chipLabel: seed };
}

async function enterFlow(opts) {
  if (phase !== 'qa') return;
  const o = opts || {};
  phase = 'flow';

  setStage('Finding your fit');
  setPlaceholder('Or answer in your own words…');
  const prog = $('#solProg', panel);
  if (prog) prog.hidden = false;
  panel.classList.add('is-flow');

  const FLOW = window.SAIFLOW;
  if (!FLOW) {
    /* flow.js failed to load. Say so rather than pretending — and the expert
       button below is still a real capture. */
    phase = 'qa';
    addAgentBubble(`I can't open the qualification questions right now. Tap "Talk to an AI expert" and a person will pick this up.`);
    return;
  }

  setBusy(true);
  try { if (eng() && eng().ready) await eng().ready; } catch (e) { /* degrade */ }

  if (!flowWired && typeof FLOW.onChange === 'function') {
    FLOW.onChange(render);
    flowWired = true;
  }

  try { await FLOW.start(startArgsFor(o.text, o.seed)); }
  catch (e) { /* SAIFLOW owns its own error copy; render() reflects the state it left */ }

  setBusy(false);
  render();
  focusInput();
}

function render() {
  if (phase !== 'flow') return;
  const FLOW = window.SAIFLOW;
  if (!FLOW) return;
  const st = FLOW.state() || {};
  updateProgress(st);

  if (st.phase === 'asking' && st.question) {
    if (st.question.id !== lastQuestionId) {
      lastQuestionId = st.question.id;
      removeWaitingBubble();
      const p = addAgentBubble(st.question.copy);
      const body = p.parentElement;
      const chips = arr(st.question.chips);
      if (chips.length) {
        renderChips(body, chips.map(c => ({
          label: c.label,
          placeholder: !!c.placeholder,
          pick: () => handleFlowAnswer(c.value, c.label)
        })));
      }
      const input = $('#solInput', panel);
      if (input) {
        const allow = st.question.allowFreeText !== false;
        input.disabled = !allow;
        input.placeholder = allow ? 'Or answer in your own words…' : 'Choose an option above…';
      }
    }
  } else if (st.phase === 'waiting-research') {
    addWaitingBubble(st.waitingLabel);
  } else if (st.phase === 'done') {
    finish();
  }
}

async function handleFlowAnswer(value, label) {
  if (busy || phase !== 'flow') return;
  setBusy(true);
  clearChips();
  addUserBubble(label != null ? label : value);
  const input = $('#solInput', panel);
  if (input) input.value = '';
  try { await window.SAIFLOW.answer(value); }
  catch (e) { /* the flow owns retry/error copy */ }
  setBusy(false);
  render();
}

function updateProgress(st) {
  const lab = $('#solProgLab', panel);
  const fill = $('#solProgFill', panel);
  if (!lab || !fill) return;
  if (st.progressLabel) lab.textContent = st.progressLabel;
  const pct = typeof st.progressPct === 'number' ? Math.max(0, Math.min(100, st.progressPct)) : 0;
  fill.style.width = pct + '%';
}

/* ─────────────────────────── RESEARCH NARRATION ─────────────────────────── */

/* The home page puts these lines in the snapshot rail; this page has no rail,
   so they go in a strip above the thread. Same events, same labels, same LIVE
   badge — machine/research.js is narrating, not this file. */
function narrate(text, live) {
  const log = $('#solNarr', panel);
  if (!log || !has(text)) return;
  log.hidden = false;
  const line = document.createElement('div');
  line.className = 'solnarr__line';
  const dot = document.createElement('span'); dot.className = 'solnarr__dot';
  const t = document.createElement('span'); t.className = 'solnarr__text'; t.textContent = text;
  line.appendChild(dot); line.appendChild(t);
  if (live) {
    const badge = document.createElement('span');
    badge.className = 'solnarr__live';
    badge.textContent = 'LIVE';
    line.appendChild(badge);
  }
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function onSaiEvent(e) {
  if (phase !== 'flow') return;
  const d = (e && e.detail) || {};
  const p = d.payload || {};
  if (d.type === 'research_started') return narrate(`Starting the read on ${p.domain || 'your brand'}…`, false);
  if (d.type === 'research_step') return narrate(p.label || p.step, !!p.live);
  if (d.type === 'research_done') return narrate('Snapshot ready.', false);
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE REPORT — the client's "make them a report … bring them back to the
   regular flow". No new screen: machine/snapshot.js's own, with its own
   capture band, which leads on to machine/path.js exactly as it does on "/".
   ═══════════════════════════════════════════════════════════════════════════ */

/* snapshot.js hides '#hero2, #dash, #cloud, #cta' before it mounts — the
   landing's sections, none of which exist here. The solution page's own
   content is #solutionRoot, so this page hides that itself, and hands
   snapshot.js the restore hook it already looks for on the way back. */
function hidePage(on) {
  const root = $('#solutionRoot');
  if (root) root.hidden = !!on;
}

function installHandoffHooks() {
  if (typeof window.resetLanding !== 'function') {
    window.resetLanding = function () { hidePage(false); };
  }
  /* the snapshot's workspace tile calls this when it has a domain; with no
     dashboard on this page it falls back to the same lead capture the
     no-domain version of that tile uses */
  if (typeof window.startDashboard !== 'function') {
    window.startDashboard = function () {
      if (window.SAILEAD && typeof window.SAILEAD.open === 'function') window.SAILEAD.open('workspace');
    };
  }
}

function finish() {
  if (finished) return;
  finished = true;
  phase = 'done';
  removeWaitingBubble();
  setStage('Your snapshot');

  const FLOW = window.SAIFLOW;
  const result = (FLOW && typeof FLOW.result === 'function') ? FLOW.result() : null;
  const session = (result && result.session) || (eng() && eng().session) || {};

  addAgentBubble('Your snapshot is ready.');

  setTimeout(() => {
    installHandoffHooks();
    hidePage(true);
    if (window.SAISNAP && typeof window.SAISNAP.show === 'function') {
      window.SAISNAP.show(session);
    } else {
      /* snapshot.js is the report; with it missing there is nothing honest to
         draw, so say so and keep the human door open. */
      hidePage(false);
      addAgentBubble(`I have your answers but the report view didn't load. Tap "Talk to an AI expert" and someone will send it to you.`);
    }
  }, REDUCED ? 30 : 650);
}

/* ─────────────────────────── ENTRY ─────────────────────────── */

function focusInput() {
  const input = $('#solInput', panel);
  if (!input || input.disabled) return;
  try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
}

function openPanel() {
  const body = addAgentBubble(intro(sol));
  const invited = addAgentBubble(invite());
  renderChips(invited.parentElement, suggestions(sol).concat([goChip()]));
  return body;
}

function mount(opts) {
  const o = opts || {};
  const host = o.host;
  if (!host || !o.solution) return null;

  sol = o.solution;
  seedDomains = arr(o.domains);
  phase = 'qa'; busy = false; answered = 0; history = [];
  lastQuestionId = null; waitingBubble = null; finished = false;

  panel = document.createElement('section');
  panel.className = 'solconvo';
  panel.id = 'solConvo';
  panel.setAttribute('aria-label', `Ask the agent about ${sol.name}`);
  panel.innerHTML = shellHTML(sol);
  host.appendChild(panel);

  wireStick();

  $('#solForm', panel).addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#solInput', panel);
    submit(input ? input.value : '');
  });

  openPanel();
  installHandoffHooks();
  return panel;
}

document.addEventListener('sai:event', onSaiEvent);

window.SAIPRODUCT = {
  mount,
  ask: submit,
  /* the page's own in-line entry points — a "Problems it solves" row, the
     dark band's "Ask the agent". The label is what the visitor picked, so it
     is shown as their turn AND used as the flow's q1 seed. */
  startFlow(label) {
    if (phase !== 'qa') { this.focus(); return; }
    if (has(label)) addUserBubble(label);
    enterFlow({ text: '', seed: has(label) ? String(label) : null });
    this.focus();
  },
  focus() {
    if (!panel) return;
    panel.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
    setTimeout(focusInput, REDUCED ? 0 : 320);
  },
  phase: () => phase,
  /* for the acceptance suite and for anyone auditing where a claim came from */
  _fallbackAnswer: q => fallbackAnswer(sol, q),
  _startArgs: startArgsFor
};

})();
