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

  if (id === 'q2' && !isEmpty(s.company_domain)) return 'website_in_first_message';

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
        two or more domains, "just exploring", c-suite at mid-market or
        enterprise, or a visitor who asked for a human). The matrix is not
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
  if (s.timing_intent === 'exploring') return 'override_exploring';
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
  if (slots().company_domain === domain) { startResearch(domain); return; }
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

/* Research is allowed to improve the name we guessed off the domain, and
   nothing else. It never overwrites something the visitor typed — "visitor
   corrections always win" runs in this direction too. */
function onResearchDone(r) {
  if (!r) return;
  const S = eng();
  const src = sources().company;
  if (r.name && (isEmpty(slots().company) || src === 'inferred')) {
    S.setSlot('company', r.name, 'research');
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

const TIMING_PATTERNS = [
  ['exploring', /(just (looking|exploring|browsing|curious)|exploring|no timeline|not sure yet|kicking the tires|early days|window shopping|someday)/],
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
  return slots().company || (r && r.name) || slots().company_domain || 'your company';
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
  } else if (id === 'q3' || id === 'q5') {
    chips = (q.chips || []).map(c => ({ label: c.label, value: c.value }));
  } else if (id === 'q4') {
    mode = q4Mode();
    const r = eng().session.research || {};
    if (mode === 'confirm') {
      copy = tpl((q.confirmMode || {}).copy, {
        company: companyName(), employees: fmt(r.employees), industry: r.industry
      });
      chips = ((q.confirmMode || {}).chips || []).map(c => ({ label: c.label, value: c.value }));
    } else {
      copy = (q.askMode || {}).copy || '';
      chips = ((q.askMode || {}).chips || []).map(c => ({ label: c.label, value: c.tier }));
    }
  } else if (id === 'q6') {
    const domains = slots().problem_domains || [];
    copy = q6Copy(domains[0]) || '';
    chips = chipsFromCopy(copy);
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
   forecast and it is allowed to move — answering "just exploring" retires q6
   on the spot, and the bar should say so. */
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
  const domain = slots().company_domain;
  if (!R || !domain || R.done(domain)) return;
  const p = R.pending(domain);
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
    if (chip) S.setSlot('problem_domains', [chip.value], 'visitor');
    else applySide(await read(text), { domains: true });
    return;
  }

  if (id === 'q2') {
    const domain = S.extractDomain(text);
    if (domain) fillCompany(domain);
    else S.setSlot('company', value, 'visitor');
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

  const chips = (qById('q1') || {}).chips || [];
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
  researchWaitMs: 4000,

  /* exposed for tests and for anyone auditing the skip decisions */
  _skipReason: skipReason,
  _q6SkipReason: q6SkipReason,
  _q6Copy: q6Copy,
  _domainFromLabel: domainFromLabel,
  _openerCampaign: openerCampaign,
  _openerId: OPENER_ID,
  _crossValue: CROSS_VALUE
};

window.SAIFLOW = api;
})();
