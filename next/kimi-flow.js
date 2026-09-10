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
    error: null
  };
}
let st = blank();
let listeners = [];
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
  }, userNeedSummary: null, confidence: intents.length ? 0.5 : 0, live: false };
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
  const inf = read.inferred || {};
  ['companySize', 'creatorProgramSize', 'geographicScope'].forEach(k => {
    if (inf[k] && (!st[k] || o.overwrite)) st[k] = String(inf[k]);
  });
  if (inf.industry && !st.industry) st.industry = String(inf.industry).slice(0, 80);
  if (read.userNeedSummary && !st.summary) st.summary = String(read.userNeedSummary).slice(0, 300);
  if (st.companySize) setSlot('size_tier', st.companySize, 'visitor');
}

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

/* ── the machine ─────────────────────────────────────────────────────────── */
function recompute() {
  const r = R();
  st.reco = r ? r.recommend(signals(), data()) : null;
  return st.reco;
}

function goalSuggestions() {
  return goals().map(g => ({ id: g.id, label: g.label, value: g.id, kind: 'goal' }));
}

function askGoal() {
  const c = copy();
  st.currentQuestion = { id: GOAL_Q, field: 'goal', prompt: st.unclassifiedOnce ? c.fallback : c.unclassified, suggestions: goalSuggestions() };
  st.message = st.currentQuestion.prompt;
  st.suggestions = st.currentQuestion.suggestions;
  st.uiAction = 'ASK';
  st.hint = (c.hints || {}).start || null;
  st.status = 'DISCOVERY';
  st.unclassifiedOnce = true;
  emit('question_asked', { id: GOAL_Q, slot: 'goal', copy: st.message, mode: null });
}

function present(q, first) {
  const c = copy();
  st.currentQuestion = q;
  st.askedQuestionIds.push(q.id);
  st.step++;
  const ack = first ? ((c.goalAck || {})[st.primaryGoal] || (st.rawProblemText ? c.freeTextAck : null)) : null;
  st.message = (ack ? ack + ' ' : '') + (q.prompt || '');
  st.suggestions = list(q.suggestions).map(s => ({ id: s.id, label: s.label, value: s.value }));
  st.uiAction = 'ASK';
  st.hint = q.field === 'companySize' ? (c.hints || {}).size : (c.hints || {}).question;
  st.status = st.status === 'DISCOVERY' && st.step > 1 ? 'QUALIFICATION' : (st.status === 'IDLE' ? 'DISCOVERY' : st.status);
  if (st.step > 1) st.status = 'QUALIFICATION';
  emit('question_asked', { id: q.id, slot: q.field || 'intent', copy: q.prompt, mode: null });
}

function readyForContact() {
  const c = copy();
  st.currentQuestion = null;
  st.suggestions = [];
  st.status = 'READY_FOR_CONTACT';
  try { eng().route(); } catch (e) { /* the old console's route_decided; not needed here */ }
  if (flags().contactGate) {
    st.status = 'CONTACT_CAPTURE';
    st.message = c.contactTransition;
    st.uiAction = 'CAPTURE_CONTACT';
    st.hint = null;
    track('kimi_contact_viewed', recoProps());
  } else {
    showRecommendation();
  }
}

function recoProps() {
  const r = st.reco || {};
  return { primary_product: r.primary || null, secondary_products: list(r.secondary).join(','), recommendation_confidence: r.confidence ? r.confidence.level : null, steps: st.step };
}

function advance() {
  const first = st.askedQuestionIds.length === 0;
  if (!st.primaryGoal && !st.intents.length) { askGoal(); return; }
  const reco = recompute();
  const q = Qs() ? Qs().selectQuestion({ primaryGoal: st.primaryGoal, intents: st.intents, askedQuestionIds: st.askedQuestionIds, companySize: st.companySize, creatorProgramSize: st.creatorProgramSize, geographicScope: st.geographicScope }, reco, data()) : null;
  if (q) { present(q, first); return; }
  if (!reco || !reco.primary) { askGoal(); return; }
  readyForContact();
}

/* ── opening ─────────────────────────────────────────────────────────────── */
async function start(opts) {
  const o = opts || {};
  const S = eng();
  await S.ready;
  st = blank();
  st.status = 'DISCOVERY';
  const chip = o.chipLabel == null ? null : String(o.chipLabel);
  const text = o.initialText == null ? null : String(o.initialText).trim();
  track('kimi_started', { input_type: chip ? 'pill' : 'free_text', landing_page: location.pathname, utm_source: (S.session.attribution || {}).utm_source || null, utm_campaign: (S.session.attribution || {}).utm_campaign || null });

  let goal = o.goal || null;
  if (!goal && o.domain && R()) goal = R().goalForDomain(o.domain, data());
  if (!goal && chip) { const g = goals().find(x => x.label.toLowerCase() === chip.toLowerCase()); if (g) goal = g.id; }
  if (goal) setGoal(goal, 'pill');
  if (chip) emit('answer_given', { id: GOAL_Q, slot: 'goal', text: chip, chip: goal, source: 'chip' });

  if (text) {
    st.rawProblemText = text.slice(0, 600);
    track('kimi_free_text_submitted', { length: text.length });
    noteHuman(text);
    absorb(await interpret(text), {});
  }
  advance();
  notify();
  return state();
}

function noteHuman(text) {
  const S = eng();
  try {
    if (S.detectHumanAsk(text) && S.session.humanAsk !== true) { S.session.humanAsk = true; emit('human_requested', { text: String(text) }); }
  } catch (e) {}
}

/* ── one answer ──────────────────────────────────────────────────────────── */
async function answer(input) {
  if (st.status === 'IDLE' || st.uiAction !== 'ASK' || !st.currentQuestion) return state();
  const text = String(input == null ? '' : input).trim();
  if (!text) return state();
  const q = st.currentQuestion;
  noteHuman(text);

  if (q.id === GOAL_Q) {
    const g = goals().find(x => x.id === text || x.label.toLowerCase() === text.toLowerCase());
    emit('answer_given', { id: GOAL_Q, slot: 'goal', text, chip: g ? g.id : null });
    if (g) setGoal(g.id, 'pill');
    else { if (!st.rawProblemText) st.rawProblemText = text.slice(0, 600); absorb(await interpret(text), {}); }
    st.currentQuestion = null;
    advance(); notify(); return state();
  }

  const sel = Qs() ? Qs().matchSuggestion(q, text) : null;
  emit('answer_given', { id: q.id, slot: q.field || 'intent', text, chip: sel ? sel.value : null });
  if (sel) {
    Qs().applySuggestion(st, q, sel);
    if (q.field === 'companySize' && st.companySize) setSlot('size_tier', st.companySize, 'visitor');
    track('kimi_question_answered', { question_id: q.id, suggestion_id: sel.id, input_type: 'pill' });
  } else {
    const read = await interpret(text);
    /* a typed answer to a band question is that band when the words carry one */
    if (q.field && q.field !== 'intent') {
      const bands = R() ? R().bandsFromText(text, data()) : {};
      const map = { companySize: bands.companySize, creatorProgramSize: bands.creatorProgramSize, geographicScope: bands.geographicScope };
      if (map[q.field]) st[q.field] = map[q.field];
      else if (read.inferred && read.inferred[q.field]) st[q.field] = String(read.inferred[q.field]);
      if (q.field === 'companySize' && st.companySize) setSlot('size_tier', st.companySize, 'visitor');
    }
    absorb(read, { explicit: q.field === 'intent' || !q.field });
    track('kimi_question_answered', { question_id: q.id, suggestion_id: null, input_type: 'free_text', understood: list(read.detectedIntents).length > 0 });
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
  const [delivery, why] = await Promise.all([submitLead(payload), explain()]);

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
  st.cards = C() ? C().buildCards(r, signals(), data(), c, { why: why || {}, secondary: flags().secondaryRecommendations !== false }) : [];
  const low = !r || !r.confidence || r.confidence.level === 'low';
  st.message = tpl(low ? c.recommendationIntroLow : c.recommendationIntro, { first: first || 'there', name: st.lead ? st.lead.name : '' });
  st.after = st.lead ? tpl(st.lead.phone ? c.afterCardsPhone : c.afterCards, { email: st.lead.email, phone: st.lead.phone }) : null;
  st.status = 'RECOMMENDATION';
  st.uiAction = 'SHOW_RECOMMENDATIONS';
  st.suggestions = [];
  st.currentQuestion = null;
  track('kimi_recommendation_generated', Object.assign({ cards: st.cards.length, why_from_llm: !!(why && Object.keys(why).length) }, recoProps()));
}

function clicked(type, productId, url) {
  const map = { DEMO: 'kimi_demo_clicked', SELF_SERVICE: 'kimi_self_service_clicked', EXPERT_CALL: 'kimi_demo_clicked', LEARN_MORE: 'kimi_product_clicked' };
  const external = url && /^https?:\/\//i.test(url) && !/^https?:\/\/[^/]*stagwell/i.test(url);
  track(map[type] || 'kimi_product_clicked', { product: productId || null, cta: type, url: url || null });
  if (external) track('kimi_external_site_clicked', { product: productId || null, url });
  emit('handoff_click', { product: productId || null, cta: type, url: url || null });
  if (st.status === 'RECOMMENDATION') { st.status = 'COMPLETE'; st.uiAction = 'COMPLETE'; notify(); }
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
    suggestions: st.suggestions.slice(),
    hint: st.hint,
    question: st.currentQuestion ? { id: st.currentQuestion.id, field: st.currentQuestion.field || 'intent' } : null,
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

window.SAIKIMI = {
  start, answer, contact, clicked, state, onChange,
  validate: lead => { const v = validate(lead || {}); return v.error ? { ok: false, error: v.error, message: v.message } : { ok: true, lead: v.lead }; },
  recommendation: () => st.reco,
  result: () => ({ state: state(), reco: st.reco, discovery: discoveryPayload() }),
  reset() { st = blank(); deterministicNoted = false; return state(); },
  _interpret: interpret,     /* seams for tests */
  _absorb: absorb
};
})();
