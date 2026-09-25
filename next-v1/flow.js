/* ═══════════════════════════════════════════════════════════════════════════
   THE FLOW — which question comes next, and why the others didn't.

   Pure logic, no DOM. It reads the questions, chips and skip rules out of
   data/questions.json, writes answers into the engine's slots, and tells
   whoever is listening that something changed. The UI subscribes with
   onChange() and renders state(); it never decides anything, and this file
   never draws anything. That split is the point: copy and logic change in the
   JSON, the conversation changes here, the chat window changes over there.

   window.SAIFLOW:
     .start({initialText, chipLabel})  → Promise<state>
     .state()                          → what to render right now
     .answer(text | chipValue)         → Promise<state>
     .onChange(cb)                     → unsubscribe fn; fires on every change
     .result()                         → { session, route, asked, skipped }
     .reset()                          → back to before start()
     .researchWaitMs                   → how long q4 waits for research (4s)

   A campaign entry (attribution matched a campaigns.json id other than
   master) opens on that campaign's own opener — id 'campaign-opener', slot
   domain_detail, copy and chips straight out of the JSON plus the
   cross-discovery chip. It is one question that does the work of two (q1 is
   already answered by the ad's prefill, its answer is q6's detail), so a
   product entry always reaches the snapshot in fewer questions than the
   master landing does. "What else fits my problem?" drops the campaign bias
   and hands the visitor back to the ordinary q1.

   The skip rules, in one place (SPEC F2 · questions.json):
     · a question whose slot the visitor has ALREADY filled in their own words
       is never asked again — that is q1 after a chip or an opening message,
       q2 after a pasted website (non-negotiable #1), q3 and q4 after "I'm the
       CMO of a 3,000-person retailer";
     · q1 is also skipped when a product ad pre-filled it (campaigns.json
       prefill.problem_domains) — the creative already asked it;
     · q4 becomes a one-tap confirm instead of a question when research came
       back confident, and waits ~4s for research before giving up on that;
     · q6 is skipped when the match is already obvious — see q6SkipReason().

   Research is never awaited by anything except q4, and even then only
   briefly. A slow model must cost the demo a nicer question, never a stall.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const ORDER = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'];
const MAX_DOMAINS = 3;

/* ── the campaign opener (SPEC S2) ──
   A product landing's agent panel is pre-seeded from campaigns.json: the
   opener sentence, the product's chips, and the cross-discovery chip. The
   opener is not a seventh question — campaigns.json calls it "fuses Q1 +
   adaptive Q6 — one less question": q1 is already answered by the ad's
   prefill, and the opener's answer IS the q6 detail, so both are skipped
   behind it. It carries a stable id of its own so the event console can
   tell the exchange apart from the six standard ones. */
const OPENER_ID = 'campaign-opener';
const CROSS_VALUE = '__cross__';
const CROSS_LABEL = 'What else fits my problem?';

const eng = () => (typeof window !== 'undefined' && window.SAI) || null;
const res = () => (typeof window !== 'undefined' && window.SAIRESEARCH) || null;

const wait = ms => new Promise(r => { if (ms > 0) setTimeout(r, ms); else r(); });

const norm = s => String(s == null ? '' : s)
  .toLowerCase().replace(/[‘’]/g, "'").replace(/[–—]/g, '-')
  .replace(/[?.!]+$/, '').replace(/\s+/g, ' ').trim();

const isEmpty = v => v == null || v === '' || (Array.isArray(v) && !v.length);

/* ── the contract, read through accessors so a half-loaded JSON degrades ── */
const data = () => (eng() && eng().data) || {};
const allQuestions = () => ((data().questions || {}).questions) || [];
const qById = id => allQuestions().find(q => q && q.id === id) || null;
const slots = () => eng().session.slots;
const sources = () => eng().session.slotSources || {};

function campaign() {
  const S = eng();
  const id = S && S.session.attribution && S.session.attribution.utm_campaign;
  return id ? S.campaign(id) : null;
}

/* The campaign whose opener this session should open on: a real product
   campaign (master is the plain landing, which opens on q1) that actually
   declares an opener. */
function openerCampaign() {
  const c = campaign();
  if (!c || c.id === 'master' || !c.opener) return null;
  return c;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATE — everything the flow itself knows. The answers live in the engine's
   session; this is only the pointer and the ledger of what was asked.
   ═══════════════════════════════════════════════════════════════════════════ */
function blank() {
  return {
    started: false,
    seq: ORDER.slice(),  /* the questions this session will walk, in order —
                            a campaign entry puts its opener in front of q1 */
    idx: -1,             /* how far through seq we are */
    current: null,       /* the question on screen, or null */
    phase: 'asking',     /* 'asking' | 'waiting-research' | 'done' */
    log: [],             /* [{ id, status:'asked'|'skipped', reason }] */
    reask: null,         /* a question to put again rather than advance past */
    route: null
  };
}
let st = blank();
let listeners = [];

/* ═══════════════════════════════════════════════════════════════════════════
   SKIP RULES
   ═══════════════════════════════════════════════════════════════════════════ */
const SLOT_OF = { q1: 'problem_domains', q2: 'company', q3: 'role_seniority',
  q4: 'size_tier', q5: 'timing_intent', q6: 'domain_detail',
  [OPENER_ID]: 'domain_detail' };

const slotOf = id => (qById(id) && qById(id).slot) || SLOT_OF[id] || null;

/* the opener was put to the visitor and they answered it with something
   other than the cross-discovery chip — so q6's slot is already full */
function openerAnswered() {
  return st.log.some(e => e.id === OPENER_ID && e.status === 'asked') &&
    !isEmpty(slots().domain_detail);
}

/* Why we would not ask this question, or null if we would.
   The general rule is "never ask what the visitor has already told us" —
   questions.json's own model line: ask only what can't be inferred. The
   reason string is what the event console shows, so it names the source of
   the answer rather than just saying "skipped". */
function skipReason(id) {
  const S = eng();
  const s = slots();

  /* the opener is the campaign entry's first move; it is never skipped
     while it still has an answer to collect */
  if (id === OPENER_ID) return isEmpty(s.domain_detail) ? null : 'answered_earlier';

  /* q6 owns domain_detail, and the campaign opener has just filled it —
     campaigns.json's "one less question", made good. */
  if (id === 'q6') {
    if (!isEmpty(s.domain_detail)) {
      return openerAnswered() ? 'answered_in_campaign_opener' : 'answered_earlier';
    }
    return q6SkipReason();
  }

  /* A website the VISITOR typed needs no confirming — it is already their
     word. A domain we INFERRED from their business email does: questions.json's
     own model line is "confirm inferences, never assume", and the client's:
     "we want to confirm that this is actually their website. And then we'll
     search and find stuff about it." So that case is not a skip — q2 is asked,
     in confirm mode (see questionView), and research waits for the answer. */
  if (id === 'q2' && !isEmpty(s.company_domain) && sources().company_domain !== 'work_email') {
    return 'website_in_first_message';
  }

  const slot = slotOf(id);
  if (!slot) return null;
  if (isEmpty(s[slot])) return null;

  /* research fills session.research, never a slot, so anything filled here
     came from the visitor or from the ad that brought them. */
  const src = sources()[slot];
  if (id === 'q1') return src === 'campaign' ? 'product_ad_prefill' : 'answered_in_first_message';
  if (id === 'q2') return 'company_known';
  return 'answered_earlier';
}

/* ── Q6, the adaptive one ──
   Q6 exists to break a tie. questions.json skips it when "the solution match
   is already obvious from prior answers"; concretely that is three cases:

     1. there is no primary domain, or questions.json has no byDomain copy for
        it — there is no question to ask;
     2. an override already owns the decision (routing.json overrides_in_order:
        two or more domains, c-suite at mid-market or enterprise, or a visitor
        who asked for a human — "just exploring" was retired Sep 2 with the
        follow_up route). The matrix is not
        being consulted at all, so no detail answer can move the route;
     3. the primary domain's three tier cells all route to the same place. Q6
        decides between cells; if every cell says the same word, the answer is
        already known whatever the visitor says.

   Anything else and the answer genuinely changes where they land, so we ask. */
function q6SkipReason() {
  const S = eng();
  const s = slots();
  const domains = Array.isArray(s.problem_domains) ? s.problem_domains : [];
  const primary = domains[0] || null;

  if (!primary || !q6Copy(primary)) return 'no_adaptive_question';

  if (domains.length >= 2) return 'override_multi_domain';
  const tier = S.resolveTier();
  if (s.role_seniority === 'c_suite' && (tier === 'mid_market' || tier === 'enterprise')) {
    return 'override_c_suite';
  }
  if (S.session.humanAsk === true) return 'override_human_ask';

  const d = S.domain(primary);
  const cells = (d && d.cells) || {};
  const routes = S.TIERS.map(t => (cells[t] || {}).route).filter(Boolean);
  if (routes.length === S.TIERS.length && routes.every(r => r === routes[0])) {
    return 'single_route_domain';
  }
  return null;
}

/* A product campaign may override the adaptive copy (campaigns.json
   q6Override) — but only while the domain it was written for is still the
   primary one, or the ad's question would be answering a different problem
   than the one the visitor described. */
function q6Copy(primary) {
  const c = campaign();
  const seeded = (c && c.prefill && c.prefill.problem_domains) || [];
  if (c && c.q6Override && primary && seeded.indexOf(primary) !== -1) return c.q6Override;
  const q6 = qById('q6');
  const map = (q6 && q6.byDomain) || {};
  return (primary && map[primary] && map[primary].copy) || null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   READING FREE TEXT — every free-text answer, on every question, may fill
   more than one slot. "I'm the CMO of a 3,000-person retailer" is a role AND
   a size; a pasted website anywhere is a company AND the start of research.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Short chip-shaped answers ("Founder / owner", "This quarter") are read
   locally; the model is worth a round trip only for something sentence-shaped
   or something carrying a URL. */
function worthClassifying(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  return t.split(/\s+/).length >= 5 || /[.@]/.test(t);
}

function cheapRead(text) {
  const S = eng();
  const human = S.detectHumanAsk(text);
  if (human && S.session.humanAsk !== true) {
    S.session.humanAsk = true;
    S.events.emit('human_requested', { text: String(text) });
  }
  return {
    domains: S.classifyKeywords(text),
    company: S.extractDomain(text),
    employees: S.employeesFromClaim(text),
    human,
    live: false
  };
}

const read = text => worthClassifying(text)
  ? eng().classifyFull(text)
  : Promise.resolve(cheapRead(text));

function mergeDomains(list, replace) {
  const S = eng();
  const incoming = (Array.isArray(list) ? list : []).filter(Boolean);
  if (!incoming.length) return;
  const have = Array.isArray(slots().problem_domains) ? slots().problem_domains : [];
  const next = (replace ? incoming : have.concat(incoming))
    .filter((id, i, a) => a.indexOf(id) === i)
    .slice(0, MAX_DOMAINS);
  if (next.join('|') !== have.join('|')) S.setSlot('problem_domains', next, 'visitor');
}

/* A website is the company answer and the research trigger in one move
   (SPEC non-negotiable #1). */
function fillCompany(domain) {
  const S = eng();
  if (!domain) return;
  /* the visitor typed the very domain we had inferred from their email —
     that IS the confirmation, so the slot's source is upgraded to their own
     word and q2 has nothing left to ask */
  if (slots().company_domain === domain) {
    if (sources().company_domain !== 'visitor') S.setSlot('company_domain', domain, 'visitor');
    startResearch(domain);
    return;
  }
  S.setSlot('company_domain', domain, 'visitor');
  if (isEmpty(slots().company)) {
    const R = res();
    S.setSlot('company', (R && R._nameFromDomain(domain)) || domain, 'inferred');
  }
  startResearch(domain);
}

function startResearch(domain) {
  const R = res();
  if (!R || !domain) return null;
  const p = R.run(domain);
  if (p && typeof p.then === 'function') p.then(onResearchDone, () => {});
  return p;
}

/* Research is allowed to improve the name we guessed off the domain, and —
   when the visitor typed a name and the model knew the website — to fill a
   domain we never had. It never overwrites something the visitor typed:
   "visitor corrections always win" runs in this direction too. */
function onResearchDone(r) {
  if (!r) return;
  const S = eng();
  const src = sources().company;
  if (r.name && (isEmpty(slots().company) || src === 'inferred')) {
    S.setSlot('company', r.name, 'research');
  }
  if (r.live && r.domain && isEmpty(slots().company_domain)) {
    S.setSlot('company_domain', r.domain, 'research');
  }
  notify();
}

/* Side-effects of one free-text answer, other than the slot the question
   itself owns. Domains only move here when the question was q1 (they are its
   answer) or when we had none at all — otherwise a stray "CFO" in a role
   answer would add a second domain and silently reroute the visitor. */
function applySide(full, opts) {
  const S = eng();
  const o = opts || {};
  const s = slots();

  if (o.domains) mergeDomains(full.domains, true);
  else if (isEmpty(s.problem_domains)) mergeDomains(full.domains, true);

  if (full.company) fillCompany(full.company);

  if (full.employees != null && !o.ownsSize && isEmpty(s.size_tier)) {
    S.setSlot('size_tier', full.employees, 'visitor');
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   FREE-TEXT MAPPERS for the closed-set questions. A visitor typing "I run
   marketing" instead of tapping a chip still lands on a chip value, because
   the routing overrides test chip values (role == 'c_suite'), not prose.
   Unmatched text is stored verbatim: the why-line quotes it back.
   ═══════════════════════════════════════════════════════════════════════════ */
const ROLE_PATTERNS = [
  ['c_suite', /(c-?suite|\bcmo\b|\bceo\b|\bcoo\b|\bcfo\b|\bcto\b|\bcdo\b|\bcco\b|chief|president)/],
  ['founder', /(founder|co-?founder|owner|proprietor|i started|my own (company|business|agency))/],
  ['director_vp', /(director|\bvp\b|v\.p\.|vice president|\bsvp\b|\bevp\b|head of)/],
  ['manager', /(manager|marketing lead|team lead|specialist|coordinator|analyst|associate)/]
];

/* Exploring language ("just looking", "no timeline") used to be its own value
   with its own route. Since Sep 2 there is no nurture route to send it to, so
   it reads as the loosest timing that still has a destination: this_year.
   The pattern stays first so "not sure yet" is not swallowed by the year
   pattern's looser matches. */
const TIMING_PATTERNS = [
  ['this_year', /(just (looking|exploring|browsing|curious)|exploring|no timeline|not sure yet|kicking the tires|early days|window shopping|someday)/],
  ['now', /(this quarter|\bq[1-4]\b|asap|right now|immediately|next month|urgent|yesterday|straight away|as soon as)/],
  ['this_year', /(this year|next year|year ?end|\bh[12]\b|next (6|six) months|second half|first half)/]
];

const matchPattern = (pairs, text) => {
  const t = norm(text);
  for (let i = 0; i < pairs.length; i++) if (pairs[i][1].test(t)) return pairs[i][0];
  return null;
};

/* ═══════════════════════════════════════════════════════════════════════════
   THE QUESTION AS THE UI SEES IT
   ═══════════════════════════════════════════════════════════════════════════ */
const fmt = n => typeof n === 'number' && isFinite(n)
  ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : String(n == null ? '' : n);

function tpl(copy, vars) {
  return String(copy || '').replace(/\{(\w+)\}/g, (m, k) =>
    vars[k] == null || vars[k] === '' ? m : String(vars[k]));
}

function companyName() {
  const S = eng();
  const r = S.session.research;
  const typed = slots().company;
  /* same company, better casing: "nike" typed, "Nike" recognised. The slot
     keeps the visitor's words; only the display upgrades. */
  if (typed && r && r.live && r.name &&
      String(r.name).toLowerCase() === String(typed).toLowerCase()) return r.name;
  return typed || (r && r.name) || slots().company_domain || 'your company';
}

/* The visitor's stated goal as a phrase — the routing.json domain label with
   its parenthetical trimmed and the first letter lowered, two domains joined
   with 'and'. Feeds q5's copyWithGoal template so the timing question can
   acknowledge what it is asking the timing OF. */
function goalPhrase() {
  const ids = slots().problem_domains || [];
  const D = (eng().data.routing || {}).domains || [];
  const phrases = ids.slice(0, 2).map(id => {
    const d = D.find(x => x.id === id);
    if (!d || !d.label) return null;
    /* the parenthetical goes, and so does anything after a dash or colon:
       reputation's label is "Protect reputation — see risks before they become
       stories", and q5's own copy is built around an em dash, so the whole
       sentence came out with three of them and no readable clause. The goal is
       the head of the label — "protect reputation" — not its gloss. */
    const t = d.label
      .replace(/\s*\(.*?\)\s*/g, ' ')
      .split(/\s+[—–:-]\s+/)[0]
      .replace(/\s+/g, ' ').trim();
    return t ? t.charAt(0).toLowerCase() + t.slice(1) : null;
  }).filter(Boolean);
  if (!phrases.length) return null;
  if (phrases.length === 1) return phrases[0];
  /* two goals joined with "and" read as a run-on when a label carries its own
     "and" ("reach better audiences and track brand health and campaign
     impact"). Joining two, each phrase is trimmed to its own head so the
     sentence has exactly one conjunction. */
  return phrases.map(t => t.split(/\s+and\s+/)[0]).join(' and ');
}

/* q2 has two faces as well. Confirm: the landing chooser inferred a domain
   from the business email and nobody has agreed to it yet. Ask: everything
   else — no domain at all, or one the visitor rejected. */
function q2Mode() {
  const s = slots();
  return (!isEmpty(s.company_domain) && sources().company_domain === 'work_email')
    ? 'confirm' : 'ask';
}

/* Confirm mode is the moment the demo is built around: research came back
   confident enough that the size question becomes one tap. */
function q4Mode() {
  const r = eng().session.research;
  return r && r.confidence === 'high' ? 'confirm' : 'ask';
}

/* Q6 arrives from the JSON as one sentence with its options inside it. When
   that sentence is of the form "stem — a, b, or c?" we lift the options out
   as chips; when it isn't ("Roughly how many creators…?") it stays free text
   rather than being mangled into three bad buttons. */
function chipsFromCopy(copy) {
  const s = String(copy || '');
  const i = s.indexOf('—');
  if (i === -1) return [];
  const tail = s.slice(i + 1).replace(/[?.!]\s*$/, '').trim();
  const parts = tail.split(/,\s*or\s+|\s+or\s+|,\s*/).map(p => p.trim()).filter(Boolean);
  if (parts.length < 2 || parts.length > 5) return [];
  return parts.map(p => ({ label: p.charAt(0).toUpperCase() + p.slice(1), value: p }));
}

/* An explicit chips array on a byDomain entry, normalised to the {label,value}
   shape the UI renders. Null (not []) when there isn't one, so the caller can
   tell "no explicit chips, derive them" from "explicitly no chips". */
function chipList(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const out = arr.filter(c => c && c.label != null && String(c.label).trim())
    .map(c => ({ label: String(c.label), value: c.value == null ? String(c.label) : c.value }));
  return out.length ? out : null;
}

/* "Adidas, Puma and Under Armour" — a list a sentence can swallow whole. */
function joinNames(list) {
  const n = list.slice(0, 3);
  if (n.length < 2) return n[0] || '';
  return n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
}

/* ── THE PEERS RULE, and why it is this strict ──
   research.js always hands back three competitor names. When the model
   recognised the company those are real brands; when it did not, they are
   invented morphemes ("Vellora Group") that exist so the demo has something
   to draw a bar chart with. The snapshot is allowed to use either, because it
   stamps every module "Illustrative". A QUESTION cannot do that: reading
   invented names back as "your closest comparison set — is that who you're
   measuring against?" is the machine asserting a fact about the visitor's
   market that it made up, to their face, and inviting them to agree with it.

   So the peers form is gated on proof that the names came from outside, and
   the gate is deliberately three-deep:

     1. research.live — the model recognised the company at all;
     2. the 'peers' narration step reports live — research.js flags that step
        live ONLY when the model supplied the names, so it is the one signal
        that separates a real set from the seeded fallback (a company the
        model knows but has no competitors for is live:true with SEEDED
        names, and step 2 is exactly what catches that case);
     3. at least two names to read out — one name is not a "set".

   A session assembled by hand (a test, the console) may have no steps array;
   there, rule 2 falls back to asking research.js for the fiction it would
   have invented for this domain and refusing to present it as real.
   Anything short of all three and the generic form is asked instead. */
function realPeers() {
  const S = eng();
  const r = S.session.research;
  if (!r || r.live !== true) return [];

  const names = (Array.isArray(r.competitors) ? r.competitors : [])
    .map(n => String(n == null ? '' : n).trim()).filter(Boolean);
  if (names.length < 2) return [];

  const steps = Array.isArray(r.steps) ? r.steps : null;
  if (steps && steps.length) {
    const peers = steps.find(s => s && s.step === 'peers');
    return peers && peers.live === true ? names : [];
  }

  /* no narration to check — compare against the fiction itself */
  const R = res();
  if (R && typeof R._seeded === 'function' && r.domain) {
    try {
      const fiction = (R._seeded(r.domain) || {}).competitors || [];
      if (names.every(n => fiction.indexOf(n) !== -1)) return [];
    } catch (e) { /* couldn't check — fall through to the honest default */ }
  }
  return names;
}

/* Q6 as the UI should render it: which face of the question, its copy, and
   its chips. Precedence, highest first:

     1. a product campaign's own q6Override (it replaces the question);
     2. the byDomain entry's PEERS form, when realPeers() allows it;
     3. the byDomain entry's generic form.

   Chips in every case: the entry's explicit `chips`/`chipsWithPeers` array
   wins, and chipsFromCopy() stays as the fallback for the entries that carry
   no array — it only ever worked on copy shaped "stem — a, b, or c?", and
   an explicit array is the way an entry escapes that shape. */
function q6View(primary) {
  const c = campaign();
  const seeded = (c && c.prefill && c.prefill.problem_domains) || [];
  if (c && c.q6Override && primary && seeded.indexOf(primary) !== -1) {
    return { form: 'campaign', copy: c.q6Override, chips: chipsFromCopy(c.q6Override), peers: [] };
  }

  const q6 = qById('q6');
  const entry = (primary && ((q6 && q6.byDomain) || {})[primary]) || null;
  if (!entry) return { form: 'none', copy: '', chips: [], peers: [] };

  if (entry.copyWithPeers) {
    const peers = realPeers();
    if (peers.length >= 2) {
      const copy = tpl(entry.copyWithPeers, { competitors: joinNames(peers) });
      return {
        form: 'peers',
        copy,
        chips: chipList(entry.chipsWithPeers) || chipsFromCopy(copy),
        peers: peers.slice(0, 3)
      };
    }
  }

  const copy = entry.copy || '';
  return { form: 'generic', copy, chips: chipList(entry.chips) || chipsFromCopy(copy), peers: [] };
}

/* ── the opener as the UI sees it ──
   campaigns.json chips are bare strings, so the value is the label. Two
   rules on top of that:

     · the cross-discovery chip is always on the panel (SPEC S2 names it as
       part of the pattern). Campaigns that already list it keep their own
       position for it; the rest get it appended.
     · a chip whose label is a bracketed placeholder — "[CHIP SET — from
       NewVoices positioning]" — is passed through flagged, not hidden. The
       kit mandates visible placeholders for copy nobody has written yet;
       the UI renders it disabled, and answering it is a no-op here. */
const isCrossLabel = label => norm(label) === norm(CROSS_LABEL);
const isPlaceholder = label => String(label == null ? '' : label).trim().charAt(0) === '[';

function openerChips(c) {
  const chips = ((c && c.chips) || []).map(raw => {
    const label = String(raw);
    if (isCrossLabel(label)) return { label, value: CROSS_VALUE };
    const chip = { label, value: label };
    if (isPlaceholder(label)) chip.placeholder = true;
    return chip;
  });
  if (!chips.some(ch => ch.value === CROSS_VALUE)) {
    chips.push({ label: CROSS_LABEL, value: CROSS_VALUE });
  }
  return chips;
}

function openerView(c) {
  return {
    id: OPENER_ID,
    slot: 'domain_detail',
    copy: c.opener || '',
    chips: openerChips(c),
    mode: null,
    campaign: c.id,
    allowFreeText: true
  };
}

function questionView() {
  const id = st.current;
  if (!id) return null;
  if (id === OPENER_ID) {
    const c = openerCampaign();
    return c ? openerView(c) : null;
  }
  const q = qById(id);
  if (!q) return null;

  let copy = q.copy || '';
  let chips = [];
  let mode = null;

  if (id === 'q1') {
    chips = (q.chips || []).map(c => ({ label: c.label, value: c.domain }));
    /* THE CAMPAIGN CONTINUATION. A visitor who answered the ad's opener on
       the product landing has already told us something; if the classifier
       could not place it in a routing domain we still have to ask, but
       asking "What do you need help solving today?" reads as though we threw
       their answer away and started over (client, Sep 1: "i shouldn't start
       at the beginning"). So when the opener was answered, q1 quotes it back
       and asks only for the narrowing — same question, continuing tone. */
    if (q.copyAfterOpener && openerAnswered()) {
      const said = String(slots().domain_detail || '').trim();
      if (said) copy = tpl(q.copyAfterOpener, { said });
    }
    /* the view is recomputed on every state() call, so the flag is read here
       and cleared only when q1 is answered (applyAnswer) */
    if (st.unclassified && q.copyUnclassified) copy = q.copyUnclassified;
  } else if (id === 'q3' || id === 'q5') {
    chips = (q.chips || []).map(c => ({ label: c.label, value: c.value }));
    /* the timing question earns its context: reiterate what the visitor said
       they want before asking when they want it (client feedback, Aug 31) —
       template lives in questions.json, the goal comes from their domains */
    if (id === 'q5' && q.copyWithGoal) {
      const goal = goalPhrase();
      if (goal) copy = tpl(q.copyWithGoal, { goal });
    }
  } else if (id === 'q2' && q2Mode() === 'confirm') {
    /* the inferred site, put to the visitor before anything is read */
    mode = 'confirm';
    const cm = q.confirmMode || {};
    copy = tpl(cm.copy, { domain: slots().company_domain });
    chips = (cm.chips || []).map(c => ({ label: c.label, value: c.value }));
  } else if (id === 'q4') {
    mode = q4Mode();
    const r = eng().session.research || {};
    if (mode === 'confirm') {
      /* the industry only enters the sentence when the MODEL said it — a
         seeded industry in a claim about a real company is exactly the
         invented fact the house rules forbid */
      const cm = q.confirmMode || {};
      const withIndustry = !!(r.industryLive && r.industry);
      copy = tpl((withIndustry ? cm.copy : cm.copyNoIndustry) || cm.copy, {
        company: companyName(), employees: fmt(r.employees), industry: r.industry
      });
      chips = (cm.chips || []).map(c => ({ label: c.label, value: c.value }));
    } else {
      copy = (q.askMode || {}).copy || '';
      chips = ((q.askMode || {}).chips || []).map(c => ({ label: c.label, value: c.tier }));
    }
  } else if (id === 'q6') {
    const domains = slots().problem_domains || [];
    const view = q6View(domains[0] || null);
    copy = view.copy;
    chips = view.chips;
    mode = view.form;      /* 'peers' | 'generic' | 'campaign' — the console and
                              the suite read which face the visitor actually got,
                              the same way they read q4's confirm/ask */
  }

  return {
    id,
    slot: slotOf(id),
    copy,
    chips,
    mode,
    allowFreeText: true      /* SPEC: free text is always allowed, on every question */
  };
}

/* ── progress ──
   Total is computed dynamically: the questions already put to the visitor
   plus the ones still ahead that don't currently look skippable. It is a
   forecast and it is allowed to move — a second problem named mid-flow retires
   q6 on the spot, and the bar should say so. */
function progress() {
  const askedCount = st.log.filter(e => e.status === 'asked').length;
  let ahead = 0;
  for (let i = st.idx + 1; i < st.seq.length; i++) if (!skipReason(st.seq[i])) ahead++;

  const total = Math.max(1, askedCount + ahead);
  const done = st.phase === 'done';
  /* answered, not reached: the bar is empty on the first question and only
     fills when the last answer lands. A bar that reads 100% while a question
     is still on screen is a bar nobody believes. */
  const progressPct = done ? 100
    : Math.min(100, Math.round(100 * Math.max(0, askedCount - 1) / total));
  const progressLabel = done ? 'Building your snapshot…'
    : ahead >= 2 ? 'A couple more questions'
    : ahead === 1 ? 'One more question'
    : 'Last question';

  return { progressLabel, progressPct, questionsAhead: ahead, questionsTotal: total };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE SEQUENCE
   ═══════════════════════════════════════════════════════════════════════════ */
function skip(id, reason) {
  st.log.push({ id, status: 'skipped', reason });
  eng().events.emit('question_skipped', { id, slot: slotOf(id), reason });
}

function present(id) {
  st.current = id;
  st.phase = 'asking';
  st.log.push({ id, status: 'asked', reason: null });
  const v = questionView();
  eng().events.emit('question_asked', {
    id, slot: slotOf(id), copy: v ? v.copy : null, mode: v ? v.mode : null
  });
}

/* q4 is the one question worth waiting for: confirm mode is a better moment
   than ask mode, and research is usually seconds away. Wait at most
   researchWaitMs, then ask the plain question — the visitor never sees a
   spinner that outlasts their patience. */
async function settleResearch() {
  const R = res();
  if (!R) return;
  /* the run may be keyed by the domain OR by a typed company name — whichever
     the visitor gave us. The no-argument pending() is the catch-all: any run
     still in flight is the one q4 is waiting on. */
  const key = slots().company_domain || slots().company;
  if (!key || R.done(key)) return;
  const p = R.pending(key) || R.pending();
  if (!p) return;

  st.current = null;
  st.phase = 'waiting-research';
  notify();
  await Promise.race([p.then(() => null, () => null), wait(api.researchWaitMs)]);
}

async function advance() {
  while (st.idx < st.seq.length - 1) {
    st.idx++;
    const id = st.seq[st.idx];

    const reason = skipReason(id);
    if (reason) { skip(id, reason); continue; }

    if (id === 'q4') {
      await settleResearch();
      /* research can answer nothing that skips q4 — it fills no slot — but it
         does decide which of the two q4s the visitor sees. */
    }

    present(id);
    return;
  }
  finish();
}

function finish() {
  st.current = null;
  st.phase = 'done';
  st.route = eng().route();      /* emits route_decided; the engine de-dupes */
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANSWERS
   ═══════════════════════════════════════════════════════════════════════════ */
function matchChip(chips, input) {
  const raw = String(input == null ? '' : input);
  const t = norm(raw);
  if (!t) return null;
  return (chips || []).find(c =>
    String(c.value) === raw || norm(c.value) === t || norm(c.label) === t) || null;
}

/* "What else fits my problem?" — the visitor is telling us the ad brought
   them to the wrong door. The campaign stops steering: the pre-filled
   domains go (so q1 gets asked for real), the product interest survives as
   attribution only — it is still true that this ad paid for the click — and
   domain_detail stays empty so the adaptive q6 can still do its job once we
   know what the problem actually is. */
function clearCampaignBias() {
  const S = eng();
  if (!isEmpty(slots().problem_domains)) S.setSlot('problem_domains', [], 'visitor');
  if (!isEmpty(slots().product_interest)) S.setSlot('product_interest', null, 'visitor');
}

async function applyAnswer(id, chip, text) {
  const S = eng();
  const value = chip ? chip.value : String(text || '').trim();

  if (id === OPENER_ID) {
    if (chip && chip.value === CROSS_VALUE) { clearCampaignBias(); return; }
    S.setSlot('domain_detail', value, 'visitor');
    /* free text here reads exactly as it does anywhere else: a website
       answers q2 and starts research, a headcount answers q4, and a domain
       joins only if the ad left us without one. */
    if (!chip) applySide(await read(text), {});
    return;
  }

  if (id === 'q1') {
    st.unclassified = false;
    if (chip) S.setSlot('problem_domains', [chip.value], 'visitor');
    else {
      applySide(await read(text), { domains: true });
      /* nothing classified: the question comes back, but in words that own
         the miss — the identical sentence read as a loop (QA, Sep 2) */
      if (isEmpty(slots().problem_domains) && !st.reaskedQ1) {
        st.reask = 'q1'; st.unclassified = true; st.reaskedQ1 = true;   /* once — never a loop */
      }
    }
    return;
  }

  if (id === 'q2') {
    /* the confirm's two chips, before anything is parsed as a company name */
    if (chip && chip.value === 'confirm') {
      const domain = slots().company_domain;
      /* their word now, not our inference — and the read starts here, which
         is the beat the client asked for: confirm, THEN search */
      S.setSlot('company_domain', domain, 'visitor');
      if (isEmpty(slots().company)) {
        const R = res();
        S.setSlot('company', (R && R._nameFromDomain(domain)) || domain, 'inferred');
      }
      startResearch(domain);
      return;
    }
    if (chip && chip.value === 'different') {
      /* drop the inference and ask plainly; nothing was read, so nothing is
         stale — the next answer starts the research instead */
      S.setSlot('company_domain', null, 'visitor');
      S.setSlot('company', null, 'visitor');
      st.reask = 'q2';
      return;
    }
    const domain = S.extractDomain(text);
    if (domain) fillCompany(domain);
    else {
      S.setSlot('company', value, 'visitor');
      /* a bare name researches too — "it seems silly to ask a company like
         Nike how big they are". research.js decides whether the text is
         name-shaped; the model decides whether it recognises it. */
      startResearch(value);
    }
    if (worthClassifying(text)) applySide(await read(text), {});
    return;
  }

  if (id === 'q3') {
    S.setSlot('role_seniority', chip ? chip.value : (matchPattern(ROLE_PATTERNS, text) || value), 'visitor');
    if (!chip) applySide(await read(text), {});
    return;
  }

  if (id === 'q4') {
    /* confirm / smaller / bigger and the four size chips all land in the same
       slot — resolveTier() in the engine knows how to read every shape. */
    S.setSlot('size_tier', chip ? chip.value : (S.tierFromText(text) || value), 'visitor');
    if (!chip) applySide(await read(text), { ownsSize: true });
    return;
  }

  if (id === 'q5') {
    S.setSlot('timing_intent', chip ? chip.value : (matchPattern(TIMING_PATTERNS, text) || value), 'visitor');
    if (!chip) applySide(await read(text), {});
    return;
  }

  if (id === 'q6') {
    S.setSlot('domain_detail', value, 'visitor');
    if (!chip) applySide(await read(text), {});
  }
}

async function answer(input) {
  if (!st.started || st.phase === 'done') return state();
  const id = st.current;
  if (!id) return state();          /* mid-wait: the UI has nothing to answer */

  const view = questionView();
  const chip = matchChip(view ? view.chips : [], input);
  const text = String(input == null ? '' : input);
  if (!chip && !text.trim()) return state();

  /* a placeholder chip is unwritten copy standing in for a real option; it
     is rendered disabled and it answers nothing */
  if (chip && chip.placeholder) return state();

  const payload = { id, slot: slotOf(id), text, chip: chip ? chip.value : null };
  /* the cross-discovery tap is an answer like any other — same event, no new
     type — but it says something the raw chip value doesn't */
  if (chip && chip.value === CROSS_VALUE) payload.value = 'cross_discovery';
  eng().events.emit('answer_given', payload);

  await applyAnswer(id, chip, text);

  /* "No — different site" leaves the slot empty on purpose: the same question
     comes back, in its plain ask form, instead of the flow moving on with a
     company nobody has named. */
  if (st.reask === id) {
    st.reask = null;
    present(id);
    notify();
    return state();
  }

  st.current = null;
  await advance();
  notify();
  return state();
}

/* ═══════════════════════════════════════════════════════════════════════════
   OPENING — the landing page hands over whatever the visitor gave it: a
   tapped chip, a typed message, or both (the chips pre-fill the box, so
   "Reach better audiences — we're acme.com" is one message).
   ═══════════════════════════════════════════════════════════════════════════ */

/* Chips map cleanly: a q1 chip declares its domain, and the routing labels
   are chip labels on the master landing. Match those before spending a round
   trip on the model. */
function domainFromLabel(label) {
  const S = eng();
  const t = norm(label);
  if (!t) return null;

  const q1 = qById('q1') || {};
  const chips = (q1.chips || []).concat(q1.moreChips || []);
  const chip = chips.find(c => norm(c.label) === t);
  if (chip && chip.domain) return chip.domain;

  const list = ((S.data.routing || {}).domains) || [];
  const hit = list.find(d => norm(String(d.label).split(/\s*\(/)[0]) === t);
  if (hit) return hit.id;

  const kw = S.classifyKeywords(label);
  return kw.length === 1 ? kw[0] : null;
}

async function start(opts) {
  const o = opts || {};
  const S = eng();
  await S.ready;

  st = blank();
  st.started = true;

  /* A domain the visitor typed is a research trigger straight away. One we
     read out of their email is not: it waits for the confirm at q2, so the
     first thing the rail narrates is never a site nobody agreed to. */
  if (!isEmpty(slots().company_domain) && sources().company_domain !== 'work_email') {
    startResearch(slots().company_domain);
  }

  const chipLabel = o.chipLabel == null ? null : String(o.chipLabel);
  const initialText = o.initialText == null ? null : String(o.initialText);

  /* A campaign entry opens on its own opener rather than on q1 — unless the
     visitor arrived having already tapped a q1 chip on the master landing,
     in which case they have answered the very question the opener fuses. */
  const opener = chipLabel ? null : openerCampaign();
  if (opener) st.seq = [OPENER_ID].concat(ORDER);

  /* The product landing shows the opener on its own panel and hands the
     answer over as the opening message (see convo.js's autostart). Log the
     exchange that already happened instead of asking it a second time. */
  if (opener && initialText) {
    st.idx = 0;                    /* the opener IS seq[0] — answering it
                                      must advance from there, not re-ask it */
    present(OPENER_ID);
    return answer(initialText);
  }

  if (chipLabel) {
    S.events.emit('answer_given', {
      id: 'q1', slot: 'problem_domains', text: chipLabel, chip: null, source: 'chip'
    });
    const domain = domainFromLabel(chipLabel);
    if (domain) mergeDomains([domain], true);
    else applySide(await read(chipLabel), { domains: true });
  }

  if (initialText) {
    /* the opening message is the one place where everything is on the table:
       domains, a website (which skips q2 and starts research immediately),
       a headcount, and "can I just talk to someone". */
    const full = await read(initialText);
    applySide(full, { domains: !chipLabel });
    /* with a chip already down, the message's domains join it rather than
       replacing it — that is how one message becomes two domains, which is
       how a multi-product opportunity surfaces (routing override 1). */
    if (chipLabel) mergeDomains(full.domains, false);
    /* a message that named no problem: q1 is still asked, but in words that
       own the miss rather than the identical headline (QA, Sep 2) */
    if (!chipLabel && isEmpty(slots().problem_domains) && !openerCampaign()) { st.unclassified = true; st.reaskedQ1 = true; }
  }

  await advance();
  notify();
  return state();
}

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLIC SURFACE
   ═══════════════════════════════════════════════════════════════════════════ */
function state() {
  const S = eng();
  const view = questionView();
  const prog = progress();

  return {
    phase: st.phase,
    question: view ? Object.assign(view, {
      progressLabel: prog.progressLabel, progressPct: prog.progressPct
    }) : null,
    progressLabel: prog.progressLabel,
    progressPct: prog.progressPct,
    questionsAhead: prog.questionsAhead,
    questionsTotal: prog.questionsTotal,
    waitingLabel: st.phase === 'waiting-research' ? 'Still reading the site…' : null,
    asked: st.log.filter(e => e.status === 'asked').map(e => e.id),
    skipped: st.log.filter(e => e.status === 'skipped').map(e => ({ id: e.id, reason: e.reason })),
    research: (S && S.session.research) || null,
    company: S ? companyName() : null,
    humanAsk: !!(S && S.session.humanAsk)
  };
}

function notify() {
  const snapshot = state();
  listeners.slice().forEach(cb => {
    try { cb(snapshot); } catch (e) { /* one bad listener is not the flow's problem */ }
  });
}

function onChange(cb) {
  if (typeof cb !== 'function') return () => {};
  listeners.push(cb);
  return () => { listeners = listeners.filter(f => f !== cb); };
}

function result() {
  const S = eng();
  let session;
  try { session = JSON.parse(JSON.stringify(S.session)); } catch (e) { session = S.session; }
  return {
    session,
    route: st.phase === 'done' ? (st.route || S.route()) : null,
    asked: st.log.filter(e => e.status === 'asked').map(e => e.id),
    skipped: st.log.filter(e => e.status === 'skipped').map(e => ({ id: e.id, reason: e.reason }))
  };
}

const api = {
  start,
  state,
  answer,
  onChange,
  result,
  reset() { st = blank(); return state(); },
  researchWaitMs: 8000,

  /* exposed for tests and for anyone auditing the skip decisions */
  _skipReason: skipReason,
  _q6SkipReason: q6SkipReason,
  _q6Copy: q6Copy,
  _q6View: q6View,
  _realPeers: realPeers,
  _domainFromLabel: domainFromLabel,
  _openerCampaign: openerCampaign,
  _openerId: OPENER_ID,
  _crossValue: CROSS_VALUE
};

window.SAIFLOW = api;
})();
