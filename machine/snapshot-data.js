/* ═══════════════════════════════════════════════════════════════════════════
   SNAPSHOT DATA — the numbers behind W4, and nothing that draws them.

   S4 is the moment the demo is built around: five answers in, the machine
   hands back a page about YOUR brand. Everything on that page except the
   company name is fiction, and the fiction has two rules.

     1. It is DETERMINISTIC. Same company, same numbers, on every machine,
        in every run-through. A demo that reshuffles its own scores between
        rehearsal and the room is a demo nobody trusts. Every generator here
        is seeded from the domain (or, failing that, the company name).

     2. It is HONEST about being fiction — `illustrative: true` rides on the
        object, the module copy says so out loud, and the brand is never
        best-in-class. W4's own example trails its leader by 19 points,
        because the gap IS the sales story: a snapshot that tells every
        visitor they are winning has nothing to sell them.

   And one prohibition, from the SPEC acceptance list: every visitor-facing
   diagnostic string is free of product names. The findings talk about
   capabilities — awareness, consideration, answer coverage, momentum — and
   never about the tools that would measure them. Products get named at
   routing, by name, once. Not here.

   window.SAISNAPDATA:
     .build(session)          → the whole object the snapshot renders
     .rankActions(route)      → W4's three bottom tiles, ranked by routing
     .pdfMeta(session)        → { filename, title } for the print view
     .emailCaptured(email, consent, phone)
                              → capture_email / capture_phone /
                                capture_consent / journey_converted
                                (email domain only; the phone as given/not)
     .declined()              → capture_declined, and nothing else
     .viewed()                → snapshot_viewed, once per session
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   SEEDED DRAWS — same hash and stream as research.js, deliberately: the two
   files invent different things about the same company and should agree
   about what "deterministic" means.
   ═══════════════════════════════════════════════════════════════════════════ */
function hash32(str) {
  let h = 2166136261;
  const s = String(str == null ? '' : str);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed) {
  let x = (seed >>> 0) || 0x9e3779b9;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;  x >>>= 0;
    return x / 4294967296;
  };
}

/* one stream per module, each hashed off the same seed string with its own
   tag: adding a draw to the AI module must not move the competitive scores. */
const stream = (seed, tag) => rng(hash32(String(seed) + '|' + tag));

const pick = (list, draw) => list[Math.floor(draw * list.length) % list.length];
const between = (draw, lo, hi) => lo + Math.floor(draw * (hi - lo + 1));   /* inclusive */

const engine = () => (typeof window !== 'undefined' && window.SAI) || null;
const flow   = () => (typeof window !== 'undefined' && window.SAIFLOW) || null;
const rsrch  = () => (typeof window !== 'undefined' && window.SAIRESEARCH) || null;

function emit(type, payload) {
  const SAI = engine();
  try { if (SAI && SAI.events) SAI.events.emit(type, payload); }
  catch (e) { /* a broken bus must not take the snapshot with it */ }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   WHO THIS IS ABOUT
   ═══════════════════════════════════════════════════════════════════════════ */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five',
  'six', 'seven', 'eight', 'nine', 'ten'];

function currentSession(given) {
  if (given && typeof given === 'object') return given;
  const SAI = engine();
  return (SAI && SAI.session) || null;
}

function slotsOf(session) {
  return (session && session.slots) || {};
}

/* the domain is the seed of choice — it is the one string that is the same
   whether the model recognised the company or we invented it. */
function domainOf(session) {
  const research = (session && session.research) || null;
  const slots = slotsOf(session);
  const raw = (research && research.domain) || slots.company_domain || null;
  if (!raw) return null;
  const SAI = engine();
  if (SAI && typeof SAI.extractDomain === 'function') {
    const found = SAI.extractDomain(raw);
    if (found) return found;
  }
  return String(raw).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0] || null;
}

/* research.js already knows how to turn a domain into a display name (and
   how "my-shop.co.uk" is My Shop, not Co). Read its answer rather than
   writing a second one; the local fallback is for a page that somehow
   loaded this file without research.js. */
function nameFromDomain(domain) {
  const R = rsrch();
  if (R && typeof R._nameFromDomain === 'function') {
    try { const n = R._nameFromDomain(domain); if (n) return n; } catch (e) { /* fall through */ }
  }
  const label = String(domain || '').split('.')[0];
  if (!label) return null;
  return label.split(/[-_]/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || null;
}

function companyOf(session) {
  const research = (session && session.research) || null;
  const slots = slotsOf(session);
  const stated = typeof slots.company === 'string' && slots.company.trim() ? slots.company.trim() : null;
  return (research && research.name) || stated || nameFromDomain(domainOf(session)) || 'Your brand';
}

/* Domain first, name second. Two visitors who typed the same site get the
   same snapshot; a visitor who never gave a site still gets a stable one. */
function seedOf(session, company) {
  return domainOf(session) || String(company || '').toLowerCase() || 'stagwell';
}

function formatDate(d) {
  const date = d instanceof Date ? d : new Date();
  return MONTHS[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
}

/* "Built from your five answers" — the count is real even though the numbers
   under it are not, so a visitor who skipped two questions is not told they
   answered five. */
function answersAsked() {
  const F = flow();
  if (!F || typeof F.result !== 'function') return 5;
  try {
    const r = F.result();
    const n = r && Array.isArray(r.asked) ? r.asked.length : 0;
    return n > 0 ? n : 5;
  } catch (e) { return 5; }
}

const numberWord = n => (n >= 0 && n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : String(n));

/* ═══════════════════════════════════════════════════════════════════════════
   THE RIVALS — research decides who they are, this file only decides how
   they score. When the model recognised the company (`live`) those are real
   competitor names; otherwise they are research.js's invented morphemes.
   Either way the scores are fiction and the page says so.
   ═══════════════════════════════════════════════════════════════════════════ */
function rivalsOf(session) {
  const research = (session && session.research) || null;
  const fromResearch = research && Array.isArray(research.competitors)
    ? research.competitors.map(c => String(c || '').trim()).filter(Boolean) : [];
  if (fromResearch.length >= 2) return fromResearch.slice(0, 2);

  /* no research object on the session (a visitor who never named a site):
     borrow research.js's own generator rather than shipping a second one. */
  const R = rsrch();
  const domain = domainOf(session);
  if (R && typeof R._seeded === 'function' && domain) {
    try {
      const seeded = R._seeded(domain);
      const list = (seeded && Array.isArray(seeded.competitors) ? seeded.competitors : [])
        .map(c => String(c || '').trim()).filter(Boolean);
      if (list.length >= 2) return list.slice(0, 2);
    } catch (e) { /* fall through */ }
  }

  /* last resort: describe the set instead of inventing names for it. */
  return fromResearch.concat(['The category leader', 'Your nearest rival']).slice(0, 2);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODULE 1 · COMPETITIVE POSITION
   Three bars: you and two rivals, 30–75. The leader is always ahead of you
   and the third always behind — an honest gap, and a category with a floor
   as well as a ceiling, which is what makes the gap legible.
   ═══════════════════════════════════════════════════════════════════════════ */
const COMP_FINDINGS = [
  ({ company, leader, gap }) =>
    'Awareness is healthy — but ' + company + ' trails ' + leader + ' by ' + gap +
    ' points overall, and the gap is widest with the under-35s you spend the most to reach.',
  ({ company, leader, gap }) =>
    company + ' is known, not chosen: ' + leader + ' leads by ' + gap +
    ' points on the measures that turn awareness into consideration.',
  ({ company, leader, trail, gap, gap2 }) =>
    'On unaided recall ' + company + ' sits ' + gap + ' points behind ' + leader +
    ' and ' + gap2 + ' ahead of ' + trail + ' — the middle of the category is where this one is won.',
  ({ company, leader, gap }) =>
    'Consideration is the gap: ' + gap + ' points between ' + company + ' and ' + leader +
    ', and almost all of it sits with people who already know both names.'
];

function compModule(seed, company, rivals) {
  const draw = stream(seed, 'comp');

  const leaderScore = between(draw(), 58, 75);
  const youScore    = between(draw(), 38, leaderScore - 8);
  const trailScore  = between(draw(), 30, youScore - 3);

  const rows = [
    { name: company,   score: youScore,    you: true  },
    { name: rivals[0], score: leaderScore, you: false },
    { name: rivals[1], score: trailScore,  you: false }
  ];

  const finding = pick(COMP_FINDINGS, draw())({
    company,
    leader: rivals[0],
    trail: rivals[1],
    gap: leaderScore - youScore,
    gap2: youScore - trailScore
  });

  return { rows, finding };
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODULE 2 · AI-SEARCH VISIBILITY
   "n of 10 answers" per assistant — how often the brand is named when an
   assistant answers the category's buying question. The question itself is
   templated from whatever research believes the industry is; when research
   has no opinion it stays generic rather than guessing at a category.
   ═══════════════════════════════════════════════════════════════════════════ */
const ENGINES = ['ChatGPT', 'Gemini', 'Perplexity'];

const QUERIES = {
  'retail & ecommerce':      ['best online store for everyday essentials', 'most reliable online retailer for fast delivery'],
  'consumer products':       ['best everyday household brand', 'which brand is worth paying more for'],
  'financial services':      ['best account for a growing business', 'which provider is best for first-time investors'],
  'travel & hospitality':    ['best places to stay for a long weekend', 'which travel brand is best for families'],
  'media & entertainment':   ['best streaming service for original shows', 'where to watch the best new series'],
  'healthcare':              ['best provider for same-week appointments', 'which practice is best for ongoing care'],
  'technology':              ['best software for a small team', 'which platform is easiest to switch to'],
  'food & beverage':         ['best specialty coffee subscription', 'which brand is best for everyday cooking'],
  'automotive':              ['best family car for the money', 'which dealer group is best to buy from'],
  'telecom':                 ['best mobile plan for a small business', 'which network is most reliable'],
  'professional services':   ['best partner for a brand relaunch', 'who to hire for a first audit'],
  'fashion & apparel':       ['best sustainable clothing brand', 'where to buy well-made basics']
};

const GENERIC_QUERIES = [
  'best brands in the category right now',
  'who to buy from in this category',
  'which brand is worth paying more for'
];

function queryFor(industry, draw) {
  const key = String(industry || '').trim().toLowerCase();
  if (key && QUERIES[key]) return pick(QUERIES[key], draw);
  /* an industry the map has never seen (the model's own wording) still makes
     a plausible buying question; nothing is asserted about the company. */
  if (key) return 'best ' + key.replace(/\s*&\s*/g, ' and ') + ' brand right now';
  return pick(GENERIC_QUERIES, draw);
}

const AI_FINDINGS = [
  ({ company, leader, query }) =>
    'For \u201c' + query + ',\u201d assistants recommend ' + leader + '. ' + company +
    ' surfaces only on queries that already name it.',
  ({ company, leader, query, total }) =>
    'Asked \u201c' + query + ',\u201d the three assistants name ' + company + ' in ' + total +
    ' of 30 answers — ' + leader + ' takes most of the rest.',
  ({ company, leader, query }) =>
    'Coverage for \u201c' + query + '\u201d is thin and uneven across the three assistants: ' +
    leader + ' is named far more often than ' + company + '.',
  ({ company, leader, query }) =>
    'The reviews and roundups assistants lean on for \u201c' + query + '\u201d quote ' + leader +
    ' throughout and barely mention ' + company + '.'
];

function aiModule(seed, company, leader, industry) {
  const draw = stream(seed, 'ai');
  const query = queryFor(industry, draw());

  /* One assistant always knows the brand better than the other two. Three
     equal bars — and three empty ones especially — read as a broken widget
     rather than a finding, and "thin and uneven" has to be true of the
     numbers printed next to it. W4's own card is 2 / 4 / 1. */
  const best = between(draw(), 2, 6);
  const strongest = Math.floor(draw() * ENGINES.length) % ENGINES.length;
  const rows = ENGINES.map((name, i) => ({
    engine: name,
    n: i === strongest ? best : between(draw(), 0, best - 1),
    of: 10
  }));
  const total = rows.reduce((sum, r) => sum + r.n, 0);
  const finding = pick(AI_FINDINGS, draw())({ company, leader, query, total });
  return { query, rows, finding };
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODULE 3 · BRAND SIGNAL
   A score and 90 days of momentum. The templates split on the sign of the
   delta: a brand that lost four points does not get told what is "rising".
   ═══════════════════════════════════════════════════════════════════════════ */
const DRIVERS = ['Freshness', 'Trust', 'Craft', 'Value for money', 'Convenience',
  'Originality', 'Warmth', 'Reliability', 'Sustainability'];

const SIGNAL_UP = [
  ({ company, driver }) =>
    '\u201c' + driver + '\u201d is ' + company + '’s fastest-rising driver — the emotional lever your rivals aren’t holding.',
  ({ driver, delta }) =>
    'Momentum is with you: ' + delta + ' in ninety days, carried by \u201c' + driver + '\u201d rather than by price.',
  ({ company, score, driver }) =>
    company + ' scores ' + score + ' on brand signal, and “' + driver + '” is the one attribute moving faster than the category.',
  ({ driver, delta }) =>
    'The signal is climbing — ' + delta + ' over the window \u2014 and \u201c' + driver + '\u201d is doing the work.'
];

const SIGNAL_SOFT = [
  ({ company, driver }) =>
    '\u201c' + driver + '\u201d is the attribute holding ' + company + ' up while the rest of the signal softens.',
  ({ driver, delta }) =>
    'Momentum has turned: ' + delta + ' in ninety days, with \u201c' + driver + '\u201d the only driver still gaining.',
  ({ company, score, driver }) =>
    company + ' holds at ' + score + ' on brand signal, but “' + driver + '” is now carrying the score on its own.',
  ({ driver, delta }) =>
    'Ninety days at ' + delta + ' \u2014 the category moved and \u201c' + driver + '\u201d is the lever left to pull.'
];

function formatDelta(n) {
  const unit = Math.abs(n) === 1 ? 'pt' : 'pts';
  if (n > 0) return '+' + n + ' ' + unit;
  if (n < 0) return String(n) + ' ' + unit;      /* the minus sign is already there */
  return '0 ' + unit;
}

function signalModule(seed, company) {
  const draw = stream(seed, 'signal');
  const score = between(draw(), 40, 75);
  const deltaValue = between(draw(), -9, 9);
  const delta = formatDelta(deltaValue);
  const driver = pick(DRIVERS, draw());
  const set = deltaValue > 0 ? SIGNAL_UP : SIGNAL_SOFT;
  const finding = pick(set, draw())({ company, score, driver, delta });
  return { score, delta, deltaValue, driver, window: 'last 90 days', finding };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE BOTTOM BAND — W4's three tiles, ranked by the routing decision. The
   design note is the spec: the marigold slot goes to the journey the visitor
   matched. A callback is the graceful third option, never the headline —
   nobody's best next step is "we'll ring you".
   ═══════════════════════════════════════════════════════════════════════════ */
const TILES = {
  session: {
    id: 'session',
    title: 'Book a working session',
    line: 'Walk through your snapshot with the team behind these numbers.'
  },
  /* the demo is the ask a sales-led route exists to make, so it leads the
     band for those visitors rather than hiding behind a working session */
  demo: {
    id: 'demo',
    title: 'Book a demo',
    line: 'Thirty minutes with the team who runs the product, walked through against your brand.'
  },
  workspace: {
    id: 'workspace',
    title: 'Request your full AI workspace',
    line: 'Your snapshot, tracked and updated, in a workspace of your own.'
  },
  callback: {
    id: 'callback',
    title: 'Let Stagwell.AI call you',
    line: 'A five-minute call, at a time you pick.'
  }
};

/* consultative and demo are both sales-led → the working session leads.
   self_serve and follow_up both end in the product → the workspace leads. */
const PRIMARY_BY_ROUTE = {
  consultative: 'session',
  demo: 'demo',
  self_serve: 'workspace',
  follow_up: 'workspace'
};

function routeName(input) {
  if (typeof input === 'string' && input) return input;
  if (input && typeof input === 'object' && typeof input.route === 'string') return input.route;
  const SAI = engine();
  if (SAI && typeof SAI.route === 'function') {
    try { const d = SAI.route(); return (d && d.route) || null; } catch (e) { return null; }
  }
  return null;
}

function rankActions(input) {
  const name = routeName(input);
  /* an unrouted visitor still gets W4's default shape */
  const lead = PRIMARY_BY_ROUTE[name] || 'session';
  const second = lead === 'session' ? 'workspace' : 'session';
  return [lead, second, 'callback'].map((id, i) =>
    Object.assign({}, TILES[id], { primary: i === 0 }));
}

/* ═══════════════════════════════════════════════════════════════════════════
   BUILD
   ═══════════════════════════════════════════════════════════════════════════ */
function build(input) {
  const session = currentSession(input);
  const research = (session && session.research) || null;
  const company = companyOf(session);
  const seed = seedOf(session, company);
  const rivals = rivalsOf(session);

  const comp = compModule(seed, company, rivals);
  const ai = aiModule(seed, company, rivals[0], research && research.industry);
  const signal = signalModule(seed, company);

  return {
    company,
    builtLine: 'Built from your ' + numberWord(answersAsked()) + ' answers · ' + formatDate(new Date()),
    illustrative: true,
    modules: { comp, ai, signal },
    actions: rankActions()
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE PDF — filename and title only; the print view is the UI's problem.
   ═══════════════════════════════════════════════════════════════════════════ */
function slug(str) {
  return String(str == null ? '' : str)
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'your-brand';
}

function pdfMeta(input) {
  const company = companyOf(currentSession(input));
  return {
    filename: slug(company) + '-stagwell-snapshot.pdf',
    title: company + ' — your Stagwell.AI snapshot'
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CAPTURE — three events on a send, one on a decline, and the address itself
   never leaves the browser. The demo console renders every payload on screen
   in front of a room, so `capture_email` carries the domain and nothing more:
   "acme.com" is the qualifying fact anyway, and a work email on a projector
   is a mistake you only make once.
   ═══════════════════════════════════════════════════════════════════════════ */
function emailDomain(email) {
  const m = String(email == null ? '' : email).trim().toLowerCase().match(/^[^\s@]+@([a-z0-9.-]+\.[a-z]{2,})$/);
  return m ? m[1] : null;
}

/* The phone rides the same submit as the email — asked every time, never
   required. Like the address, the NUMBER never reaches the bus: capture_phone
   carries whether one was given and nothing more. */
function emailCaptured(email, consent, phone) {
  const domain = emailDomain(email);
  const granted = !!consent;
  const gavePhone = !!String(phone == null ? '' : phone).trim();
  emit('capture_email', { domain });
  emit('capture_phone', { given: gavePhone });
  emit('capture_consent', { consent: granted });
  emit('journey_converted', { kind: 'capture' });
  return { domain, consent: granted, phone: gavePhone };
}

/* SPEC: keep the snapshot, log it anonymously, no nagging. One event, no
   conversion, nothing else asked of the visitor. */
function declined() {
  emit('capture_declined');
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIEWED — once per session. The engine hands out a new session object on
   reset, and that is the signal to arm the event again; the same trick
   research.js uses to keep its cache honest.
   ═══════════════════════════════════════════════════════════════════════════ */
let boundSession = null;
let seen = false;

function syncSession() {
  const SAI = engine();
  const current = SAI ? SAI.session : null;
  if (current !== boundSession) {
    boundSession = current;
    seen = false;
  }
}

function viewed() {
  syncSession();
  if (seen) return false;
  seen = true;
  emit('snapshot_viewed', { company: companyOf(currentSession(null)) });
  return true;
}

window.SAISNAPDATA = {
  build,
  rankActions,
  pdfMeta,
  emailCaptured,
  declined,
  viewed,

  /* exposed for the tests and for anyone auditing the fiction */
  _slug: slug,
  _emailDomain: emailDomain,
  _company: companyOf,
  _seed: seedOf,
  _rivals: rivalsOf,
  _formatDelta: formatDelta,
  _queryFor: queryFor,
  _reset() { boundSession = null; seen = false; }
};
})();
