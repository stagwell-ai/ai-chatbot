/* ═══════════════════════════════════════════════════════════════════════════
   KIMI FLOW — the product-discovery conversation as a state machine (brief
   §4, §5, §41). Pure logic, no DOM: the homepage's hero-agent.js renders what
   state() says and hands input back. It replaces the fixed six-question
   sequence of flow.js FOR THE HOMEPAGE ONLY; the older agent page keeps
   flow.js untouched.

   The pipeline, in one line:

     text → (model via /api/ask mode:'interpret' | keywords) → intent signals
          → recommend.js (deterministic) → select-question.js → this → UI

   The model never picks a product, never decides whether contact is required,
   and never writes a URL. It normalises language; everything after that is
   data and arithmetic the team can read.

   Statuses: DISCOVERY → QUALIFICATION → READY_FOR_CONTACT → CONTACT_CAPTURE →
   RECOMMENDATION → COMPLETE. uiAction tells the UI what to draw:
   'ASK' | 'CAPTURE_CONTACT' | 'SHOW_RECOMMENDATIONS' | 'COMPLETE'.

   window.SAIKIMI:
     .start({ initialText, chipLabel, goal, domain })  → Promise<state>
     .answer(text)                                     → Promise<state>
     .contact({ name, email, phone, company })         → Promise<{ ok, retry, error, state }>
     .clicked(type, productId, url)                    → records the CTA; COMPLETE
     .state()  .onChange(cb)  .recommendation()  .result()  .reset()

   Everything the engine's demo console already understood is still emitted
   (slot_filled, question_asked, answer_given, route_decided, capture_*), and
   the brief's kimi_* events go through SAIANALYTICS.track.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const eng = () => window.SAI || null;
const R = () => window.SAIRECOMMEND || null;
const Qs = () => window.SAISELECT || null;
const C = () => window.SAICARDS || null;
const A = () => window.SAIANALYTICS || null;

const INTERPRET_MS = 13000;     /* the server's own deadline is 12s; this is the outer fence */
const EXPLAIN_MS = 8000;        /* runs beside the lead POST; the template stands in if it is late */
const GOAL_Q = '__goal__';

const data = () => (eng() && eng().data) || {};
const kimi = () => data().kimi || {};
const flags = () => Object.assign({ enabled: true, llm: true, contactGate: true, secondaryRecommendations: true, analytics: true, explainWithLlm: true }, kimi().flags || {});
const copy = () => Object.assign({}, kimi().copy || {});
const goals = () => ((data().goals || {}).goals) || [];
const conv = () => Object.assign({ secondaryMax: 2 }, ((data().scoring || {}).conversation) || {});

const uid = () => 'k_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const list = v => (Array.isArray(v) ? v : []);
const tpl = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? '' : String(vars[k])));

/* ── state ───────────────────────────────────────────────────────────────── */
function blank() {
  return {
    sessionId: uid(),
    status: 'IDLE',
    step: 0,
    primaryGoal: null,
    secondaryGoals: [],
    rawProblemText: null,
    industry: null,
    companySize: null,
    creatorProgramSize: null,
    geographicScope: null,
    intents: [],                 /* [{ id, explicit }] */
    askedQuestionIds: [],
    currentQuestion: null,
    message: null,
    ack: null,                   /* the two halves of message, so the way-finding can sit between them */
    prompt: null,
    pointers: null,              /* { kind: 'reco'|'goal', items: [{ id, name, line, url }] } — where to read, before the next question */
    suggestions: [],
    uiAction: 'ASK',
    hint: null,
    reco: null,
    cards: [],
    lead: null,
    contactCaptured: false,
    llmStatus: 'DETERMINISTIC',
    llmProvider: null,
    llmModel: null,
    fallbacks: 0,
    summary: null,
    unclassifiedOnce: false,
    researched: false,           /* the lookup has run — not recognised is not the same as never asked */
    role: null,                  /* founder | manager | director_vp | c_suite */
    roleText: null,              /* their own words, when they typed a title instead */
    website: null,               /* the domain they gave, or '__skip__' if they declined */
    findings: null,              /* what the lookup actually knew — never anything it did not */
    contactRequest: null,        /* 'call'|'demo'|'trial'|'expert'|'pricing' — they asked to be contacted */
    contact: null,               /* the resolved copy for the form they are about to see */
    holds: 0,                    /* consecutive turns that taught us nothing */
    company: null,               /* a company name typed where a web address was asked for */
    websiteNudged: false,        /* asked once more for the address itself */
    phoneNudged: false,          /* asked once more for a number that looked wrong */
    action: null,                /* the BOOK step's button: { label, cta } */
    after: null,
    cardsIntro: null,            /* the line above the cards, safe from the asks that follow */
    error: null
  };
}
let st = blank();
let listeners = [];
/* bumped by reset(): a turn that was waiting on the network when the visitor
   started over must not write its answer into the fresh conversation */
let epoch = 0;
const stale = e => e !== epoch;
let deterministicNoted = false;

const signals = () => ({
  goal: st.primaryGoal, intents: st.intents, companySize: st.companySize,
  creatorProgramSize: st.creatorProgramSize, geographicScope: st.geographicScope
});

function track(name, props) {
  const base = { session_id: st.sessionId, step: st.step, primary_goal: st.primaryGoal, llm_status: st.llmStatus, llm_provider: st.llmProvider };
  try { const a = A(); if (a) a.track(name, Object.assign(base, props || {})); else eng().events.emit(name, Object.assign(base, props || {})); } catch (e) { /* never the visitor's problem */ }
}
const emit = (type, payload) => { try { eng().events.emit(type, payload); } catch (e) {} };
const setSlot = (n, v, src) => { try { eng().setSlot(n, v, src || 'visitor'); } catch (e) {} };

/* ── reading free text ───────────────────────────────────────────────────── */
function deterministicRead(text) {
  const r = R();
  const intents = r ? r.keywordIntents(text, data()) : [];
  const bands = r ? r.bandsFromText(text, data()) : {};
  return { detectedGoals: [], detectedIntents: intents.map(i => i.id), inferred: {
    industry: null, companySize: bands.companySize || null, creatorProgramSize: bands.creatorProgramSize || null, geographicScope: bands.geographicScope || null
  }, userNeedSummary: null, confidence: intents.length ? 0.5 : 0, ack: null, reply: null,
    contactRequest: r ? r.contactRequest(text, data()) : null,
    website: S_extractDomain(text), live: false };
}

function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    Promise.resolve(p).then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

async function interpret(text) {
  const S = eng();
  const raw = String(text || '').slice(0, 600);
  const off = deterministicRead(raw);
  if (!flags().llm || !S || typeof S._ask !== 'function') { noteDeterministic('disabled'); return off; }
  try {
    const j = await withTimeout(S._ask({
      mode: 'interpret', text: raw,
      context: { goal: st.primaryGoal, intents: st.intents.map(i => i.id), companySize: st.companySize, creatorProgramSize: st.creatorProgramSize, geographicScope: st.geographicScope, question: st.currentQuestion && st.currentQuestion.id !== GOAL_Q ? st.currentQuestion.id : null }
    }, INTERPRET_MS), INTERPRET_MS + 500);
    if (!j || j.ok !== true || !j.interpretation) throw new Error('no_interpretation');
    const meta = j.llm || {};
    st.llmProvider = meta.provider || null;
    st.llmModel = meta.model || null;
    st.fallbacks = meta.fallbacks || 0;
    st.llmStatus = ['PRIMARY', 'FALLBACK_1', 'FALLBACK_2'][meta.chainIndex || 0] || 'FALLBACK_2';
    if (st.fallbacks > 0) track('kimi_model_fallback', { llm_fallback_count: st.fallbacks, llm_model: st.llmModel, failed: meta.failed || null });
    const it = j.interpretation;
    /* the model leads; the keyword pass fills anything it left empty */
    return {
      detectedGoals: list(it.detectedGoals),
      detectedIntents: list(it.detectedIntents).length ? it.detectedIntents : off.detectedIntents,
      inferred: Object.assign({}, off.inferred, Object.fromEntries(Object.entries(it.inferred || {}).filter(([, v]) => v != null && v !== ''))),
      userNeedSummary: it.userNeedSummary || null,
      confidence: typeof it.confidence === 'number' ? it.confidence : 0.5,
      ack: it.ack || null,
      reply: it.reply || null,
      contactRequest: it.contactRequest || null,
      website: off.website,
      live: true
    };
  } catch (e) {
    noteDeterministic(e && e.message);
    return off;
  }
}

function noteDeterministic(reason) {
  st.llmStatus = 'DETERMINISTIC';
  if (deterministicNoted) return;
  deterministicNoted = true;
  track('kimi_deterministic_mode', { reason: String(reason || 'unavailable').slice(0, 60) });
}

/* merge what a read taught us into the state — visitor corrections win, and
   bands are only filled where still unknown unless the read is explicit */
function absorb(read, opts) {
  const o = opts || {};
  const r = R();
  const known = data();
  list(read.detectedIntents).forEach(id => {
    if (!r || !r.intentById(id, known)) return;
    const have = st.intents.find(i => i.id === id);
    if (!have) st.intents.push({ id, explicit: !!o.explicit });
    else if (o.explicit) have.explicit = true;
  });
  if (!st.primaryGoal) {
    const g = list(read.detectedGoals).find(id => goals().some(x => x.id === id));
    if (g) setGoal(g, 'inferred');
  }
  /* a site typed in their own words answers the website question before it is
     asked — the lookup runs from advance() */
  if (!st.website && read.website) { st.website = read.website; setSlot('company_domain', read.website, 'visitor'); }

  const inf = read.inferred || {};
  ['companySize', 'creatorProgramSize', 'geographicScope'].forEach(k => {
    if (inf[k] && (!st[k] || o.overwrite)) st[k] = String(inf[k]);
  });
  if (inf.industry && !st.industry) st.industry = String(inf.industry).slice(0, 80);
  if (read.userNeedSummary && !st.summary) st.summary = String(read.userNeedSummary).slice(0, 300);
  if (st.companySize) setSlot('size_tier', sizeTier(st.companySize), 'visitor');
}

/* ── THE BAND THE VISITOR PICKS vs THE TIER THE ENGINE ROUTES ON ──
   engine.js routes on routing.json's three tiers (SMB / mid-market /
   enterprise). The visitor answers in the client's four bands — under 20,
   21–50, 51–250, 251 or more — and each band carries the tier it belongs to
   (taxonomy.json). The top band opens at 251 and has no ceiling, so when the
   site lookup has counted the heads, that count is the better witness for
   anything above it: hand the engine the number and let it tier it. */
function sizeTier(band) {
  const d = data();
  const B = list(d.taxonomy && d.taxonomy.bands && d.taxonomy.bands.companySize);
  const hit = B.filter(b => b && b.id === band)[0];
  if (!hit) return band;
  const n = st.findings && typeof st.findings.employees === 'number' ? st.findings.employees : null;
  if (hit.max == null && n != null && n > 250) return n;
  return hit.tier || band;
}

/* what a turn can change; compared before and after absorb() */
const knowledge = () => JSON.stringify([st.primaryGoal, st.intents.map(i => i.id + (i.explicit ? '!' : '')).sort(), st.companySize, st.creatorProgramSize, st.geographicScope, st.website]);
const pick = (arr, n) => { const a = list(arr); return a.length ? a[Math.min(n, a.length - 1)] : null; };

function setGoal(id, source) {
  const g = goals().find(x => x.id === id);
  if (!g) return false;
  st.primaryGoal = g.id;
  /* the routing.json domain rides along so the engine's route(), tiers and the
     demo console keep working exactly as before */
  if (g.domain) setSlot('problem_domains', [g.domain], source === 'inferred' ? 'inferred' : 'visitor');
  track('kimi_goal_selected', { goal: g.id, source: source || 'pill' });
  return true;
}

/* A site the visitor named in their own words gets read exactly as one given
   at the question does — it is the same offer, made a beat earlier. */
async function readSiteIfNew() {
  if (!st.website || st.website === '__skip__' || st.researched) return;
  const domain = st.website;
  st.researching = domain;
  st.uiAction = 'READING';
  st.message = tpl((copy().research || {}).reading, { domain });
  notify();
  const e = epoch;
  const found = await research(domain);
  if (stale(e)) return;
  st.researching = null;
  st.researched = true;
  absorbFindings(found);
  if (!found) track('kimi_site_read', { domain, known: false });
}

/* ── the machine ─────────────────────────────────────────────────────────── */
function recompute() {
  const r = R();
  st.reco = r ? r.recommend(signals(), data()) : null;
  st.pointers = (r && r.pointers) ? r.pointers(st.reco, st.primaryGoal, data()) : null;
  return st.reco;
}

function goalSuggestions() {
  return goals().map(g => ({ id: g.id, label: g.label, value: g.id, kind: 'goal' }));
}

function askGoal(reply) {
  const c = copy();
  /* the model's own words when it answered (a greeting answered, a question
     about the site answered); the hold lines rotate when it did not */
  const prompt = reply || (st.holds ? (pick(c.hold, st.holds - 1) || c.fallback) : (st.unclassifiedOnce ? c.fallback : c.unclassified));
  st.currentQuestion = { id: GOAL_Q, field: 'goal', prompt, suggestions: goalSuggestions() };
  st.message = st.currentQuestion.prompt;
  st.ack = null; st.prompt = st.message;
  st.suggestions = st.currentQuestion.suggestions;
  st.uiAction = 'ASK';
  st.hint = (c.hints || {}).start || null;
  st.status = 'DISCOVERY';
  st.unclassifiedOnce = true;
  emit('question_asked', { id: GOAL_Q, slot: 'goal', copy: st.message, mode: null });
}

function present(q, first, modelAck) {
  const c = copy();
  st.currentQuestion = q;
  st.askedQuestionIds.push(q.id);
  st.step++;
  st.holds = 0;
  /* the model's acknowledgement of what was just said leads into the question;
     without one, the goal's own line on the first question only */
  const ack = modelAck || (first ? ((c.goalAck || {})[st.primaryGoal] || (st.rawProblemText ? c.freeTextAck : null)) : null);
  st.message = (ack ? ack + ' ' : '') + (q.prompt || '');
  st.ack = ack || null; st.prompt = q.prompt || '';
  st.suggestions = list(q.suggestions).map(s => ({ id: s.id, label: s.label, value: s.value }));
  st.uiAction = 'ASK';
  /* the placeholder says what kind of answer this is: an address for the
     website (it has no chips — "Pick one" would be a lie), a headcount for
     the size, otherwise "pick one, or type" */
  const hints = c.hints || {};
  st.hint = q.field === 'website' ? (hints.website || 'yourcompany.com')
    : q.field === 'companySize' ? hints.size
    : (list(q.suggestions).length ? hints.question : (hints.typed || 'Type your answer…'));
  st.status = st.status === 'DISCOVERY' && st.step > 1 ? 'QUALIFICATION' : (st.status === 'IDLE' ? 'DISCOVERY' : st.status);
  if (st.step > 1) st.status = 'QUALIFICATION';
  emit('question_asked', { id: q.id, slot: q.field || 'intent', copy: q.prompt, mode: null });
}

/* the visitor said something that taught us nothing (small talk, a question
   about the site, an off-topic line). The conversation answers in kind and
   stays where it is: the same question, the same suggestions. It never moves
   toward the form on a turn that carried no signal. */
function hold(reply) {
  const c = copy();
  st.holds++;
  const q = st.currentQuestion;
  if (!q || q.id === GOAL_Q) { askGoal(reply); return; }
  st.message = reply || pick(c.holdQuestion, st.holds - 1) || q.prompt;
  st.ack = null; st.prompt = st.message;
  st.suggestions = list(q.suggestions).map(s => ({ id: s.id, label: s.label, value: s.value }));
  st.uiAction = 'ASK';
  emit('question_asked', { id: q.id, slot: q.field || 'intent', copy: st.message, mode: 'hold' });
}

/* a typed title lands on one of the four bands the routing overrides and the
   ICP boosts already speak (engine.js ROLE_AFFINITY, routing.json override 2),
   and the words themselves are kept for the CRM */
const ROLE_PATTERNS = [
  ['c_suite', /(c-?suite|\bcmo\b|\bceo\b|\bcoo\b|\bcfo\b|\bcto\b|\bcdo\b|\bcco\b|chief|president|partner)/],
  ['founder', /(founder|co-?founder|owner|proprietor|i started|my own (company|business|agency))/],
  ['director_vp', /(director|\bvp\b|v\.p\.|vice president|\bsvp\b|\bevp\b|head of|\bmd\b|managing director)/],
  ['manager', /(manager|marketing lead|team lead|specialist|coordinator|analyst|associate|consultant)/]
];
function roleFromText(text) {
  const t = String(text || '').toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  for (let i = 0; i < ROLE_PATTERNS.length; i++) if (ROLE_PATTERNS[i][1].test(t)) return ROLE_PATTERNS[i][0];
  return null;
}

/* ── READING THEIR SITE ──
   The visitor gives a website and the conversation stops being about marketing
   in general (client, 2026-09-10: "it should have asked me about my website,
   and then it should do a quick search to see what info it can pull up and
   show me the info and then keep talking to me with added relevance").

   /api/ask mode:'research' asks the model what it ALREADY knows about that
   domain and is built to answer known:false rather than guess — so what comes
   back is either real or nothing. Nothing invented is ever shown: research.js,
   which the older agent page uses, falls back to seeded fiction for the demo's
   sake, and that is exactly why this calls the endpoint directly instead.

   What it buys the rest of the conversation: the size band (so the size
   question is never asked), the industry (carried to the CRM), and the
   competitor set. What it never buys: a claim we cannot stand behind. */
const RESEARCH_MS = 9000;

/* the lookup's headcount → a band, read off taxonomy.json's own ceilings, so
   the site and the pills can never drift apart when the bands are redrawn */
function bandFromEmployees(n) {
  if (typeof n !== 'number' || !isFinite(n) || n <= 0) return null;
  const d = data();
  const B = list(d.taxonomy && d.taxonomy.bands && d.taxonomy.bands.companySize);
  if (!B.length) return null;
  for (let i = 0; i < B.length; i++) if (B[i].max == null || n <= B[i].max) return B[i].id;
  return B[B.length - 1].id;
}

async function research(domain) {
  const S = eng();
  if (!flags().llm || !S || typeof S._ask !== 'function' || !domain) return null;
  try {
    const j = await withTimeout(S._ask({ mode: 'research', domain }, RESEARCH_MS), RESEARCH_MS + 500);
    if (!j || j.ok !== true || j.known !== true) return null;
    const size = bandFromEmployees(j.employees);
    return {
      domain: j.domain || domain,
      name: typeof j.name === 'string' && j.name.trim() ? j.name.trim().slice(0, 80) : null,
      industry: typeof j.industry === 'string' && j.industry.trim() ? j.industry.trim().slice(0, 60) : null,
      employees: typeof j.employees === 'number' ? j.employees : null,
      companySize: size,
      competitors: list(j.competitors).map(x => String(x).trim()).filter(Boolean).slice(0, 3)
    };
  } catch (e) { noteDeterministic('research_unavailable'); return null; }   /* the lookup is the model's knowledge too */
}

/* what it learned becomes what we know — but never over something the visitor
   said themselves */
function absorbFindings(f) {
  if (!f) return;
  st.findings = f;
  if (f.companySize && !st.companySize) { st.companySize = f.companySize; setSlot('size_tier', sizeTier(f.companySize), 'research'); }
  if (f.industry && !st.industry) st.industry = f.industry;
  if (f.name) setSlot('company', f.name, 'research');
  track('kimi_site_read', { domain: f.domain, known: true, industry: f.industry || null, size: f.companySize || null, competitors: (f.competitors || []).length });
}

/* ── THE FAST TRACK ──
   "If the person just ever cuts the chase that they want to be contacted, or
   they want to book a demo, or they want to try out something, we should just
   fast-track them to filling out the form. That's it, we're gold. Let's get
   their contact info and get a sales agent to reach out to them." (client,
   2026-09-10.)

   So a contact request ends the questions wherever it lands: on the opening
   message, mid-conversation, or in place of an answer. Whatever the turn also
   taught us is kept — a visitor who says "we need to track competitors, can
   you call me" still gets NewIntel on the card and in the CRM — but nothing
   more is asked. The words on the form follow what they asked for: a call, a
   demo, a trial, a specialist, or pricing.

   The request is read two ways, like everything else here: the phrases in
   taxonomy.json (which work with no model at all) and the model's own reading
   of the sentence, which catches the phrasings the list misses. */
function contactRequestIn(text, read) {
  const r = R();
  const byWord = r ? r.contactRequest(text, data()) : null;
  if (byWord) return byWord;
  const ids = r ? r.contactRequestIds(data()) : [];
  const byModel = read && read.contactRequest;
  return byModel && ids.indexOf(byModel) !== -1 ? byModel : null;
}

function fastTrack(kind) {
  const c = copy();
  const block = (c.fastTrack || {})[kind] || {};
  st.contactRequest = kind;
  st.contact = {
    title: block.title || c.contactTitle,
    submit: block.submit || c.contactSubmit,
    closed: block.closed || null,
    /* nothing was recommended yet, so the small print does not promise one */
    notice: c.contactNoticeFast || c.contactNotice
  };
  recompute();
  st.currentQuestion = null;
  st.suggestions = [];
  st.holds = 0;
  st.status = 'CONTACT_CAPTURE';
  st.message = block.message || c.contactTransition;
  st.uiAction = 'CAPTURE_CONTACT';
  st.hint = null;
  try { const S = eng(); if (S.session.humanAsk !== true) { S.session.humanAsk = true; emit('human_requested', { kind }); } } catch (e) {}
  track('kimi_fast_track', Object.assign({ request: kind, at_step: st.step }, recoProps()));
  track('kimi_contact_viewed', Object.assign({ fast_track: kind }, recoProps()));
}

function readyForContact() {
  const c = copy();
  st.currentQuestion = null;
  st.suggestions = [];
  st.status = 'READY_FOR_CONTACT';
  try { eng().route(); } catch (e) { /* the old console's route_decided; not needed here */ }
  if (flags().contactGate) {
    st.status = 'CONTACT_CAPTURE';
    st.contact = { title: c.contactTitle, submit: c.contactSubmit, closed: null, notice: c.contactNotice };
    st.message = c.contactTransition;
    st.uiAction = 'CAPTURE_CONTACT';
    st.hint = null;
    track('kimi_contact_viewed', recoProps());
  } else {
    /* the client's order (2026-09-10): "6) here are some recommendations we
       have 7) give us your email 8) give us your phone number 9) book a call" —
       the value first, then the ask */
    showRecommendation();
    askEmail();
  }
}

function recoProps() {
  const r = st.reco || {};
  return { primary_product: r.primary || null, secondary_products: list(r.secondary).join(','), recommendation_confidence: r.confidence ? r.confidence.level : null, steps: st.step };
}

function advance(ack) {
  const first = st.askedQuestionIds.length === 0;
  if (!st.primaryGoal && !st.intents.length) { askGoal(); return; }
  const reco = recompute();
  const q = Qs() ? Qs().selectQuestion({
    primaryGoal: st.primaryGoal, intents: st.intents, askedQuestionIds: st.askedQuestionIds,
    companySize: st.companySize, creatorProgramSize: st.creatorProgramSize, geographicScope: st.geographicScope,
    website: st.website, role: st.role
  }, reco, data()) : null;
  if (q) { present(q, first, ack); return; }
  if (!reco || !reco.primary) { askGoal(); return; }
  readyForContact();
}

/* ── opening ─────────────────────────────────────────────────────────────── */
async function start(opts) {
  const o = opts || {};
  const S = eng();
  const e = epoch;
  await S.ready;
  if (stale(e)) return state();
  st = blank();
  st.status = 'DISCOVERY';
  const chip = o.chipLabel == null ? null : String(o.chipLabel);
  const text = o.initialText == null ? null : String(o.initialText).trim();
  track('kimi_started', { input_type: o.via || (chip ? 'pill' : 'free_text'), landing_page: location.pathname, utm_source: (S.session.attribution || {}).utm_source || null, utm_campaign: (S.session.attribution || {}).utm_campaign || null });

  let goal = o.goal || null;
  if (!goal && o.domain && R()) goal = R().goalForDomain(o.domain, data());
  if (!goal && chip) { const g = goals().find(x => x.label.toLowerCase() === chip.toLowerCase()); if (g) goal = g.id; }
  if (goal) setGoal(goal, 'pill');
  if (chip) emit('answer_given', { id: GOAL_Q, slot: 'goal', text: chip, chip: goal, source: 'chip' });

  if (text) {
    st.rawProblemText = text.slice(0, 600);
    track('kimi_free_text_submitted', { length: text.length });
    noteHuman(text);
    const before = knowledge();
    const read = await interpret(text);
    if (stale(e)) return state();
    absorb(read, {});
    const asked = contactRequestIn(text, read);
    if (asked) { fastTrack(asked); notify(); return state(); }
    await readSiteIfNew();
    if (stale(e)) return state();
    if (knowledge() === before && !goal) {
      /* nothing to route on yet: reply in kind, offer the starting points */
      st.rawProblemText = null;
      st.holds = 1;
      askGoal(read.reply);
      notify();
      return state();
    }
    advance(read.ack);
    notify();
    return state();
  }
  advance();
  notify();
  return state();
}

/* a website anywhere in a sentence — the engine's own reader, so the two
   agree on what a domain is */
function S_extractDomain(text) {
  try { return eng().extractDomain(text); } catch (e) { return null; }
}

function noteHuman(text) {
  const S = eng();
  try {
    if (S.detectHumanAsk(text) && S.session.humanAsk !== true) { S.session.humanAsk = true; emit('human_requested', { text: String(text) }); }
  } catch (e) {}
}

/* ── one answer ──────────────────────────────────────────────────────────── */
async function answer(input) {
  /* after the recommendation the composer asks for the email, then the phone */
  if (st.status === 'CAPTURE_EMAIL') return captureEmail(String(input == null ? '' : input).trim());
  if (st.status === 'CAPTURE_PHONE') return capturePhone(String(input == null ? '' : input).trim());
  if (st.status === 'IDLE' || st.uiAction !== 'ASK' || !st.currentQuestion) return state();
  const text = String(input == null ? '' : input).trim();
  if (!text) return state();
  const q = st.currentQuestion;
  const e = epoch;
  noteHuman(text);

  if (q.id === GOAL_Q) {
    const g = goals().find(x => x.id === text || x.label.toLowerCase() === text.toLowerCase());
    emit('answer_given', { id: GOAL_Q, slot: 'goal', text, chip: g ? g.id : null });
    if (g) { setGoal(g.id, 'pill'); st.currentQuestion = null; advance(); notify(); return state(); }
    const before = knowledge();
    const read = await interpret(text);
    if (stale(e)) return state();
    absorb(read, {});
    track('kimi_free_text_submitted', { length: text.length, understood: knowledge() !== before });
    const asked = contactRequestIn(text, read);
    if (asked) { if (!st.rawProblemText) st.rawProblemText = text.slice(0, 600); fastTrack(asked); notify(); return state(); }
    if (knowledge() === before) { hold(read.reply); notify(); return state(); }
    if (!st.rawProblemText) st.rawProblemText = text.slice(0, 600);
    st.currentQuestion = null;
    advance(read.ack); notify(); return state();
  }

  /* the opening two questions are still a conversation: someone who answers
     either of them with "just call me" is cutting to the chase, not naming a
     website or a job title. Read deterministically, so it costs no round trip. */
  if (q.field === 'website' || q.field === 'role') {
    const cut = R() ? R().contactRequest(text, data()) : null;
    if (cut) { if (!st.rawProblemText) st.rawProblemText = text.slice(0, 600); fastTrack(cut); notify(); return state(); }
  }

  /* the website question: take the domain, look it up, show what came back */
  if (q.field === 'website') {
    const domain = S_extractDomain(text) || null;
    if (!domain) {
      const declined = /^(__skip__|skip|no|nope|none|rather not|i'd rather not|prefer not|n\/a|pass)\b/i.test(text);
      if (!st.websiteNudged) {
        /* no chip out of this question — "we really want to get their company"
           (client, 2026-09-10). Asked once more, for the address itself. */
        st.websiteNudged = true;
        st.holds++;
        st.message = (copy().research || {}).needDomain || q.prompt;
        st.ack = null; st.prompt = st.message;
        st.suggestions = [];
        st.uiAction = 'ASK';
        emit('question_asked', { id: q.id, slot: 'website', copy: st.message, mode: 'nudge' });
        track('kimi_website_nudged', { declined });
        notify(); return state();
      }
      /* twice is an answer: what they typed is kept as the company's name, and
         the conversation moves on rather than trapping them here */
      st.website = '__skip__';
      if (!declined) { st.company = text.slice(0, 120); setSlot('company', st.company, 'visitor'); }
      emit('answer_given', { id: q.id, slot: 'website', text: declined ? '__skip__' : text, chip: null });
      track('kimi_question_answered', { question_id: q.id, input_type: 'free_text', understood: false, company_named: !declined });
      st.currentQuestion = null;
      advance((copy().research || {}).noDomain || (copy().research || {}).skipped);
      notify(); return state();
    }
    emit('answer_given', { id: q.id, slot: 'website', text, chip: null });
    st.website = domain;
    setSlot('company_domain', domain, 'visitor');
    /* "we're acme.com and we need help with competitors" — the domain answers
       the question, and the rest is not thrown away. The keyword read costs
       nothing; the model is not worth a round trip on top of the lookup. */
    if (text.trim().split(/\s+/).length > 2) absorb(deterministicRead(text), {});
    track('kimi_question_answered', { question_id: q.id, input_type: 'free_text', understood: true });
    /* the UI shows "Reading acme.com…" while this runs */
    st.researching = domain;
    st.uiAction = 'READING';
    st.message = tpl((copy().research || {}).reading, { domain });
    notify();
    const found = await research(domain);
    if (stale(e)) return state();
    st.researching = null;
    st.researched = true;
    absorbFindings(found);
    if (!found) track('kimi_site_read', { domain, known: false });
    st.currentQuestion = null;
    advance(null);
    notify(); return state();
  }

  /* the role question: a chip is a band, typed words are matched to one and
     kept verbatim either way */
  if (q.field === 'role') {
    const chip = Qs() ? Qs().matchSuggestion(q, text) : null;
    const band = chip ? chip.value : roleFromText(text);
    emit('answer_given', { id: q.id, slot: 'role_seniority', text, chip: chip ? chip.value : null });
    st.role = band || 'other';
    if (!chip) st.roleText = text.slice(0, 80);
    setSlot('role_seniority', band || text.slice(0, 80), 'visitor');
    track('kimi_question_answered', { question_id: q.id, suggestion_id: chip ? chip.id : null, input_type: chip ? 'pill' : 'free_text', understood: !!band });
    st.currentQuestion = null;
    advance(null);
    notify(); return state();
  }

  const sel = Qs() ? Qs().matchSuggestion(q, text) : null;
  emit('answer_given', { id: q.id, slot: q.field || 'intent', text, chip: sel ? sel.value : null });
  if (sel) {
    Qs().applySuggestion(st, q, sel);
    if (q.field === 'companySize' && st.companySize) setSlot('size_tier', sizeTier(st.companySize), 'visitor');
    track('kimi_question_answered', { question_id: q.id, suggestion_id: sel.id, input_type: 'pill' });
  } else {
    const before = knowledge();
    const read = await interpret(text);
    if (stale(e)) return state();
    /* asked to be contacted instead of answering: the questions stop here */
    const asked = contactRequestIn(text, read);
    if (asked) { absorb(read, {}); fastTrack(asked); notify(); return state(); }
    /* a typed answer to a band question is that band when the words carry one */
    if (q.field && q.field !== 'intent') {
      const bands = R() ? R().bandsFromText(text, data()) : {};
      const map = { companySize: bands.companySize, creatorProgramSize: bands.creatorProgramSize, geographicScope: bands.geographicScope };
      if (map[q.field]) st[q.field] = map[q.field];
      else if (read.inferred && read.inferred[q.field]) st[q.field] = String(read.inferred[q.field]);
      if (q.field === 'companySize' && st.companySize) setSlot('size_tier', sizeTier(st.companySize), 'visitor');
    }
    absorb(read, { explicit: q.field === 'intent' || !q.field });
    const understood = knowledge() !== before;
    track('kimi_question_answered', { question_id: q.id, suggestion_id: null, input_type: 'free_text', understood });
    /* nothing learned: answer in kind and stay on this question */
    if (!understood) { hold(read.reply); notify(); return state(); }
    await readSiteIfNew();
    if (stale(e)) return state();
    st.currentQuestion = null;
    advance(read.ack); notify(); return state();
  }
  st.currentQuestion = null;
  advance(); notify(); return state();
}

/* ── contact, then the recommendation ────────────────────────────────────── */
const EMAIL_RE = /^[^\s@]+@([a-z0-9.-]+\.[a-z]{2,})$/i;
const PHONE_RE = /^\+?[\d\s().-]{7,20}$/;
const emailDomain = e => { const m = String(e || '').trim().toLowerCase().match(EMAIL_RE); return m ? m[1] : null; };

function validate(lead) {
  const c = copy().contactErrors || {};
  const name = String(lead.name || '').replace(/\s+/g, ' ').trim();
  const email = String(lead.email || '').trim();
  const phone = String(lead.phone || '').trim();
  const company = String(lead.company || '').replace(/\s+/g, ' ').trim();
  if (!name) return { error: 'name', message: c.name };
  if (!emailDomain(email)) return { error: 'email', message: c.email };
  if (!phone || !PHONE_RE.test(phone) || phone.replace(/\D/g, '').length < 7) return { error: 'phone', message: c.phone };
  return { lead: { name, email, phone, company: company || null } };
}

function discoveryPayload() {
  const S = eng();
  const r = st.reco || {};
  const a = (S && S.session && S.session.attribution) || {};
  return {
    sessionId: st.sessionId,
    primaryGoal: st.primaryGoal,
    rawProblemText: st.rawProblemText,
    intents: st.intents,
    companySize: st.companySize,
    creatorProgramSize: st.creatorProgramSize,
    geographicScope: st.geographicScope,
    industry: st.industry,
    askedQuestionIds: st.askedQuestionIds,
    steps: st.step,
    primary: r.primary || null,
    secondary: list(r.secondary),
    confidence: r.confidence || null,
    summary: st.summary,
    llmStatus: st.llmStatus,
    llmProvider: st.llmProvider,
    contactRequest: st.contactRequest,
    role: st.role,
    roleText: st.roleText,
    website: st.website && st.website !== '__skip__' ? st.website : null,
    siteKnown: !!st.findings,
    attribution: {
      utmSource: a.utm_source || null, utmMedium: a.utm_medium || null, utmCampaign: a.utm_campaign || null, utmContent: a.utm_content || null,
      landingPage: location.pathname + location.search, referrer: a.referrer || null
    }
  };
}

async function explain() {
  const S = eng();
  const r = st.reco;
  if (!flags().explainWithLlm || !flags().llm || !S || !r || !r.primary || typeof S._ask !== 'function') return {};
  try {
    const j = await withTimeout(S._ask({ mode: 'explain', productId: r.primary, intents: st.intents.map(i => i.id), goal: st.primaryGoal, summary: st.summary, rawProblemText: st.rawProblemText }, EXPLAIN_MS), EXPLAIN_MS + 500);
    if (j && j.ok === true && typeof j.why === 'string' && j.why.trim()) {
      const meta = j.llm || {};
      if (meta.fallbacks > 0) track('kimi_model_fallback', { llm_fallback_count: meta.fallbacks, llm_model: meta.model || null, call: 'explain' });
      return { [r.primary]: j.why.trim() };
    }
    noteDeterministic('explain_unavailable');
  } catch (e) { noteDeterministic(e && e.message); /* the template is the answer */ }
  return {};
}

async function contact(lead) {
  if (st.status !== 'CONTACT_CAPTURE' && st.status !== 'READY_FOR_CONTACT') return { ok: false, error: 'not_ready', state: state() };
  const v = validate(lead || {});
  if (v.error) return { ok: false, error: v.error, message: v.message, state: state() };
  st.lead = v.lead;
  st.error = null;

  /* the session keeps the contact (engine.js redacts both slots on the bus) */
  setSlot('work_email', v.lead.email, 'visitor');
  setSlot('phone', v.lead.phone, 'visitor');
  setSlot('contact_consent', true, 'visitor');
  if (v.lead.company) setSlot('company', v.lead.company, 'visitor');

  const payload = { lead: v.lead, discovery: discoveryPayload(), page: location.pathname + location.search, ts: new Date().toISOString(), source: 'stagwell-ai · kimi' };
  const e = epoch;
  const [delivery, why] = await Promise.all([submitLead(payload), explain()]);
  /* started over while the lead was being sent: the lead is in HubSpot, the
     cards are not drawn over the empty box */
  if (stale(e)) return { ok: true, stale: true, state: state() };

  if (!delivery.ok && delivery.retry) {
    st.error = (copy().contactErrors || {}).failed || 'That did not go through.';
    notify();
    return { ok: false, retry: true, error: 'delivery', message: st.error, state: state() };
  }

  st.contactCaptured = true;
  emit('capture_email', { domain: emailDomain(v.lead.email), kind: 'kimi' });
  emit('capture_phone', { given: true, kind: 'kimi' });
  emit('capture_consent', { consent: true });
  emit('journey_converted', { kind: 'kimi', product: (st.reco || {}).primary || null });
  track('kimi_contact_submitted', Object.assign({ email_domain: emailDomain(v.lead.email), phone_given: true, delivered: !!delivery.delivered, destination: delivery.destination || null }, recoProps()));
  showRecommendation(why);
  notify();
  return { ok: true, delivered: !!delivery.delivered, state: state() };
}

async function submitLead(payload) {
  if (typeof fetch !== 'function') return { ok: false, retry: true };
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12000);
    const r = await fetch('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: ac.signal, keepalive: true });
    clearTimeout(t);
    let j = null; try { j = await r.json(); } catch (e) { j = null; }
    if (r.status >= 500 || !j) return { ok: false, retry: true, status: r.status };
    if (r.status === 400) return { ok: false, retry: false, error: (j && j.error) || 'invalid' };
    track('kimi_lead_delivery', { delivered: !!j.delivered, destination: j.destination || null, mode: j.mode || null });
    return { ok: true, delivered: !!j.delivered, destination: j.destination || null };
  } catch (e) {
    return { ok: false, retry: true, error: e && e.name === 'AbortError' ? 'timeout' : 'network' };
  }
}

function showRecommendation(why) {
  const c = copy();
  const r = st.reco || recompute();
  const first = st.lead ? String(st.lead.name).split(/\s+/)[0] : '';
  const vars = { first: first || 'there', name: st.lead ? st.lead.name : '', email: st.lead ? st.lead.email : '', phone: st.lead ? st.lead.phone : '' };
  st.cards = C() ? C().buildCards(r, signals(), data(), c, { why: why || {}, secondary: flags().secondaryRecommendations !== false }) : [];
  const low = !r || !r.confidence || r.confidence.level === 'low';
  /* someone who cut to the chase may have told us nothing to recommend from.
     They are still a lead — say a specialist is coming and leave it there,
     rather than dressing up an empty card. */
  if (!st.cards.length) {
    st.message = tpl(st.lead && st.lead.phone ? c.fastTrackDonePhone : c.fastTrackDone, vars);
    st.after = c.fastTrackExplore || null;
  } else {
    /* no lead yet = the open path: the cards come before any details are asked */
    const intro = st.contactRequest ? c.recommendationIntroFast
      : !st.lead ? (low ? c.recommendationIntroOpenLow : c.recommendationIntroOpen)
      : (low ? c.recommendationIntroLow : c.recommendationIntro);
    st.message = tpl(intro, vars);
    st.after = st.lead ? tpl(st.lead.phone ? c.afterCardsPhone : c.afterCards, vars) : null;
    /* kept apart from message: on the open path the email ask follows at once
       and would otherwise be written over the cards' own heading */
    st.cardsIntro = st.message;
  }
  st.status = 'RECOMMENDATION';
  st.uiAction = 'SHOW_RECOMMENDATIONS';
  st.suggestions = [];
  st.currentQuestion = null;
  track('kimi_recommendation_generated', Object.assign({ cards: st.cards.length, why_from_llm: !!(why && Object.keys(why).length) }, recoProps()));
}

/* ── the open path: recommendation shown, then email → phone → a call ──
   The client's order (2026-09-10). The lead is created in HubSpot the moment
   the email lands and updated when the phone does (leadService upserts by
   email), so nothing is lost if they leave halfway. A wrong email is asked
   again; a wrong phone is asked once more, then the call is offered anyway. */
const leadPayload = () => ({ lead: st.lead, discovery: discoveryPayload(), page: location.pathname + location.search, ts: new Date().toISOString(), source: 'stagwell-ai · kimi' });

function askEmail() {
  const c = copy();
  st.status = 'CAPTURE_EMAIL'; st.uiAction = 'CAPTURE_EMAIL';
  st.message = c.askEmail || 'Where should I send this? Your work email:';
  st.ack = null; st.prompt = st.message;
  st.hint = (c.hints || {}).email || 'you@company.com';
  st.suggestions = []; st.currentQuestion = null; st.holds = 0;
  track('kimi_contact_viewed', Object.assign({ mode: 'open', ask: 'email' }, recoProps()));
}

async function captureEmail(text) {
  const c = copy();
  if (!emailDomain(text)) {
    st.holds++;
    st.message = (c.contactErrors || {}).email || 'That does not look like an email address.'; st.prompt = st.message;
    notify(); return state();
  }
  const email = text.trim();
  st.lead = { name: null, email, phone: null, company: st.company || null };
  st.error = null;
  setSlot('work_email', email, 'visitor');
  setSlot('contact_consent', true, 'visitor');
  if (st.company) setSlot('company', st.company, 'visitor');
  const e = epoch;
  const delivery = await submitLead(leadPayload());
  if (stale(e)) return state();
  if (!delivery.ok && delivery.retry) {
    st.holds++;
    st.message = (c.contactErrors || {}).failed || 'That did not go through.'; st.prompt = st.message;
    notify(); return state();
  }
  st.contactCaptured = true;
  emit('capture_email', { domain: emailDomain(email), kind: 'kimi' });
  emit('capture_consent', { consent: true });
  emit('journey_converted', { kind: 'kimi', product: (st.reco || {}).primary || null });
  track('kimi_email_captured', Object.assign({ email_domain: emailDomain(email), delivered: !!delivery.delivered, destination: delivery.destination || null }, recoProps()));
  askPhone();
  notify(); return state();
}

function askPhone() {
  const c = copy();
  st.status = 'CAPTURE_PHONE'; st.uiAction = 'CAPTURE_PHONE';
  st.message = tpl(c.askPhone || 'Thanks — I\'ll send it to {email}. And a number, if you\'d rather we call?', { email: st.lead ? st.lead.email : '' });
  st.ack = null; st.prompt = st.message;
  st.hint = (c.hints || {}).phone || '+1 555 000 0000';
  st.suggestions = []; st.holds = 0;
  track('kimi_contact_viewed', Object.assign({ mode: 'open', ask: 'phone' }, recoProps()));
}

async function capturePhone(text) {
  const c = copy();
  const good = PHONE_RE.test(text) && text.replace(/\D/g, '').length >= 7;
  if (!good) {
    if (!st.phoneNudged) {
      st.phoneNudged = true; st.holds++;
      st.message = (c.contactErrors || {}).phoneNudge || (c.contactErrors || {}).phone || 'That does not look like a phone number.'; st.prompt = st.message;
      notify(); return state();
    }
    track('kimi_phone_declined', recoProps());
    book(); notify(); return state();
  }
  st.lead.phone = text.trim();
  setSlot('phone', st.lead.phone, 'visitor');
  const e = epoch;
  const delivery = await submitLead(leadPayload());        /* the same contact, updated */
  if (stale(e)) return state();
  emit('capture_phone', { given: true, kind: 'kimi' });
  track('kimi_phone_captured', Object.assign({ delivered: !!delivery.delivered }, recoProps()));
  book(); notify(); return state();
}

function book() {
  const c = copy();
  const r = st.reco || {};
  const p = r.primary && R() ? R().productById(r.primary, data()) : null;
  const vars = { email: st.lead ? st.lead.email : '', phone: st.lead && st.lead.phone ? st.lead.phone : '', product: p ? p.name : 'the right product' };
  st.status = 'BOOK'; st.uiAction = 'BOOK';
  st.message = tpl(c.bookIntro || 'Last thing — pick a time and a Stagwell AI specialist will walk you through {product}.', vars);
  st.action = { label: c.bookCta || 'Book a call', cta: 'demo' };
  st.after = tpl(st.lead && st.lead.phone ? (c.bookAfterPhone || c.afterCardsPhone) : (c.bookAfter || c.afterCards), vars);
  st.suggestions = []; st.hint = null; st.currentQuestion = null;
  track('kimi_book_offered', recoProps());
}

function clicked(type, productId, url, from) {
  const map = { DEMO: 'kimi_demo_clicked', SELF_SERVICE: 'kimi_self_service_clicked', EXPERT_CALL: 'kimi_demo_clicked', LEARN_MORE: 'kimi_product_clicked', BOOK: 'kimi_book_clicked' };
  const external = url && /^https?:\/\//i.test(url) && !/^https?:\/\/[^/]*stagwell/i.test(url);
  /* from: 'card' (the recommendation), 'chat' (a way-finding pointer mid-conversation), 'form' (the skip link on the contact form) */
  track(map[type] || 'kimi_product_clicked', { product: productId || null, cta: type, url: url || null, from: from || 'card', at_step: st.step });
  if (external) track('kimi_external_site_clicked', { product: productId || null, url });
  emit('handoff_click', { product: productId || null, cta: type, url: url || null });
  if (st.status === 'RECOMMENDATION' || st.status === 'BOOK') { st.status = 'COMPLETE'; st.uiAction = 'COMPLETE'; notify(); }
}

/* ── public surface ──────────────────────────────────────────────────────── */
function state() {
  return {
    sessionId: st.sessionId,
    status: st.status,
    step: st.step,
    uiAction: st.uiAction,
    message: st.message,
    after: st.after || null,
    cardsIntro: st.cardsIntro || null,
    rawProblemText: st.rawProblemText || null,
    action: st.action ? Object.assign({}, st.action) : null,
    company: st.company,
    holds: st.holds,
    suggestions: st.suggestions.slice(),
    hint: st.hint,
    question: st.currentQuestion ? { id: st.currentQuestion.id, field: st.currentQuestion.field || 'intent' } : null,
    website: st.website,
    role: st.role,
    ack: st.ack,
    prompt: st.prompt,
    pointers: st.pointers ? { kind: st.pointers.kind, items: st.pointers.items.slice() } : null,
    researched: !!st.researched,
    findings: st.findings ? Object.assign({}, st.findings) : null,
    contact: st.contact ? Object.assign({}, st.contact) : null,
    contactRequest: st.contactRequest,
    primaryGoal: st.primaryGoal,
    intents: st.intents.slice(),
    companySize: st.companySize,
    creatorProgramSize: st.creatorProgramSize,
    geographicScope: st.geographicScope,
    askedQuestionIds: st.askedQuestionIds.slice(),
    recommendation: st.reco ? { primary: st.reco.primary, secondary: st.reco.secondary.slice(), confidence: st.reco.confidence, candidates: st.reco.candidates.slice() } : null,
    cards: st.cards.slice(),
    contactCaptured: st.contactCaptured,
    lead: st.lead ? { name: st.lead.name, email: st.lead.email, phone: st.lead.phone } : null,
    llmStatus: st.llmStatus,
    llmProvider: st.llmProvider,
    error: st.error
  };
}
function notify() { const s = state(); listeners.slice().forEach(cb => { try { cb(s); } catch (e) {} }); }
function onChange(cb) { if (typeof cb !== 'function') return () => {}; listeners.push(cb); return () => { listeners = listeners.filter(f => f !== cb); }; }

/* ── the voice agent's hands (KIMI-VOICE-PLAN.md §3) ──
   The Realtime model cannot move a step, recommend a product or write a lead
   itself: it calls one of these, the flow does exactly what it does for a
   typed turn, and the view below is what the model is allowed to say next. */
function findingsFacts() {
  const f = st.findings; if (!f) return null;
  const R_ = (copy().research || {});
  const out = {};
  if (f.name) out.company = f.name;
  if (f.domain) out.domain = f.domain;
  if (f.industry) out.industry = f.industry;
  if (f.companySize) out.size = (R_.sizeBands || {})[f.companySize] || f.companySize;
  if (list(f.competitors).length) out.comparedWith = f.competitors.slice();
  return Object.keys(out).length ? out : null;
}
function toolView() {
  const s = state();
  const shown = [];
  if (s.findings && s.researched) shown.push('a fact list about their company');
  if (s.uiAction === 'CAPTURE_CONTACT') shown.push('a short contact form (name, email, phone) — wait for them to fill it in');
  if (s.cards && s.cards.length && (s.uiAction === 'CAPTURE_EMAIL' || s.uiAction === 'SHOW_RECOMMENDATIONS' || s.uiAction === 'CAPTURE_PHONE' || s.uiAction === 'BOOK' || s.uiAction === 'COMPLETE')) shown.push('the recommendation card(s)');
  if (s.uiAction === 'BOOK') shown.push('a "Book a call" button');
  const stepOf = { DISCOVERY: null, QUALIFICATION: null, CAPTURE_EMAIL: 'their work email', CAPTURE_PHONE: 'their phone number', BOOK: 'booking a call', RECOMMENDATION: 'the recommendation', CONTACT_CAPTURE: 'the contact form', COMPLETE: 'done' };
  const q = s.question;
  const step = q ? ({ website: 'their website', companySize: 'how large their organisation is', role: 'their role', goal: 'what they want to solve' }[q.field] || 'a question about their need') : (stepOf[s.status] || null);
  /* websites, emails and phone numbers are typed, never taken by ear (client, 2026-09-11) */
  const typed = (q && q.field === 'website') || s.status === 'CAPTURE_EMAIL' || s.status === 'CAPTURE_PHONE';
  return {
    status: s.status,
    step,
    input: typed ? 'typed' : 'spoken',
    say: s.message || '',
    question: q ? { id: q.id, prompt: s.prompt || s.message, options: list(s.suggestions).map(x => x.label) } : null,
    facts: findingsFacts(),
    recommendation: s.cards && s.cards.length ? s.cards.map(c => ({ name: c.productName, badge: c.badge, description: c.description, why: c.whyThisFits })) : null,
    lead: s.lead ? { emailGiven: !!s.lead.email, phoneGiven: !!s.lead.phone } : null,
    holding: !!(s.holds && s.holds > 0),
    shown,
    done: s.status === 'BOOK' || s.status === 'COMPLETE'
  };
}
function requestContact(kind) {
  const k = String(kind || '').toLowerCase();
  const ok = ['call', 'demo', 'trial', 'expert', 'pricing'].indexOf(k) !== -1;
  if (!ok) return state();
  if (st.status === 'IDLE') { st.status = 'DISCOVERY'; track('kimi_started', { input_type: 'voice', landing_page: location.pathname }); }
  if (st.status === 'CONTACT_CAPTURE' || st.status === 'RECOMMENDATION' || st.status === 'BOOK' || st.status === 'COMPLETE') return state();
  recompute();
  fastTrack(k);
  notify();
  return state();
}
const tools = {
  async submit_answer(args) {
    const text = String((args || {}).text == null ? '' : args.text).trim();
    if (!text) return toolView();
    if (st.status === 'IDLE') await start({ initialText: text, via: 'voice' });
    else await answer(text);
    return toolView();
  },
  request_contact(args) { requestContact((args || {}).kind); return toolView(); },
  start_over() { epoch++; st = blank(); deterministicNoted = false; notify(); return toolView(); },
  view: toolView
};

window.SAIKIMI = {
  start, answer, contact, clicked, state, onChange, requestContact, tools,
  validate: lead => { const v = validate(lead || {}); return v.error ? { ok: false, error: v.error, message: v.message } : { ok: true, lead: v.lead }; },
  recommendation: () => st.reco,
  result: () => ({ state: state(), reco: st.reco, discovery: discoveryPayload() }),
  reset() { epoch++; st = blank(); deterministicNoted = false; return state(); },
  _interpret: interpret,     /* seams for tests */
  _absorb: absorb
};
})();
