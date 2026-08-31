/* ═══════════════════════════════════════════════════════════════════════════
   THE ENGINE — all of the demo's thinking, none of its drawing. Pure logic:
   attribution, the slot model, the free-text classifier, tiering and the
   routing decision. It never touches the DOM (the one exception is the
   CustomEvent it fires so a console can listen), so the UI can be rebuilt
   around it without moving a rule.

   Everything visitor-facing — questions, chips, domain labels, solution
   names, tier definitions, override reasons — is read from /data/*.json
   via window.STAGDATA (see data-loader.js). Copy and logic change in the
   JSON, never here. What lives in this file is only the machinery: which
   words point at which domain id, how a number becomes a tier, and the
   order the overrides are tested in.

   window.SAI:
     .ready                Promise — data loaded, session started
     .data                 the resolved STAGDATA bundle
     .session              { attribution, slots, research, humanAsk }
     .events               emit / list / stored / clear  ("sent to HubSpot")
     .captureAttribution() silent UTM + referrer capture, campaign prefill;
                           /p/{id} counts as ?utm_campaign={id} (real params win)
     .setSlot(n, v, src)   later writes win; visitor overwrites correct
     .classify(text)       → Promise<domain ids[]>, multi-domain, ranked
     .classifyFull(text)   → Promise<{domains,company,employees,human,live}>
     .tierFromEmployees(n) .tierFromText(t)   → 'smb'|'mid_market'|'enterprise'
     .route()              → the full decision object
     .extractDomain(text)  a website in the first message
     .reset()              fresh session (keeps the event log)
     ._ask(body, ms)       POST /api/ask, rejects on anything but ok:true
     ._classifyLLM         wired to /api/ask mode:'classify' — swap to stub it
     ._classifyFullLLM     the same call, whole answer instead of just domains
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

/* ── the vocabulary the demo speaks to "HubSpot" in. Exact strings; the
      event console groups on them, so nothing here is free-form. ───────── */
const EVENT_TYPES = [
  'session_started', 'attribution_captured', 'slot_filled', 'slot_corrected',
  'question_asked', 'question_skipped', 'answer_given',
  'research_started', 'research_step', 'research_done',
  'snapshot_viewed', 'capture_email', 'capture_consent', 'capture_declined',
  'route_decided', 'handoff_click', 'human_requested', 'journey_converted'
];

const TIERS = ['smb', 'mid_market', 'enterprise'];
const RING_KEY = 'sai-events';
const RING_CAP = 200;
const LLM_TIMEOUT_MS = 6000;

/* slots come from questions.json; company_domain and domain_detail are the
   two the flow needs that the top-level list doesn't name (q6 owns
   domain_detail, and a pasted website is not the same thing as a company
   name). Both are declared here so the session shape is stable before the
   JSON has loaded. */
const EXTRA_SLOTS = ['company_domain', 'domain_detail'];
const FALLBACK_SLOTS = ['problem_domains', 'company', 'role_seniority', 'size_tier',
  'timing_intent', 'product_interest', 'work_email', 'contact_consent'];

let DATA = {};

/* ═══════════════════════════════════════════════════════════════════════════
   TEXT NORMALISATION — one shape for everything we match against, so
   "brand's health" and "Brand Health" are the same phrase to the classifier.
   ═══════════════════════════════════════════════════════════════════════════ */
const norm = s => String(s == null ? '' : s)
  .toLowerCase()
  .replace(/[‘’]/g, "'")     /* curly → straight */
  .replace(/[–—]/g, '-')     /* en/em dash → hyphen */
  .replace(/'s\b/g, '')                /* brand's → brand */
  .replace(/'/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* a keyword matches on its own — not inside a longer word — and tolerates a
   trailing plural, so "monitor" catches "monitors" but never "monitoring
   station"'s neighbours and "research" never catches "researching". */
const kwRe = kw => new RegExp('(?<![a-z0-9])' + escRe(norm(kw)) + 's?(?![a-z0-9])');

/* ═══════════════════════════════════════════════════════════════════════════
   THE OFFLINE CLASSIFIER — sprint 1 ships this and only this. Keys are
   routing.json domain ids; values are the vocabulary a marketing leader
   actually types. Free text can carry several domains at once, and that is
   the point: two domains is how a multi-product opportunity surfaces
   (questions.json q1 notes, routing override 1).
   ═══════════════════════════════════════════════════════════════════════════ */
const KEYWORDS = {
  brand_health: [
    'brand health', 'brand tracking', 'brand tracker', 'tracking study', 'track my brand',
    'track our brand', 'always-on tracking', 'brand equity', 'equity', 'awareness',
    'unaided awareness', 'consideration', 'brand consideration', 'benchmark',
    'benchmarking', 'competitive benchmark', 'competitor benchmark', 'share of voice',
    'brand momentum', 'brand perception', 'brand performance', 'brand metrics',
    'competitive position', 'against competitors', 'versus competitors',
    'how is my brand doing', 'how our brand is doing', 'funnel metrics'
  ],
  research: [
    'survey', 'poll', 'polling', 'questionnaire', 'concept test', 'concept testing',
    'message testing', 'messaging test', 'creative testing', 'test creative',
    'test messaging', 'focus group', 'consumer research', 'market research', 'research',
    'research study', 'run a study', 'run research', 'field a study', 'respondent',
    'sample quality', 'insights study', 'ad hoc research', 'qual', 'quant'
  ],
  business_impact: [
    'prove', 'prove impact', 'business impact', 'moved the business', 'move the business',
    'roi', 'return on investment', 'cfo', 'board', 'pricing power', 'revenue',
    'market value', 'shareholder', 'financial impact', 'commercial impact', 'justify',
    'justify the spend', 'budget justification', 'defend the budget', 'bottom line',
    'business results', 'incrementality', 'marketing mix', 'mmm', 'payback',
    'growth driver', 'what the brand is worth'
  ],
  audiences: [
    'reach better audiences', 'better audiences', 'audience', 'audiences', 'targeting',
    'target audience', 'first-party', 'first party', '1st party', 'cdp',
    'data warehouse', 'dsp', 'activation', 'activate', 'media buying', 'ad spend',
    'wasted spend', 'walled garden', 'lookalike', 'segment', 'segmentation',
    'custom audience', 'programmatic', 'media planning', 'addressable',
    'identity resolution', 'audience building'
  ],
  influencer: [
    'influencer', 'influencer marketing', 'creator', 'creator marketing', 'creator program',
    'ugc', 'user-generated', 'user generated', 'brand ambassador', 'talent',
    'tiktok', 'instagram creator'
  ],
  reputation: [
    'reputation', 'crisis', 'crisis comms', 'risk', 'pr', 'public relations', 'comms',
    'communications', 'narrative', 'issues management', 'damage control', 'early warning',
    'before they become stories', 'sentiment', 'backlash', 'scandal', 'protect our brand'
  ],
  media_monitoring: [
    'media monitoring', 'monitor', 'monitoring', 'coverage', 'press', 'press coverage',
    'news coverage', 'media coverage', 'clipping', 'global media', 'multiple languages',
    'multi-language', 'multilingual', 'every language', 'broadcast', 'earned media',
    'share of coverage', 'mention', 'what is being said about us', 'globally'
  ],
  ai_visibility: [
    'chatgpt', 'chat gpt', 'gemini', 'perplexity', 'copilot', 'llm', 'ai answers',
    'ai search', 'ai model', 'ai overview', 'generative search', 'answer engine',
    'aeo', 'geo', 'describe my brand', 'describe our brand', 'ai visibility',
    'show up in ai', 'recommended by ai', 'ai assistant'
  ],
  real_world_behavior: [
    'foot traffic', 'footfall', 'visitation', 'store visit', 'store traffic', 'in-store',
    'physical location', 'location', 'location data', 'geolocation', 'real-world behavior',
    'real-world behaviour', 'say/do gap', 'say do gap', 'drive-to-store', 'retail visit',
    'venue', 'what people actually do'
  ],
  marketing_ops: [
    'fragmented', 'workflow', 'connect our tools', 'connect my tools', 'one system',
    'single system', 'marketing ops', 'marketing operations', 'martech', 'tech stack',
    'silo', 'siloed', 'disconnected', 'agentic', 'automation', 'automate',
    'operating system', 'too many tools', 'integrate our tools', 'end-to-end workflow'
  ]
};

/* a visitor asking for a person is not a domain — it's override 4. */
const HUMAN_PATTERNS = [
  /talk to (someone|a human|a person|a real person|sales|an expert|a rep|somebody)/,
  /speak (to|with) (someone|a human|a person|sales|an expert|somebody)/,
  /(book|schedule|set up|get) (a|an) (call|meeting|demo|time|conversation)/,
  /(hop|jump|get) on a call/,
  /contact sales/,
  /human being/,
  /real person/,
  /can i talk to/
];

/* compiled lazily so init can fold in the labels from routing.json */
let COMPILED = null;

function compileKeywords() {
  const seeds = {};
  Object.keys(KEYWORDS).forEach(id => { seeds[id] = KEYWORDS[id].slice(); });

  /* seed from the data too: every domain's own label, and every q1 chip
     label, so a tapped chip always classifies to the domain it declares. */
  (domainList()).forEach(d => {
    if (!seeds[d.id]) seeds[d.id] = [];
    const phrase = labelPhrase(d.label);
    if (phrase) seeds[d.id].push(phrase);
  });
  const q1 = questionById('q1');
  ((q1 && q1.chips) || []).forEach(chip => {
    if (chip && chip.domain && seeds[chip.domain]) {
      seeds[chip.domain].push(String(chip.label).replace(/[?.!]+$/, ''));
    }
  });

  COMPILED = Object.keys(seeds).map(id => ({
    id,
    terms: seeds[id]
      .map(k => norm(k))
      .filter((k, i, a) => k && a.indexOf(k) === i)
      .map(k => ({ kw: k, re: kwRe(k) }))
  }));
  return COMPILED;
}

/* the quotable half of a domain label: "Reach better audiences (build &
   activate from first-party data)" → "reach better audiences" */
function labelPhrase(label) {
  if (!label) return '';
  return norm(String(label).split(/\s*\(/)[0].replace(/[?.!]+$/, ''));
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATA ACCESSORS — every read of the contract goes through one of these, so
   a missing or half-loaded JSON file degrades instead of throwing.
   ═══════════════════════════════════════════════════════════════════════════ */
const routing = () => (DATA && DATA.routing) || {};
const domainList = () => (routing().domains || []).filter(d => d && d.id);
const domainById = id => domainList().find(d => d.id === id) || null;
const domainIds = () => {
  const fromData = domainList().map(d => d.id);
  return fromData.length ? fromData : Object.keys(KEYWORDS);
};
const questions = () => ((DATA && DATA.questions) || {});
const questionById = id => (questions().questions || []).find(q => q && q.id === id) || null;
const campaignById = id => (((DATA && DATA.campaigns) || {}).campaigns || [])
  .find(c => c && c.id === id) || null;
const slotNames = () => {
  const declared = questions().slots;
  const base = Array.isArray(declared) && declared.length ? declared : FALLBACK_SLOTS;
  return base.concat(EXTRA_SLOTS).filter((s, i, a) => a.indexOf(s) === i);
};

/* chip label for a stored chip value — "director_vp" → "Director / VP".
   Free-text answers aren't chip values, so they come back verbatim: that is
   how a why-line reads "your role (VP of Marketing)". */
function chipLabel(questionId, value, key) {
  if (value == null || value === '') return null;
  const q = questionById(questionId);
  const chips = (q && (q.chips || (q.askMode && q.askMode.chips))) || [];
  const hit = chips.find(c => c && String(c[key || 'value']) === String(value));
  return hit ? hit.label : String(value);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SESSION — nothing survives a reload (every demo visit starts clean); only
   the event log persists, because the "HubSpot" console is the one thing a
   presenter wants to still be there after a refresh.
   ═══════════════════════════════════════════════════════════════════════════ */
function blankSession() {
  const slots = {};
  slotNames().forEach(n => { slots[n] = n === 'problem_domains' ? [] : null; });
  return {
    attribution: {
      utm_campaign: null, utm_source: null, utm_medium: null,
      referrer: null, landedAt: null, product_interest: null
    },
    slots,
    slotSources: {},
    research: null,
    humanAsk: false
  };
}

let session = blankSession();

/* ═══════════════════════════════════════════════════════════════════════════
   THE EVENT BUS — everything the demo claims it "sends to HubSpot". Three
   destinations at once: an in-memory list (the console reads it live), a
   200-entry localStorage ring (survives the refresh), and a document
   CustomEvent (so any panel can subscribe without polling). Storage is
   wrapped end to end: a locked-down browser must cost us the ring, not the
   demo.
   ═══════════════════════════════════════════════════════════════════════════ */
const memory = [];

function readRing() {
  try {
    const raw = window.localStorage.getItem(RING_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}

function writeRing(list) {
  try {
    window.localStorage.setItem(RING_KEY, JSON.stringify(list.slice(-RING_CAP)));
  } catch (e) { /* private mode, quota, no storage — the demo carries on */ }
}

const events = {
  types: EVENT_TYPES.slice(),

  emit(type, payload) {
    const rec = { t: Date.now(), type: String(type), payload: payload === undefined ? null : payload };
    memory.push(rec);
    const ring = readRing();
    ring.push(rec);
    writeRing(ring);
    try {
      document.dispatchEvent(new CustomEvent('sai:event', { detail: rec }));
    } catch (e) { /* no document (node harness) — the log still stands */ }
    return rec;
  },

  /* the live array on purpose: the console can hold the reference */
  list() { return memory; },

  /* what survived the reload */
  stored() { return readRing(); },

  clear() {
    memory.length = 0;
    try { window.localStorage.removeItem(RING_KEY); } catch (e) { /* fine */ }
    return memory;
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   ATTRIBUTION — SPEC non-negotiable #4: captured silently on entry and it
   rides with every handoff after. Nothing here is ever shown or asked.
   ═══════════════════════════════════════════════════════════════════════════ */

/* A product landing is /p/{campaign} (vercel.json rewrites it to the campaign
   page, so the id only ever survives in the path). Standing on that page IS
   the campaign — it says exactly what ?utm_campaign={id} says, and it has to
   pre-fill the same slots, or the page's own creative would get asked back as
   a question. Only ids that campaigns.json actually declares count; a real
   utm param always wins, because that one came from the ad. */
const CAMPAIGN_PATH = /^\/p\/([a-z0-9-]+)\/?$/;

function campaignFromPath() {
  let pathname;
  try { pathname = (window.location && window.location.pathname) || ''; }
  catch (e) { return null; }
  const m = String(pathname).match(CAMPAIGN_PATH);
  if (!m) return null;
  return campaignById(m[1]) ? m[1] : null;
}

function captureAttribution() {
  const a = session.attribution;
  let params;
  try { params = new URLSearchParams(window.location.search || ''); }
  catch (e) { params = new URLSearchParams(''); }

  params.forEach((value, key) => {
    const k = String(key).toLowerCase();
    if (k.indexOf('utm_') === 0) a[k] = value;
    else if (k === 'campaign' && !a.utm_campaign) a.utm_campaign = value;
    else if (k === 'source' && !a.utm_source) a.utm_source = value;
    else if (k === 'product' || k === 'product_interest') a.product_interest = value;
  });

  const pathCampaign = campaignFromPath();
  if (pathCampaign && !a.utm_campaign) a.utm_campaign = pathCampaign;

  try { a.referrer = document.referrer || null; } catch (e) { a.referrer = null; }
  a.landedAt = new Date().toISOString();

  /* a known campaign id pre-fills what the ad already told us — the product
     landing shouldn't ask a question its own creative just answered. */
  const campaign = a.utm_campaign ? campaignById(a.utm_campaign) : null;
  const prefill = (campaign && campaign.prefill) || {};

  if (!a.product_interest && prefill.product_interest) a.product_interest = prefill.product_interest;

  events.emit('attribution_captured', Object.assign({}, a, {
    campaign: campaign ? campaign.id : null
  }));

  Object.keys(prefill).forEach(key => {
    if (key === 'attribution') return;          /* a flag, not a slot */
    if (!(key in session.slots)) return;
    setSlot(key, prefill[key], 'campaign');
  });

  return a;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SLOTS — later writes overwrite earlier ones, always. When a visitor
   overwrites a value we already had with a different one, that is a
   correction and it gets its own event: "visitor corrections always win"
   is a claim the event log has to be able to prove.
   ═══════════════════════════════════════════════════════════════════════════ */
const same = (a, b) => {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return a === b; }
};
const isEmpty = v => v == null || v === '' || (Array.isArray(v) && !v.length);

function setSlot(name, value, source) {
  const src = source || 'visitor';
  const had = session.slots[name];
  session.slots[name] = value;
  session.slotSources[name] = src;

  events.emit('slot_filled', { name, value, source: src });

  if (src === 'visitor' && !isEmpty(had) && !same(had, value)) {
    events.emit('slot_corrected', { name, from: had, to: value, source: src });
  }
  return value;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLASSIFICATION — the offline keyword pass, which is also the floor under
   the live one. _classifyLLM is the seam: an async fn(text) → domain ids that
   classify() awaits, falling back to keywords on any error, timeout or
   unusable answer. Sprint 2 wires it to /api/ask (see THE LIVE SEAM below);
   with no key set that call fails fast and this is what answers, so the demo
   still works offline (KIT-BRIEF).
   ═══════════════════════════════════════════════════════════════════════════ */
function detectHumanAsk(text) {
  const t = norm(text);
  return HUMAN_PATTERNS.some(re => re.test(t));
}

/* every distinct domain the text touches, strongest first — strength being
   the longest keyword that hit, then how many hit, then contract order. */
function classifyKeywords(text) {
  const t = norm(text);
  if (!t) return [];
  const known = domainIds();
  const order = id => { const i = known.indexOf(id); return i < 0 ? 999 : i; };

  return (COMPILED || compileKeywords())
    .filter(d => known.indexOf(d.id) !== -1)
    .map(d => {
      let longest = 0, hits = 0;
      d.terms.forEach(term => {
        if (term.re.test(t)) { hits++; if (term.kw.length > longest) longest = term.kw.length; }
      });
      return { id: d.id, longest, hits };
    })
    .filter(d => d.hits > 0)
    .sort((a, b) => (b.longest - a.longest) || (b.hits - a.hits) || (order(a.id) - order(b.id)))
    .map(d => d.id);
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('classify_timeout')), ms);
    Promise.resolve(promise).then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); }
    );
  });
}

function classify(text) {
  if (detectHumanAsk(text)) {
    session.humanAsk = true;
    events.emit('human_requested', { text: String(text || '') });
  }

  const fallback = () => classifyKeywords(text);

  if (typeof SAI._classifyLLM !== 'function') return Promise.resolve(fallback());

  return withTimeout(SAI._classifyLLM(String(text || '')), LLM_TIMEOUT_MS)
    .then(result => {
      const known = domainIds();
      const clean = (Array.isArray(result) ? result : [])
        .map(String)
        .filter(id => known.indexOf(id) !== -1)
        .filter((id, i, a) => a.indexOf(id) === i);
      return clean.length ? clean : fallback();
    })
    .catch(() => fallback());
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE LIVE SEAM — sprint 2. /api/ask holds the key and every system prompt;
   this side only knows the shape of the answer it gets back. Two seams, both
   swappable for a test double or a different backend:

     _classifyFullLLM(text)  → { domains, company, employees, human }
     _classifyLLM(text)      → domain ids   (what classify() consumes)

   Neither is allowed to be the reason a demo stalls. Every call is time-boxed
   twice — an abort on the request and withTimeout() around the promise — and
   every failure path lands on the offline keyword classifier, which is the
   only path that runs when no key is configured (KIT-BRIEF: the demo must
   work offline).
   ═══════════════════════════════════════════════════════════════════════════ */
const ASK_URL = '/api/ask';

/* One POST, one shape of answer: resolves with the body on ok:true and
   rejects on anything else — HTTP error, {ok:false}, abort, no fetch at all.
   Callers only ever have to write one .catch. */
function ask(body, ms) {
  if (typeof fetch !== 'function') return Promise.reject(new Error('no_fetch'));

  let ac = null, timer = null;
  try { ac = new AbortController(); } catch (e) { ac = null; }
  if (ac) timer = setTimeout(() => { try { ac.abort(); } catch (e) { /* gone */ } }, ms || LLM_TIMEOUT_MS);
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };

  return fetch(ASK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: ac ? ac.signal : undefined
  })
    .then(r => r.json())
    .then(
      j => { clear(); if (!j || j.ok !== true) throw new Error((j && j.error) || 'ask_failed'); return j; },
      e => { clear(); throw e; }
    );
}

function askClassify(text) {
  return ask({ mode: 'classify', prompt: String(text || '').slice(0, 300) }, LLM_TIMEOUT_MS)
    .then(j => ({
      domains: Array.isArray(j.domains) ? j.domains : [],
      company: j.company || null,
      employees: typeof j.employees === 'number' ? j.employees : null,
      human: j.human === true
    }));
}

/* A number in free text is only a headcount when the sentence says so.
   "a 3,000-person retailer" is a size; "the top 5 in our category" is not,
   and mistaking the second for the first would tier the visitor as SMB. */
const PEOPLE_HINT = /(employee|people|person|headcount|staff|workforce|fte|team of|seats|strong)/;

function employeesFromClaim(text) {
  const t = norm(text);
  if (!t || !/\d/.test(t) || !PEOPLE_HINT.test(t)) return null;
  return employeesFromText(t);
}

/* Everything one message can tell us, in one call. The flow uses this for
   the opening message and for every free-text answer after it: a website
   answers q2, a headcount answers q4, "can I talk to someone" is override 4,
   and the domains are still the routing decision. `live` says whether the
   model actually answered — the UI is allowed to say so, and must not claim
   it otherwise. */
function classifyFull(text) {
  const raw = String(text || '');
  const human = detectHumanAsk(raw);
  if (human) {
    session.humanAsk = true;
    events.emit('human_requested', { text: raw });
  }

  const offline = () => ({
    domains: classifyKeywords(raw),
    company: extractDomain(raw),
    employees: employeesFromClaim(raw),
    human,
    live: false
  });

  if (typeof SAI._classifyFullLLM !== 'function') return Promise.resolve(offline());

  return withTimeout(SAI._classifyFullLLM(raw), LLM_TIMEOUT_MS)
    .then(result => {
      const r = result || {};
      const known = domainIds();
      const domains = (Array.isArray(r.domains) ? r.domains : [])
        .map(String)
        .filter(id => known.indexOf(id) !== -1)
        .filter((id, i, a) => a.indexOf(id) === i);
      const off = offline();
      const employees = typeof r.employees === 'number' && isFinite(r.employees) && r.employees > 0
        ? r.employees : off.employees;
      return {
        /* the model leads, the keyword pass fills the gaps it left */
        domains: domains.length ? domains : off.domains,
        company: extractDomain(String(r.company || '')) || off.company,
        employees,
        human: human || r.human === true,
        live: true
      };
    })
    .catch(() => offline());
}

/* ═══════════════════════════════════════════════════════════════════════════
   TIERING — routing.json.tiers in code form. SMB under ~250, mid-market to
   ~2,500, enterprise above it (2,500 itself reads as enterprise: "2,500+"
   is the chip a visitor taps).
   ═══════════════════════════════════════════════════════════════════════════ */
function tierFromEmployees(n) {
  const v = typeof n === 'string' ? Number(String(n).replace(/[,\s]/g, '')) : n;
  if (typeof v !== 'number' || !isFinite(v) || v <= 0) return null;
  if (v < 250) return 'smb';
  if (v < 2500) return 'mid_market';
  return 'enterprise';
}

/* pull the first employee count out of free text: "under 50 people",
   "50–250", "2,500+", "about 900", "10k". A range answers on its lower
   bound, which is what the q4 chips mean ("50–250" is still SMB). */
function employeesFromText(text) {
  const t = norm(text).replace(/(\d),(\d)/g, '$1$2');
  const num = m => {
    let v = parseFloat(m);
    if (/k$/.test(m)) v *= 1000;
    return v;
  };
  const N = '(\\d+(?:\\.\\d+)?k?)';

  let m = t.match(new RegExp('(?:under|below|less than|fewer than|<)\\s*' + N));
  if (m) return Math.max(1, num(m[1]) - 1);

  m = t.match(new RegExp(N + '\\s*(?:\\+|or more|and up|plus)'));
  if (m) return num(m[1]) + 1;

  m = t.match(new RegExp('(?:over|above|more than|>)\\s*' + N));
  if (m) return num(m[1]) + 1;

  m = t.match(new RegExp(N + '\\s*(?:-|to)\\s*' + N));
  if (m) return num(m[1]);

  m = t.match(new RegExp(N));
  if (m) return num(m[1]);

  return null;
}

function tierFromText(text) {
  const t = norm(text);
  if (!t) return null;
  if (TIERS.indexOf(t) !== -1) return t;

  /* a q4 askMode chip carries its own tier — trust the contract first */
  const q4 = questionById('q4');
  const chips = (q4 && q4.askMode && q4.askMode.chips) || [];
  const chip = chips.find(c => c && norm(c.label) === t);
  if (chip && chip.tier) return chip.tier;

  if (/\d/.test(t)) {
    const tier = tierFromEmployees(employeesFromText(t));
    if (tier) return tier;
  }

  if (/(enterprise|global|multinational|multi-brand|multi brand|fortune 500|worldwide|huge|very large)/.test(t)) return 'enterprise';
  if (/(mid-market|mid market|midmarket|midsize|mid-size|medium|scale-?up|few hundred)/.test(t)) return 'mid_market';
  if (/(smb|small|startup|start-up|boutique|solo|founder|tiny|indie|one-person)/.test(t)) return 'smb';

  return null;
}

/* what the session actually knows about size, from whatever shape it's in:
   a tier id, a number, free text, or the q4 confirm chips read against
   research. */
function resolveTier() {
  const raw = session.slots.size_tier;
  const researched = session.research && session.research.employees != null
    ? tierFromEmployees(session.research.employees) : null;

  if (typeof raw === 'number') return tierFromEmployees(raw);
  if (typeof raw === 'string' && raw) {
    if (TIERS.indexOf(raw) !== -1) return raw;
    if (raw === 'confirm') return researched;
    if (raw === 'smaller' || raw === 'bigger') {
      const base = researched ? TIERS.indexOf(researched) : 1;
      const step = raw === 'smaller' ? -1 : 1;
      return TIERS[Math.min(TIERS.length - 1, Math.max(0, base + step))];
    }
    return tierFromText(raw) || researched;
  }
  return researched;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTING — routing.json.overrides_in_order, first match wins, then the
   domain × tier matrix. The prose conditions in the JSON are the spec; the
   predicates below are their implementation, keyed by the same order number
   so the route name and the why-line still come from the file.
   ═══════════════════════════════════════════════════════════════════════════ */
const OVERRIDE_TESTS = {
  1: ctx => ctx.domains.length >= 2,
  2: () => session.slots.timing_intent === 'exploring',
  3: ctx => session.slots.role_seniority === 'c_suite' &&
            (ctx.tier === 'mid_market' || ctx.tier === 'enterprise'),
  4: () => session.humanAsk === true
};

/* "reach better audiences" + your role (VP of Marketing) + timing (This quarter) */
function whyLine(domain, tier) {
  const parts = [];
  const phrase = labelPhrase(domain && domain.label);
  if (phrase) parts.push('"' + phrase + '"');

  const role = chipLabel('q3', session.slots.role_seniority);
  if (role) parts.push('your role (' + role + ')');

  if (tier) parts.push('company size (' + (tier === 'smb' ? 'SMB' : tier.replace(/_/g, '-')) + ')');

  const timing = chipLabel('q5', session.slots.timing_intent);
  if (timing) parts.push('timing (' + timing + ')');

  const detail = session.slots.domain_detail;
  if (detail && typeof detail === 'string') parts.push('"' + norm(detail) + '"');

  return parts.join(' + ');
}

let lastDecisionKey = null;

function route() {
  const known = domainIds();
  const domains = (Array.isArray(session.slots.problem_domains) ? session.slots.problem_domains : [])
    .map(String)
    .filter(id => known.indexOf(id) !== -1)
    .filter((id, i, a) => a.indexOf(id) === i);

  const tier = resolveTier();
  const primaryDomain = domains.length ? domains[0] : null;
  const primary = primaryDomain ? domainById(primaryDomain) : null;
  const cell = (primary && primary.cells && tier && primary.cells[tier]) || null;
  const cellNote = (cell && cell.note) || null;

  const ctx = { domains, tier };
  let decided = null, override = null;

  const rules = (routing().overrides_in_order || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const test = OVERRIDE_TESTS[rule.order];
    if (!test) continue;                    /* order 5 is "otherwise" */
    if (test(ctx)) {
      decided = rule.then;
      override = { order: rule.order, why: rule.why || null };
      break;
    }
  }

  /* no override: the matrix. With no tier there is no cell to read, so the
     visitor gets the snapshot and a light follow-up rather than a guess. */
  if (!decided) decided = (cell && cell.route) || 'follow_up';

  const matched = domains.map(id => {
    const d = domainById(id) || {};
    return {
      domain: id,
      label: d.label || id,
      solution: d.solution || null,
      why: whyLine(d, tier)
    };
  });

  const decision = { route: decided, primaryDomain, tier, matched, override, cellNote };

  /* one route_decided per distinct decision — the console shows the story,
     not every recalculation the UI happens to ask for. */
  const key = JSON.stringify([decided, primaryDomain, tier, domains, override && override.order]);
  if (key !== lastDecisionKey) {
    lastDecisionKey = key;
    events.emit('route_decided', decision);
  }

  return decision;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ODDS AND ENDS
   ═══════════════════════════════════════════════════════════════════════════ */
/* a website in the visitor's first message answers q2 (non-negotiable #1) */
function extractDomain(text) {
  const m = String(text || '').match(
    /(?:https?:\/\/)?(?:www\.)?([a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)*\.[a-z]{2,})(?:\/\S*)?/i);
  if (!m) return null;
  const host = m[1].toLowerCase();
  if (/@/.test(String(text).slice(0, m.index).slice(-1))) return null;   /* an email, not a site */
  return host;
}

function reset() {
  session = blankSession();
  lastDecisionKey = null;
  SAI.session = session;
  captureAttribution();
  return session;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLIC SURFACE
   ═══════════════════════════════════════════════════════════════════════════ */
const SAI = {
  TIERS: TIERS.slice(),
  EVENT_TYPES: EVENT_TYPES.slice(),
  data: DATA,
  session,
  events,
  captureAttribution,
  setSlot,
  classify,
  classifyKeywords,
  detectHumanAsk,
  classifyFull,
  tierFromEmployees,
  tierFromText,
  employeesFromText,
  employeesFromClaim,
  resolveTier,
  route,
  extractDomain,
  domainIds,
  domain: domainById,
  campaign: campaignById,
  campaignFromPath,             /* /p/{id} → the campaign id, or null */
  reset,

  /* the seams. Swap either for a test double; both fall back to keywords. */
  _ask: ask,                      /* research.js reuses this POST wrapper */
  _classifyFullLLM: askClassify,  /* async (text) => {domains,company,employees,human} */
  _classifyLLM: text => askClassify(text).then(r => r.domains)
};

SAI.ready = Promise.resolve(window.STAGDATA || {})
  .catch(() => ({}))
  .then(loaded => {
    DATA = loaded || {};
    SAI.data = DATA;
    session = blankSession();
    SAI.session = session;
    compileKeywords();
    events.emit('session_started', { landing: (window.location && window.location.pathname) || null });
    captureAttribution();
    return SAI;
  });

window.SAI = SAI;
})();
