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
     .boostScore(id)       → 0–3 ICP score for a domain (+2 industry, +1 role)
     .route()              → the full decision object (matched[] boost-ranked)
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
  'snapshot_viewed', 'capture_email', 'capture_phone', 'capture_consent', 'capture_declined',
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

   ── THE brand_health / competitive COLLISION, and the rule that settles it ──
   Adding `competitive` put two domains in reach of the same vocabulary, and
   classifyKeywords() returns EVERY domain that hits — so a phrase owned by
   both comes back as two domains, which is routing override 1, which sends a
   single-minded visitor to a consultative multi-product conversation they did
   not ask for. An overlap here is not a tie to be ranked; it is a bug.

   THE RULE (client decision, sprint 7): the BARE words "benchmark" and
   "benchmarking" belong to competitive. You cannot benchmark against
   yourself — the word always implies a comparison set, so the domain that
   exists to name that set owns it. Around that:

     · brand_health owns the words about the visitor's OWN numbers — brand
       health, brand tracking, equity, awareness, consideration, momentum,
       perception — and it keeps the multi-word phrases where the brand is
       explicitly the subject, "brand benchmarking" included.
     · competitive owns every word that names SOMEONE ELSE — competitor,
       rival, category leader, share, versus — plus bare benchmark(ing).

   Eight terms MOVED out of brand_health and into competitive: benchmark ·
   benchmarking · competitive benchmark · competitor benchmark · share of
   voice · competitive position · against competitors · versus competitors.
   A term now lives in exactly one list, so "competitive benchmarking" and
   "benchmark against our rivals" resolve to competitive, and "how is my
   brand doing" to brand_health.

   "brand benchmarking" is the one case a term list alone cannot settle, and
   ECLIPSE (below) is what settles it.
   ═══════════════════════════════════════════════════════════════════════════ */
const KEYWORDS = {
  brand_health: [
    'brand health', 'brand tracking', 'brand tracker', 'tracking study', 'track my brand',
    'track our brand', 'always-on tracking', 'brand equity', 'equity', 'awareness',
    'unaided awareness', 'consideration', 'brand consideration',
    'brand momentum', 'brand perception', 'brand performance', 'brand metrics',
    'brand benchmark', 'brand benchmarking',
    'how is my brand doing', 'how our brand is doing', 'funnel metrics'
  ],
  competitive: [
    'competitor', 'competitors', 'competitive', 'competitive analysis',
    'competitive intelligence', 'competitive benchmarking', 'competitive benchmark',
    'competitor benchmark', 'benchmark', 'benchmarking', 'rival', 'rivals',
    'market share', 'share of voice', 'category leader', 'stack up', 'stacks up',
    'outperform', 'losing share', 'blind spot', 'versus', 'head to head',
    "who's winning", 'competitive position', 'against competitors', 'versus competitors'
  ],
  research: [
    'survey', 'poll', 'polling', 'questionnaire', 'concept test', 'concept testing',
    'message testing', 'messaging test', 'creative testing', 'test creative',
    'test messaging', 'focus group', 'consumer research', 'market research', 'research',
    'research study', 'run a study', 'run research', 'field a study',
    'insights study', 'ad hoc research', 'qual', 'quant'
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
  /* Deliberately no bare 'lead'/'leads': it is a substring of "leadership",
     "leading" and "market leader", all of which belong elsewhere. And nothing
     of the "book a call" shape either — that is override 4 (the visitor
     asking for a person), not a domain. */
  leads: [
    'inbound lead', 'inbound leads', 'lead gen', 'lead generation', 'lead qualification',
    'qualify leads', 'qualifying leads', 'speed to lead', 'hand-raise', 'hand raiser',
    'missed call', 'missed calls', 'unanswered call', 'unanswered calls',
    'answer the phone', 'inbound calls', 'inbound enquiries', 'inbound inquiries',
    'voice agent', 'voice ai', 'call centre', 'call center', 'contact centre',
    'contact center', 'after-hours', 'after hours', 'appointment booking',
    'book appointments', 'follow up on leads', 'leads go cold', 'response time',
    /* the rest of what a voice-and-chat workforce answers: service, retention,
       feedback — NewVoices' own four use cases, not just the first */
    'support ticket', 'support tickets', 'tier-1 support', 'tier 1 support', 'first-line support',
    'front-line support', 'frontline support', 'customer support', 'help desk', 'helpdesk',
    'lapsing customers', 'lapsed customers', 'win back', 'winning back', 'win-back', 'churn',
    'retention calls', 'collect feedback', 'post-call feedback', 'feedback after the call',
    'customer feedback', 'nps', 'payment recovery', 'recover payments', 'failed payments'
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
  ],
  /* Agent Cloud: the team's access to AI itself, not a marketing outcome.
     Deliberately no bare 'chatgpt' or 'gemini' — those belong to ai_visibility
     (being recommended BY the assistants); here the tell is governance and
     access language. */
  ai_workspace: [
    'agent cloud', 'ai workspace', 'ai tools for the team', 'ai tooling', 'llm access', 'model access',
    'enterprise chatgpt', 'chatgpt enterprise', 'claude for the team', 'sanctioned ai', 'unsanctioned ai',
    'shadow ai', 'ai governance', 'ai policy', 'ai adoption', 'custom assistant', 'custom assistants',
    'ai assistants', 'build assistants', 'internal assistant', 'gen ai', 'generative ai', 'genai',
    'one login', 'single login', 'ai subscriptions', 'too many ai tools', 'data never trains',
    'secure ai', 'ai securely', 'ai safely', 'prompt library', 'ai for the whole team'
  ],
  /* sample_quality: the PEOPLE behind the research, not the survey tool.
     'respondent' and 'sample quality' moved here from research (Sep 2). */
  sample_quality: [
    'respondent', 'respondents', 'sample quality', 'sample supply', 'research sample', 'verified respondents',
    'verified sample', 'panel', 'panel quality', 'panel provider', 'survey fraud', 'fraudulent respondents',
    'bots in our survey', 'bot respondents', 'data quality of our panel', 'b2b respondents', 'b2b sample',
    'consumer sample', 'real people behind', 'respondent fraud', 'sample vendor', 'sample partner'
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
    humanAsk: false,
    impactLanguage: false
  };
}

let session = blankSession();

/* ═══════════════════════════════════════════════════════════════════════════
   THE EVENT BUS — everything the demo claims it "sends to HubSpot". Three
   destinations at once: an in-memory list (the console reads it live), a
   200-entry sessionStorage ring (survives a refresh, dies with the tab), and
   a document CustomEvent (so any panel can subscribe without polling).
   Storage is wrapped end to end: a locked-down browser must cost us the
   ring, not the demo.

   NOTHING PERSONAL IN THE TRAIL. Every payload passes through redact()
   before it is kept, stored or dispatched: an email address becomes its
   domain ("@nike.com"), a phone number becomes "[phone]", and the two slots
   that hold contact details are reduced the same way. QA (Sep 2) found the
   raw address in slot_filled, answer_given and human_requested — and in
   localStorage after the tab was closed — two rows below a capture_email
   that had carefully kept only the domain. One scrub at the bus fixes every
   emitter at once, present and future. The ring moved from localStorage to
   sessionStorage for the same reason: the demo's own event trail should not
   outlive the visit.
   ═══════════════════════════════════════════════════════════════════════════ */
const memory = [];

function readRing() {
  try {
    const raw = window.sessionStorage.getItem(RING_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) { return []; }
}

function writeRing(list) {
  try {
    window.sessionStorage.setItem(RING_KEY, JSON.stringify(list.slice(-RING_CAP)));
  } catch (e) { /* private mode, quota, no storage — the demo carries on */ }
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
/* seven or more digits, allowing the separators people actually type */
const PHONE_RE = /(?:\+?\d[\s().-]*){7,}\d/g;
const CONTACT_SLOTS = { work_email: 'email', phone: 'phone' };

function redactText(str) {
  return String(str).replace(EMAIL_RE, (m, dom) => '@' + dom.toLowerCase()).replace(PHONE_RE, '[phone]');
}

function redact(value, depth) {
  const d = depth || 0;
  if (value == null || d > 6) return value;
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(v => redact(v, d + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = redact(value[k], d + 1);
    return out;
  }
  return value;
}

/* slot_filled / slot_corrected carry a slot NAME and a value; the two contact
   slots are reduced to what capture_email already keeps: the domain, or the
   fact that a number was given. */
function redactPayload(type, payload) {
  if (payload == null || typeof payload !== 'object') return redact(payload);
  const p = Object.assign({}, payload);
  const kind = CONTACT_SLOTS[p.name];
  if ((type === 'slot_filled' || type === 'slot_corrected') && kind) {
    const shrink = v => {
      if (v == null || v === '') return v;
      if (kind === 'email') { const m = String(v).match(/@([^\s@]+)$/); return m ? '@' + m[1].toLowerCase() : '[email]'; }
      return '[phone]';
    };
    if ('value' in p) p.value = shrink(p.value);
    if ('from' in p) p.from = shrink(p.from);
    if ('to' in p) p.to = shrink(p.to);
    return p;
  }
  return redact(p);
}

const events = {
  types: EVENT_TYPES.slice(),

  emit(type, payload) {
    const rec = { t: Date.now(), type: String(type), payload: payload === undefined ? null : redactPayload(String(type), payload) };
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
    try { window.sessionStorage.removeItem(RING_KEY); } catch (e) { /* fine */ }
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

/* THE IMPACT-LANGUAGE SOFT TRIGGER (client, Sep 2). routing.json's enterprise
   cells for brand_health and competitive carried a note — "if 'prove impact'
   or CFO language is also present → consultative with the business-impact
   product" — that the matrix never read. Now it does: the phrases below, seen
   anywhere in the visitor's own words, set session.impactLanguage, and
   route() adds business_impact as a SECOND domain for an enterprise visitor
   whose primary is brand health or competitive, so override 1 fires and the
   business-impact product rides along. \bboard\b keeps "onboarding" and
   "billboard" out. */
const IMPACT_PATTERNS = [
  /prove (the |our |its )?(impact|roi|value|worth)/, /\bcfo\b/, /\bboard\b/, /pricing power/,
  /business impact/, /justify (the |our )?(spend|budget|investment)/, /market value/, /\broi\b/,
  /return on (marketing|brand|investment)/, /shareholder/
];
function detectImpactLanguage(text) {
  const t = norm(text);
  return IMPACT_PATTERNS.some(re => re.test(t));
}
function noteImpactLanguage(text) {
  if (detectImpactLanguage(text)) session.impactLanguage = true;
}

/* one normalised phrase inside another, on whole-word boundaries:
   "benchmarking" is in "brand benchmarking", but "pr" is not in
   "pricing power". Both sides are already norm()-ed. */
function containsPhrase(hay, needle) {
  return new RegExp('(?<![a-z0-9])' + escRe(needle) + '(?![a-z0-9])').test(hay);
}

/* ── ECLIPSE ──
   Longest-match orders the answer; it does not decide OWNERSHIP between two
   domains, and it has to. Every domain that hits is returned, and two
   returned domains is routing override 1 — a consultative multi-product
   route. So a single-minded sentence that grazes two vocabularies would
   reroute the visitor, which is worse than either answer alone.

   When one domain matched a phrase that wholly CONTAINS every phrase another
   domain matched, the shorter domain has not found a second problem — it has
   found a fragment of the first. "brand benchmarking" is brand_health asking
   about its own numbers, not brand_health AND competitive; competitive's only
   evidence, "benchmarking", is a word inside brand_health's phrase.

   A domain is therefore eclipsed only when EVERY term it matched sits, whole-
   word, inside a strictly longer term some other domain matched. One term of
   its own anywhere in the sentence and it survives — which is why a genuine
   two-problem message ("reach better audiences and prove it moved the
   business") still comes back as two domains. Strictly-longer also makes
   mutual eclipse impossible, so the result can never come back empty. */
function eclipsed(d, all) {
  return all.some(o => o.id !== d.id && d.terms.every(kw =>
    o.terms.some(other => other.length > kw.length && containsPhrase(other, kw))));
}

/* every distinct domain the text touches, strongest first — strength being
   the longest keyword that hit, then how many hit, then contract order. */
function classifyKeywords(text) {
  const t = norm(text);
  if (!t) return [];
  const known = domainIds();
  const order = id => { const i = known.indexOf(id); return i < 0 ? 999 : i; };

  const scored = (COMPILED || compileKeywords())
    .filter(d => known.indexOf(d.id) !== -1)
    .map(d => {
      const terms = [];
      let longest = 0;
      d.terms.forEach(term => {
        if (term.re.test(t)) { terms.push(term.kw); if (term.kw.length > longest) longest = term.kw.length; }
      });
      return { id: d.id, longest, hits: terms.length, terms };
    })
    .filter(d => d.hits > 0);

  return scored
    .filter(d => !eclipsed(d, scored))
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
  noteImpactLanguage(text);
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
  noteImpactLanguage(raw);
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
/* "we are about seven thousand people" is a headcount too. Number words are
   folded into digits before any of the numeric patterns run, so a typed
   correction at q4 is heard (QA, Sep 2: it was stored verbatim and the
   researched figure silently won). */
const SMALL_WORDS = { zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10,
  eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19,
  twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90, a:1, an:1, couple:2, few:3, dozen:12 };
function expandNumberWords(t) {
  const re = /\b((?:(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|a|an|couple(?: of)?|few|dozen|hundred|thousand|million|and|-)\s*)+)\b/g;
  return String(t).replace(re, m => {
    const words = m.toLowerCase().replace(/-/g, ' ').replace(/\bof\b/g, '').split(/\s+/).filter(Boolean);
    if (!words.some(w => w in SMALL_WORDS || /^(hundred|thousand|million)$/.test(w))) return m;
    if (words.every(w => w === 'a' || w === 'an' || w === 'and')) return m;
    let total = 0, cur = 0, seen = false;
    for (const w of words) {
      if (w === 'and') continue;
      if (w in SMALL_WORDS) { cur += SMALL_WORDS[w]; seen = true; }
      else if (w === 'hundred') { cur = (cur || 1) * 100; seen = true; }
      else if (w === 'thousand') { total += (cur || 1) * 1000; cur = 0; seen = true; }
      else if (w === 'million') { total += (cur || 1) * 1000000; cur = 0; seen = true; }
    }
    return seen ? String(total + cur) : m;
  });
}

function employeesFromText(text) {
  const t = expandNumberWords(norm(text)).replace(/(\d),(\d)/g, '$1$2');
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
  const t = expandNumberWords(norm(text));
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

/* ═══════════════════════════════════════════════════════════════════════════
   ICP BOOSTS (sprint 6) — routing.json already says who each domain is for:
   industryBoost lists the categories that domain sells into, icpRoles the
   titles that buy it. When a visitor names two or more problems, those two
   lists are the only evidence in the contract for which problem to lead
   with — so they, and nothing else, order the match.

   THE GATE: boosts change ranking, never override the matrix. Everything
   below reorders matched[] (and therefore primaryDomain); the route itself
   is still the first passing override, else the primary domain's own cell,
   tested exactly as it was before. Two consequences worth naming:
     · a single-domain visitor is untouched — one domain has nothing to
       reorder, and a score of 3 does not promote it out of its cell;
     · override 1 (2+ domains → consultative) fires for every visitor whose
       order could change at all, so a reordering can never move the route.
   ═══════════════════════════════════════════════════════════════════════════ */

/* q3 stores four chip values; routing.json writes titles the way a marketer
   would ("Agency MD", "Chief Data Officer", "Head of Insights"). This is the
   join between the two vocabularies — a seniority matches a domain's ICP
   when any of its words appears as a whole word in any icpRoles entry. */
const ROLE_AFFINITY = {
  c_suite:     ['cmo', 'cco', 'cfo', 'chief', 'md'],
  director_vp: ['vp', 'director', 'head'],
  founder:     ['founder', 'owner'],
  manager:     ['manager']
};

/* +2 — research.industry is free text (the model's own words, or a seeded
   category), and industryBoost entries are short category names, so the
   comparison has to run both ways: "Retail & Ecommerce" contains "Retail",
   and "QSR" is contained by "QSR / fast casual". Anything shorter than two
   characters is treated as unknown rather than as a match on everything. */
function industryBoosted(domain) {
  const industry = norm(session.research && session.research.industry);
  if (industry.length < 2) return false;
  return ((domain && domain.industryBoost) || []).some(entry => {
    const t = norm(entry);
    return t.length >= 2 && (t.indexOf(industry) !== -1 || industry.indexOf(t) !== -1);
  });
}

/* +1 — the visitor's seniority lands inside this domain's icpRoles. */
function roleBoosted(domain) {
  const tokens = ROLE_AFFINITY[session.slots.role_seniority];
  if (!tokens) return false;
  return ((domain && domain.icpRoles) || []).some(role => {
    const t = norm(role);
    return tokens.some(tok => kwRe(tok).test(t));
  });
}

/* the whole score in one number: 0–3. Public as SAI.boostScore(id) so a
   surface can explain an ordering without re-deriving the rule. */
function boostScore(domainId) {
  const d = (domainId && typeof domainId === 'object') ? domainId : domainById(domainId);
  if (!d) return 0;
  return (industryBoosted(d) ? 2 : 0) + (roleBoosted(d) ? 1 : 0);
}

/* stable sort, highest first: ties keep the order the visitor said them in.
   (Array#sort is stable per ES2019, but the index tiebreak states it rather
   than relying on it.) */
function rankByBoost(domains) {
  if (domains.length < 2) return domains.slice();
  return domains
    .map((id, i) => ({ id, i, boost: boostScore(id) }))
    .sort((a, b) => (b.boost - a.boost) || (a.i - b.i))
    .map(x => x.id);
}

let lastDecisionKey = null;

function route() {
  const known = domainIds();
  const stated = (Array.isArray(session.slots.problem_domains) ? session.slots.problem_domains : [])
    .map(String)
    .filter(id => known.indexOf(id) !== -1)
    .filter((id, i, a) => a.indexOf(id) === i);

  const tier = resolveTier();

  /* the soft trigger (see detectImpactLanguage): enterprise + brand or
     competitive primary + impact language → business_impact joins as a second domain */
  let softTrigger = null;
  if (tier === 'enterprise' && session.impactLanguage === true &&
      stated.some(id => id === 'brand_health' || id === 'competitive') &&
      stated.indexOf('business_impact') === -1 && known.indexOf('business_impact') !== -1) {
    stated.push('business_impact');
    softTrigger = 'impact_language';
  }

  /* the one thing boosts do: which of the visitor's problems leads. */
  const domains = rankByBoost(stated);
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
    softTrigger,
      domain: id,
      label: d.label || id,
      solution: d.solution || null,
      why: whyLine(d, tier),
      boost: boostScore(d.id ? d : id)    /* why this one is where it is */
    };
  });

  const decision = { route: decided, primaryDomain, tier, matched, override, cellNote, softTrigger };

  /* one route_decided per distinct decision — the console shows the story,
     not every recalculation the UI happens to ask for. */
  const key = JSON.stringify([decided, primaryDomain, tier, domains, override && override.order, softTrigger]);
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
  boostScore,                   /* 0–3: ICP evidence for leading with a domain */
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
