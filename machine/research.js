/* ═══════════════════════════════════════════════════════════════════════════
   RESEARCH — what the machine does while the visitor is still typing.

   A website in the first message starts this (SPEC non-negotiable #1) and it
   runs alongside the questions: read the site, size the company, map the
   competitive set, score the brand signal. One of those four steps is real —
   the sizing call to /api/ask — and the other three are the demo's declared
   fiction, seeded from the domain so the same site always produces the same
   numbers.

   It NARRATES. The client's words: "if we are using an llm in the background
   to do research we should have good progress indicators that explain what we
   are doing." So every step announces itself on SAI.events before it runs,
   with a label written for a human to read and a `live` flag saying whether
   that particular step is talking to a model. The UI renders those labels
   verbatim; nothing in this file draws anything.

     research_started  { domain }
     research_step     { step, label, live, index, total }   ×4, in order
     research_done     { research }

   The honesty boundary (HANDOFF.md house rules) is the whole design here.
   When the model says it knows the company we use its facts and mark
   confidence 'high' / live true. When it says known:false — or the call fails,
   or there is no key at all — we fall to seeded fiction, mark confidence
   'low' / live false, and the competitor names are invented rather than real
   brands. The SPEC forbids stating a fact about a real company that we made
   up, so an unrecognised domain never borrows a real competitor.

   window.SAIRESEARCH:
     .run(domain)      → Promise<research>, idempotent per domain per session
     .done(domain)     → the finished object, or null
     .pending(domain)  → the in-flight promise, or null   (omit domain for any)
     .reset()          → drop the cache (a new SAI.session does this by itself)
     ._timing          → the beats, in ms; tests shrink them
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const STEP_COUNT = 4;

/* Two of these are pure theatre and say so. `ask` is the real budget: the
   server aborts at 12s, so waiting longer here would only hide a dead call. */
const timing = { read: 600, peers: 300, signals: 500, ask: 12000 };

const wait = ms => new Promise(r => { if (ms > 0) setTimeout(r, ms); else r(); });

const engine = () => (typeof window !== 'undefined' && window.SAI) || null;

function emit(type, payload) {
  const SAI = engine();
  try { if (SAI && SAI.events) SAI.events.emit(type, payload); }
  catch (e) { /* an event bus that fails must not take the research with it */ }
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE SEEDED GENERATOR — deterministic fiction. Same domain, same company,
   every time, on every machine: a demo that reshuffles its own numbers
   between run-throughs is a demo nobody trusts.
   ═══════════════════════════════════════════════════════════════════════════ */
function hash32(str) {
  let h = 2166136261;
  const s = String(str == null ? '' : str);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/* xorshift32 — a stream of draws from one seed, so each field is independent
   without needing a second hash of the same string. */
function rng(seed) {
  let x = (seed >>> 0) || 0x9e3779b9;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;  x >>>= 0;
    return x / 4294967296;
  };
}

const pick = (list, draw) => list[Math.floor(draw * list.length) % list.length];

/* Second-level domains that are part of the suffix, not the name:
   "my-shop.co.uk" is My Shop, not Co. */
const SLD = ['co', 'com', 'org', 'net', 'gov', 'ac', 'edu'];

function nameFromDomain(domain) {
  const parts = String(domain || '').toLowerCase().split('.').filter(Boolean);
  if (!parts.length) return null;
  let labels = parts.slice(0, -1);
  if (labels.length > 1 && SLD.indexOf(labels[labels.length - 1]) !== -1) labels = labels.slice(0, -1);
  if (labels.length > 1 && labels[0] === 'www') labels = labels.slice(1);
  const word = labels[labels.length - 1] || parts[0];
  return word.split(/[-_]/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || null;
}

/* Categories, not claims — broad enough that the fiction reads as a
   placeholder rather than an assertion about anyone real. */
const INDUSTRIES = [
  'Retail & Ecommerce', 'Consumer Products', 'Financial Services',
  'Travel & Hospitality', 'Media & Entertainment', 'Healthcare',
  'Technology', 'Food & Beverage', 'Automotive', 'Telecom',
  'Professional Services', 'Fashion & Apparel'
];

/* SMB / mid-market / enterprise bands from routing.json, so the seeded size
   lands somewhere the routing matrix has a real cell for. */
const BANDS = [[40, 240], [260, 2400], [2600, 24000]];

/* Invented morphemes, deliberately not surnames or real trade names: the
   fallback competitive set must be plausible enough to demo and obviously
   nobody's actual brand. Real competitors only ever come from the model,
   and only when it says it knows the company. */
const STEM_A = ['Ver', 'Kyn', 'Sol', 'Ard', 'Bly', 'Corv', 'Dre', 'Elm', 'Fen', 'Grav',
  'Hal', 'Iv', 'Jun', 'Kir', 'Lum', 'Mar', 'Ob', 'Pell', 'Quor', 'Riv',
  'Sab', 'Thorn', 'Urs', 'Vell', 'Wyn', 'Yarr', 'Zeph'];
const STEM_B = ['ora', 'ine', 'ux', 'ary', 'ic', 'en', 'isk', 'ova', 'elle', 'ard',
  'on', 'ith', 'ael', 'ura'];
const SUFFIX = ['Group', 'Labs', 'Brands', 'Collective', '& Co', 'Works', 'Partners', 'Studio'];

function roundish(n) {
  if (n < 500) return Math.round(n / 10) * 10;
  if (n < 5000) return Math.round(n / 50) * 50;
  return Math.round(n / 500) * 500;
}

function seeded(domain) {
  const draw = rng(hash32(domain));
  const band = BANDS[Math.floor(draw() * BANDS.length) % BANDS.length];
  const employees = roundish(band[0] + draw() * (band[1] - band[0]));
  const industry = pick(INDUSTRIES, draw());

  const competitors = [];
  let guard = 0;
  while (competitors.length < 3 && guard++ < 40) {
    const n = pick(STEM_A, draw()) + pick(STEM_B, draw()) + ' ' + pick(SUFFIX, draw());
    if (competitors.indexOf(n) === -1) competitors.push(n);
  }

  return { name: nameFromDomain(domain), employees, industry, competitors };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE RUN
   ═══════════════════════════════════════════════════════════════════════════ */
const normDomain = v => {
  const m = String(v == null ? '' : v).trim().toLowerCase()
    .match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)*\.[a-z]{2,})(?:[/?#]|$)/);
  return m ? m[1] : null;
};

let inflight = {};      /* domain → promise */
let results = {};       /* domain → finished research object */
let boundSession = null;

/* "Idempotent per domain per session": SAI.reset() hands out a new session
   object, and that is the signal to forget everything we learned in the last
   one. Cheaper and less error-prone than asking every caller to remember. */
function syncSession() {
  const SAI = engine();
  const current = SAI ? SAI.session : null;
  if (current !== boundSession) {
    boundSession = current;
    inflight = {};
    results = {};
  }
}

async function execute(domain) {
  const SAI = engine();
  const started = Date.now();
  const seed = seeded(domain);
  const steps = [];

  emit('research_started', { domain });

  const narrate = (step, label, live) => {
    const rec = { step, label, live: !!live, index: steps.length + 1, total: STEP_COUNT };
    steps.push(rec);
    emit('research_step', rec);
    return rec;
  };

  /* (a) read — mock. The beat exists so the visitor sees the machine start
     before the slow step, not so anything is actually fetched. */
  narrate('read', 'Reading ' + domain + '…', false);
  await wait(timing.read);

  /* (b) size — the one real call in the file. */
  const canAsk = !!(SAI && typeof SAI._ask === 'function' && typeof fetch === 'function');
  narrate('size', 'Sizing the company and category…', canAsk);

  let known = null;
  if (canAsk) {
    try {
      const j = await SAI._ask({ mode: 'research', domain }, timing.ask);
      if (j && j.ok === true && j.known === true) known = j;
    } catch (e) { /* no key, timeout, upstream down — the fiction takes over */ }
  }

  /* (c) peers — the model's real competitive set if it gave us one, invented
     names otherwise. Never a real brand name attached to a company we could
     not identify. */
  const realPeers = known && Array.isArray(known.competitors)
    ? known.competitors.map(c => String(c).trim()).filter(Boolean).slice(0, 3) : [];
  narrate('peers', 'Mapping the competitive set…', realPeers.length > 0);
  await wait(timing.peers);

  /* (d) signals — always seeded. This is the demo's fiction and the snapshot
     module says "illustrative" out loud. */
  narrate('signals', 'Scoring brand signal (illustrative)…', false);
  await wait(timing.signals);

  /* 'high' is what turns q4 into a one-tap confirm, and that copy reads
     "{company} is around {employees} people, in {industry}" — so it takes a
     model that recognised the company AND gave us all three. Recognised but
     half-answered is still live (the name is real) and still 'low', because
     the sentence we would have to write cannot be written from it. */
  const whole = !!(known && known.name && known.employees != null && known.industry);

  const research = {
    domain,
    name: (known && known.name) || seed.name,
    employees: (known && known.employees != null) ? known.employees : seed.employees,
    industry: (known && known.industry) || seed.industry,
    competitors: realPeers.length ? realPeers : seed.competitors,
    confidence: whole ? 'high' : 'low',
    live: !!known,
    steps,
    ms: Date.now() - started
  };

  results[domain] = research;
  if (SAI && SAI.session) SAI.session.research = research;
  emit('research_done', { research });
  return research;
}

function run(input) {
  const domain = normDomain(input);
  if (!domain) return Promise.resolve(null);

  syncSession();
  if (results[domain]) return Promise.resolve(results[domain]);
  if (inflight[domain]) return inflight[domain];

  /* the cache holds the promise, not the result, so two callers in the same
     tick share one run — the landing page and the flow both start research
     from the same first message. */
  const p = execute(domain).catch(err => {
    delete inflight[domain];
    throw err;
  });
  inflight[domain] = p;
  return p;
}

window.SAIRESEARCH = {
  run,
  done(domain) {
    syncSession();
    const d = normDomain(domain);
    return (d && results[d]) || null;
  },
  pending(domain) {
    syncSession();
    if (domain == null) {
      const keys = Object.keys(inflight).filter(k => !results[k]);
      return keys.length ? inflight[keys[0]] : null;
    }
    const d = normDomain(domain);
    return (d && !results[d] && inflight[d]) || null;
  },
  reset() { inflight = {}; results = {}; boundSession = engine() ? engine().session : null; },

  /* exposed for the tests and for anyone tuning the pacing of the demo */
  _timing: timing,
  _seeded: seeded,
  _nameFromDomain: nameFromDomain
};
})();
