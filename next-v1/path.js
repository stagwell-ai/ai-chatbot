/* ═══════════════════════════════════════════════════════════════════════════
   PATH — the S5 routing/handoff screen (reference/kit/W5-Routing-Handoff.png).

   Takes over from machine/snapshot.js once a visitor has seen (and either
   captured on, or declined) their snapshot: a full-width page section built
   from SAI.route()'s decision object (machine/engine.js) plus solutions.json
   for the product-level facts a handoff needs (positioning line, url).

   window.SAIPATH — the surface machine/snapshot.js hands off to:
     .show(session)   → mounts the path view for this session, pushes /path

   Nothing here touches engine.js, flow.js, research.js, convo.js,
   snapshot-data.js or b.js beyond the same two globals snapshot.js already
   leans on for the handoff (window.startDashboard) and the [data-cta] modal
   b.js wires on document — it reads window.SAI / window.SAIFLOW and renders
   what the routing decision says.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* dependency-free, same reasoning snapshot.js gives its own esc(): this file
   sits after snapshot.js in the script order (see machine/b.html), so every
   global it reads is guaranteed by the time show() actually runs, but not
   necessarily at parse time — kept local rather than assumed. */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
  { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

/* ─────────────────────────── SMALL DEFENSIVE HELPERS ─────────────────────────── */

function eng() { return window.SAI || null; }

function solutionsList() {
  try { return (eng().data.solutions || {}).solutions || []; }
  catch (e) { return []; }
}

/* "Reach better audiences (build & activate from first-party data)" →
   "reach better audiences" — the same quotable phrase engine.js's whyLine()
   builds its why-lines from, so the sub-header sentence and the transparency
   line always agree without duplicating the extraction logic itself. */
function labelPhrase(label) {
  if (!label) return '';
  return String(label).split(/\s*\(/)[0].replace(/[?.!]+$/, '')
    .replace(/'s\b/g, '').replace(/[''']/g, '').trim().toLowerCase();
}

function titleCase(s) {
  return String(s || '').replace(/\b\w/g, c => c.toUpperCase());
}

/* the phrase whyLine() (engine.js) quotes first, pulled back out of the
   why-string itself — the one place the domain's own words are guaranteed
   to already be phrased for a sentence. Falls back to the label if a
   why-line ever arrives without one. */
function quotedPhrase(m) {
  const hit = m && typeof m.why === 'string' && /^"([^"]+)"/.exec(m.why);
  return (hit && hit[1]) || labelPhrase(m && m.label);
}

/* Capability-first card titles — capabilities language, never a product
   name, keyed by routing.json's own domain ids so a data change there is
   the only thing that can go stale here. */
const CAPABILITY_TITLES = {
  brand_health: 'Brand health tracking & benchmarking',
  competitive: 'Competitive benchmarking & intelligence',
  research: 'Do-it-yourself consumer research',
  business_impact: 'Predictive brand analytics',
  audiences: 'Audience building & activation',
  influencer: 'Influencer & creator program management',
  reputation: 'Reputation risk monitoring',
  media_monitoring: 'Global media & narrative monitoring',
  ai_visibility: 'AI-search visibility tracking',
  real_world_behavior: 'Real-world behavior measurement',
  marketing_ops: 'Unified marketing operations'
};

function capabilityTitle(m) {
  return CAPABILITY_TITLES[m && m.domain] || titleCase(labelPhrase(m && m.label)) || 'This capability';
}

/* routing.json's matched[].solution strings are display names — sometimes a
   single product ("QuestBrand"), sometimes a "pick one" frame ("Stagwell AI
   for SMBs (small teams) / IMAI Enterprise (100+ creators)", "The Machine /
   The Media Machine"). Those two frames are resolved by domain + tier, per
   the sprint note; everything else resolves by normalized name-inclusion.
   No match is a card without a credit chip or a link — never a throw. */
function resolveSolution(m, tier, list) {
  try {
    if (!m || !m.solution) return null;
    if (m.domain === 'influencer') {
      const id = tier === 'smb' ? 'smb_platform' : 'imai';
      return list.find(s => s.id === id) || null;
    }
    if (m.domain === 'marketing_ops') {
      return list.find(s => s.id === 'machines_family') || null;
    }
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const target = norm(m.solution);
    if (!target) return null;
    let hit = list.find(s => norm(s.name) === target);
    if (hit) return hit;
    hit = list.find(s => target.indexOf(norm(s.name)) !== -1 || norm(s.name).indexOf(target) !== -1);
    return hit || null;
  } catch (e) { return null; }
}

/* solutions.json's positioning is several sentences; the card only wants the
   first — but a couple of entries open on a very short beat ("Your data."),
   so short openers borrow the next sentence too, up to a readable length. */
function firstSentences(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  let out = parts[0] || t;
  let i = 1;
  while (out.length < 40 && i < parts.length) { out += ' ' + parts[i]; i++; }
  return out;
}

const NUM_WORDS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];
const countWord = n => (n >= 0 && n <= 5) ? NUM_WORDS[n] : String(n);

function companyName(session) {
  try {
    if (window.SAISNAPDATA && typeof window.SAISNAPDATA.build === 'function') {
      const d = window.SAISNAPDATA.build(session);
      if (d && d.company) return d.company;
    }
  } catch (e) { /* fall through to the plain slot read below */ }
  const slots = (session && session.slots) || {};
  if (typeof slots.company === 'string' && slots.company.trim()) return slots.company.trim();
  if (slots.company_domain) return String(slots.company_domain).split('.')[0].replace(/^\w/, c => c.toUpperCase());
  return 'Your brand';
}

/* "You told us you're trying to X and Y — two capabilities fit, and they
   work better together." (W5) / the single-capability variant beneath it. */
function subSentence(matched) {
  if (!matched.length) return "Here's what we'd suggest, based on what you told us.";
  if (matched.length >= 2) {
    const a = quotedPhrase(matched[0]), b = quotedPhrase(matched[1]);
    if (a && b) return `You told us you're trying to ${a} and ${b} — two capabilities fit, and they work better together.`;
    return 'You told us a couple of things fit — these capabilities work better together.';
  }
  const a = quotedPhrase(matched[0]);
  return a
    ? `You told us you're trying to ${a} — here's the capability that fits.`
    : "Here's the capability that fits what you told us.";
}

/* utm_source=stagwell-ai · utm_medium (routing, or 'cross-discovery' for the
   surface-D row) · utm_campaign (session's, or 'master') · sai_route — every
   external product link carries all four. */
function attributedUrl(baseUrl, session, route, medium) {
  if (!baseUrl) return null;
  let u;
  try { u = new URL(baseUrl); } catch (e) { return baseUrl; }
  const params = new URLSearchParams(u.search);
  params.set('utm_source', 'stagwell-ai');
  params.set('utm_medium', medium || 'routing');
  params.set('utm_campaign', (session && session.attribution && session.attribution.utm_campaign) || 'master');
  params.set('sai_route', route || '');
  u.search = params.toString();
  return u.toString();
}

/* the one place a product link gets built, live or as a disabled placeholder
   — solutions.json's own url:null products (no public site yet) render the
   kit's placeholder discipline instead of a dead link. handoff_click fires
   only from the real link; a disabled placeholder emits nothing. */
function productLinkHTML(solution, session, route, label, cls, medium) {
  if (solution && solution.url) {
    const href = attributedUrl(solution.url, session, route, medium);
    return `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener"
      data-handoff data-solution="${esc(solution.id)}" data-url="${esc(solution.url)}" data-route="${esc(route)}">${esc(label)}</a>`;
  }
  return `<span class="${cls} is-disabled" aria-disabled="true">${esc(label)} <i>[PRODUCT SITE — pending]</i></span>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE HONEST CTA — "Why does this say website pending? It should know the URL
   … and whether this website has a self-service sign up. If they have a
   self-service sign up, definitely have a real button." (client, Aug 31)

   solutions.json now answers both halves per product: `url` is the site, and
   `signupUrl` is a real self-serve door or null. Three states, resolved here
   once and rendered identically in the self-serve hero, the "Start on your
   own" column and on the matched cards themselves:

     signupUrl → a real marigold button, "Start your free trial →"
     url only  → "Start on {name} →", and a caption that says signup is coming
     neither   → the kit's disabled placeholder (machines_family alone today)

   The screenshotted bug — "[PRODUCT SITE — PENDING]" set inside an enabled
   marigold button on the SMB influencer route — cannot recur: that route's
   solution now carries a signupUrl, and the placeholder state below is
   deliberately NOT marigold, so the pending words can never again sit inside
   a button that looks live.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Where a product's self-serve door sits on ANOTHER product's platform, the
   button says so under itself rather than quietly redirecting. Keyed by
   solution id — the note is a fact about that product, not a rule.
   smb_platform: the ICP deck gives "Stagwell AI for SMBs" and IMAI the same
   icon because the SMB offering IS the IMAI-based platform, so its free trial
   is IMAI's free trial and the caption keeps that honest. */
const SIGNUP_NOTES = { smb_platform: 'Runs on the IMAI platform' };
const COMING_SOON_NOTE = 'Self-serve signup is coming — the product site takes it from here.';

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}

/* → { kind, label, href, rawUrl, caption, captionScope }. href null means the
   placeholder state. captionScope 'solution' is a fact about this product and
   travels with the button everywhere; 'generic' is the coming-soon line, which
   only the two decision surfaces show so it is not repeated on every card. */
function ctaFor(solution, session, route, medium, pendingLabel) {
  const s = solution || null;
  if (s && s.signupUrl) {
    /* a note only makes sense when the signup really is somewhere else */
    const away = hostOf(s.signupUrl) !== hostOf(s.url);
    const note = away ? (SIGNUP_NOTES[s.id] || null) : null;
    return {
      kind: 'trial', label: 'Start your free trial →',
      href: attributedUrl(s.signupUrl, session, route, medium), rawUrl: s.signupUrl,
      caption: note, captionScope: note ? 'solution' : null
    };
  }
  if (s && s.url) {
    return {
      kind: 'coming', label: 'Start on ' + s.name + ' →',
      href: attributedUrl(s.url, session, route, medium), rawUrl: s.url,
      caption: COMING_SOON_NOTE, captionScope: 'generic'
    };
  }
  return {
    /* '' is a real choice here — the matched card wants the bare placeholder —
       so only an absent label falls back. */
    kind: 'pending', label: pendingLabel == null ? 'Start on your own' : pendingLabel,
    href: null, rawUrl: null, caption: null, captionScope: null
  };
}

function ctaHTML(cta, solution, route, cls) {
  if (cta.href) {
    return `<a class="${cls}" href="${esc(cta.href)}" target="_blank" rel="noopener"
      data-handoff data-solution="${esc(solution.id)}" data-url="${esc(cta.rawUrl)}" data-route="${esc(route)}">${esc(cta.label)}</a>`;
  }
  /* an empty pending label leaves the placeholder standing on its own — the
     matched card already carries the product's lockup and name, and
     "See Stagwell's Machines (family frame) → [PRODUCT SITE — pending]" is a
     mouthful that says nothing the band above it has not said. */
  return `<span class="${cls} is-disabled" aria-disabled="true">${
    cta.label ? esc(cta.label) + ' ' : ''}<i>[PRODUCT SITE — pending]</i></span>`;
}

function captionHTML(cta, cls, scopes) {
  if (!cta.caption) return '';
  if (scopes && scopes.indexOf(cta.captionScope) === -1) return '';
  return `<p class="${cls}">${esc(cta.caption)}</p>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE PRODUCT BAND AND ITS PILLS — "more beefy … the logo of the product and
   something more visually impressive representing the different value
   offerings, consistent among all ten products." (client, Aug 31)

   One treatment, two sizes: a navy header band carrying the product's own
   lockup, and the ICP deck's use-case chips as quiet outline pills. Both read
   straight off solutions.json (`lockup`, `valueProps`), so a matched card and
   a cross-discovery card present the same product the same way, and adding a
   product is a data edit.

   The band's navy is the lockup PNGs' own background, sampled from their
   corner pixel (#0A1743) and set in path.css — the image has no visible
   edge inside the band, it simply IS the band. That band is also where the
   "powered by" credit now lives: the old text chip was removed rather than
   duplicated under the product's own logo.
   ═══════════════════════════════════════════════════════════════════════════ */

/* size: 'lg' (matched cards) | 'sm' (cross-discovery). solutions.json has one
   entry with no lockup in the deck at all (Unlock) — the band still carries
   the credit, set as a wordmark, rather than collapsing for that one product
   and breaking the consistency the complaint is about. */
function bandHTML(solution, size) {
  if (!solution || !solution.name) return '';
  const cls = 'pathband pathband--' + size;
  if (solution.lockup) {
    /* not lazy: the first band is above the fold the moment show() scrolls the
       section into view, and a card that fades in with an empty navy strip is
       exactly the "not visually impressive" note this band answers. */
    return `<div class="${cls}"><img class="pathband__lockup" src="${esc(solution.lockup)}"
      alt="${esc(solution.name)}" decoding="async"></div>`;
  }
  return `<div class="${cls}"><span class="pathband__word">${esc(solution.name)}</span></div>`;
}

function pillsHTML(solution, max) {
  const all = (solution && Array.isArray(solution.valueProps)) ? solution.valueProps : [];
  const list = (max ? all.slice(0, max) : all).filter(Boolean);
  if (!list.length) return '';
  return `<ul class="pathpills">${list.map(p => `<li class="pathpill">${esc(p)}</li>`).join('')}</ul>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SURFACE D — "Teams solving this usually also ask about…"

   solutions.json names four surfaces; D is this row, and its own definition
   says when it runs: "shown after the primary match is established". So it
   reads the PRIMARY matched solution's companions list and nothing else —
   the sibling products that entry itself points at, resolved back through
   solutions.json for the facts a quiet card needs.
   ═══════════════════════════════════════════════════════════════════════════ */

const CROSS_HEADER = 'Teams solving this usually also ask about…';
const CROSS_MAX = 3;

/* One entry's companions list is not a list at all: GEOPulse carries
   companions:["all"] — "D: universal companion" in its own shownWhen, a
   statement about GEOPulse rather than a set of ids. 'all' is therefore
   skipped and these two stand in: its shownWhen also puts it beside brand
   work and the reputation/knowledge conversation, which is what these are. */
const COMPANIONS_ALL_FALLBACK = ['questbrand', 'knowledge_machine'];

/* solutions.json, numetrix: "firmographic trigger: retail/QSR/venue
   footprint detected — offered even unasked". The visitor never has to ask
   for real-world behavior measurement; a category with a physical footprint
   is the ask. restaurant/hospitality are the same footprint said in the
   other words research.industry (free text from the LLM) tends to use. */
const FOOTPRINT_RE = /retail|qsr|restaurant|venue|hospitalit/i;
const FOOTPRINT_REASON = 'Suggested for your category';

function companionIds(primary) {
  const raw = (primary && Array.isArray(primary.companions)) ? primary.companions.map(String) : [];
  const real = raw.filter(id => id && id !== 'all');
  if (raw.indexOf('all') === -1) return real;
  return real.concat(COMPANIONS_ALL_FALLBACK.filter(id => real.indexOf(id) === -1));
}

function researchIndustry(session) {
  try {
    const r = (session && session.research) || (eng() && eng().session && eng().session.research);
    return String((r && r.industry) || '');
  } catch (e) { return ''; }
}

/* one quiet card's data — never the solution object itself, so the render
   side can stay dumb about solutions.json's shape. */
function crossCard(solution, reason) {
  return {
    id: solution.id,
    name: solution.name,
    body: firstSentences(solution.positioning),
    whoFor: solution.whoFor || '',
    reason: reason || null,
    solution
  };
}

function buildCrossDiscovery(primary, matchedIds, list, session) {
  const seen = (matchedIds || []).slice();
  if (primary && primary.id && seen.indexOf(primary.id) === -1) seen.push(primary.id);

  const cards = [];
  companionIds(primary).forEach(id => {
    if (cards.length >= CROSS_MAX) return;
    if (seen.indexOf(id) !== -1) return;          /* already a matched card */
    const s = list.find(x => x && x.id === id);
    if (!s) return;
    seen.push(id);
    cards.push(crossCard(s, null));
  });

  /* the unasked one, appended after the companions it did not displace.
     (With today's data every companions list is ≤ 2, so the row is still
     three cards at most; the CROSS_MAX cap above is on companions alone.) */
  if (FOOTPRINT_RE.test(researchIndustry(session)) && seen.indexOf('numetrix') === -1) {
    const s = list.find(x => x && x.id === 'numetrix');
    if (s) cards.push(crossCard(s, FOOTPRINT_REASON));
  }

  return cards;
}

/* ─────────────────────────── VIEW MODEL ─────────────────────────── */

function buildViewModel(session, decision) {
  const solutions = solutionsList();
  const tier = decision.tier;
  const matchedRaw = Array.isArray(decision.matched) ? decision.matched : [];

  const matchedIds = [];
  const matched = matchedRaw.map(m => {
    const solution = resolveSolution(m, tier, solutions);
    if (solution && solution.id) matchedIds.push(solution.id);
    /* a product that answers more than one problem can carry a line written
       for each: solutions.json positioningByDomain[domain] wins over the
       general positioning, so QuestBrand's competitive card leads with the
       benchmarking half rather than the brand-tracking half */
    const perDomain = solution && solution.positioningByDomain
      && solution.positioningByDomain[m.domain];
    const body = solution
      ? firstSentences(perDomain || solution.positioning)
      : (decision.cellNote || 'A dedicated capability matched to what you told us.');
    return {
      domain: m.domain,
      title: capabilityTitle(m),
      body,
      why: m.why || 'matches what you told us',
      /* the credit is the band's lockup now (see bandHTML) — the solution
         itself travels with the card so the band, the pills and the card's
         own CTA all read the same entry. */
      credit: solution ? solution.name : null,
      solution
    };
  });

  /* matchedRaw[0] is the primary because engine.js already ranked it there
     (sprint 6 ICP boosts) — surface D follows whatever it decided. */
  const primarySolution = matchedRaw.length ? resolveSolution(matchedRaw[0], tier, solutions) : null;
  const cross = buildCrossDiscovery(primarySolution, matchedIds, solutions, session);

  let askedCount = 0;
  try {
    if (window.SAIFLOW && typeof window.SAIFLOW.result === 'function') {
      askedCount = (SAIFLOW.result().asked || []).length;
    }
  } catch (e) { askedCount = 0; }

  return {
    company: companyName(session),
    /* 'BASED ON YOUR ZERO ANSWERS' is never a sentence worth showing — a
       visitor who reached the path without a counted question (a deep link,
       or a campaign whose prefill answered everything) gets the plain line */
    eyebrow: askedCount > 0
      ? `BASED ON YOUR ${countWord(askedCount)} ANSWER${askedCount === 1 ? '' : 'S'}`
      : 'BASED ON WHAT YOU TOLD US',
    sub: subSentence(matchedRaw),
    matched,
    cross,
    route: decision.route,
    primarySolution,
    session
  };
}

/* ─────────────────────────── RENDER PIECES ─────────────────────────── */

/* The matched card, rich: the product's own lockup on the deck navy, then on
   white the capability title, the positioning opener, the value pills, the
   why-matched line and the card's own CTA. The credit chip that used to close
   this card is gone — the band above says the same thing in the product's own
   type, and saying it twice was the duplication the band replaces. */
function cardHTML(m, session, route) {
  const s = m.solution;
  const cta = s ? ctaFor(s, session, route, 'routing', '') : null;
  return `
    <article class="pathcard">
      ${bandHTML(s, 'lg')}
      <div class="pathcard__in">
        <h3>${esc(m.title)}</h3>
        ${s && s.name ? `<p class="pathcard__prod"><b>${esc(s.name)}</b>${
          s.whoFor ? ` · built for ${esc(String(s.whoFor).charAt(0).toLowerCase() + String(s.whoFor).slice(1))}` : ''
        }</p>` : ''}
        <p class="pathcard__body">${esc(m.body)}</p>
        ${pillsHTML(s)}
        <p class="pathcard__why">Why matched: ${esc(m.why)}</p>
        ${cta ? `<div class="pathcard__foot">
          ${ctaHTML(cta, s, route, 'pathcard__cta')}
          ${captionHTML(cta, 'pathcard__note', ['solution'])}
        </div>` : ''}
      </div>
    </article>`;
}

/* surface D's quiet card: name, the positioning opener, who it's for, and an
   attributed link out (utm_medium=cross-discovery, so the row's traffic is
   separable from the routing screen's own handoffs). url:null products get
   the same disabled placeholder discipline as everywhere else, via the same
   productLinkHTML — which also means these links carry [data-handoff] and
   ride the existing handoff_click wiring with no second code path. */
const CROSS_PILLS = 3;

function crossCardHTML(c, session, route) {
  const label = 'See ' + c.name + ' →';
  return `
    <article class="crosscard">
      ${bandHTML(c.solution, 'sm')}
      <div class="crosscard__in">
        <h3>${esc(c.name)}</h3>
        <p class="crosscard__body">${esc(c.body)}</p>
        ${c.whoFor ? `<p class="crosscard__who">${esc(c.whoFor)}</p>` : ''}
        ${pillsHTML(c.solution, CROSS_PILLS)}
        <div class="crosscard__foot">
          ${c.reason ? `<p class="crosscard__tag">${esc(c.reason)}</p>` : ''}
          ${productLinkHTML(c.solution, session, route, label, 'crosscard__link', 'cross-discovery')}
        </div>
      </div>
    </article>`;
}

function crossSectionHTML(vm) {
  if (!vm.cross.length) return '';
  return `
    <div class="path__section path__section--cross">
      <p class="cross__head">${esc(CROSS_HEADER)}</p>
      <div class="crosscards">${vm.cross.map(c => crossCardHTML(c, vm.session, vm.route)).join('')}</div>
    </div>`;
}

/* [RECOMMENDED] / [SALES-LED] / [SELF-SERVICE] — three fixed columns, the
   RECOMMENDED treatment moving to whichever one decision.route actually
   points at (consultative → talk, demo → the demo column). */
function threeColumnsHTML(vm) {
  const { matched, route, primarySolution, session } = vm;
  const demoRecommended = route === 'demo';
  const talkRecommended = !demoRecommended;

  const talkBody = matched.length >= 2
    ? 'One conversation covering both capabilities — brought to the right team, already briefed with your snapshot.'
    : 'One conversation about this — brought to the right team, already briefed with your snapshot.';

  const ctaCls = recommended => 'btn ' + (recommended ? 'btn--gold' : 'btn--ghost') + ' pathcol__cta';

  /* "Start on your own" now states which of the three doors this visitor's
     product actually has (see ctaFor). A real self-serve signup earns the
     marigold treatment even in a column that is not the recommended one —
     the client's point: if the trial exists, it should look like a trial. */
  const selfCta = ctaFor(primarySolution, session, route, 'routing', 'Start a trial');
  const selfCls = 'btn ' + (selfCta.kind === 'trial' ? 'btn--gold' : 'btn--ghost') + ' pathcol__cta';
  const selfBody = selfCta.kind === 'pending'
    ? 'Where a capability has a self-serve product, go straight to signup or trial — your snapshot comes with you.'
    : 'Go straight to the product — your snapshot comes with you.';

  return `<div class="pathcols">
    <div class="pathcol${talkRecommended ? ' is-recommended' : ''}">
      <p class="pathcol__eyebrow">${talkRecommended ? 'RECOMMENDED' : 'CONSULTATIVE'}</p>
      <h3>Talk it through with Stagwell</h3>
      <p class="pathcol__body">${esc(talkBody)}</p>
      <button type="button" class="${ctaCls(talkRecommended)}" data-cta="session">Book a working session</button>
    </div>
    <div class="pathcol${demoRecommended ? ' is-recommended' : ''}">
      <p class="pathcol__eyebrow">${demoRecommended ? 'RECOMMENDED' : 'SALES-LED'}</p>
      <h3>Get a demo of one capability</h3>
      <p class="pathcol__body">30 minutes with the product's own team, scheduled now.</p>
      <div class="pathcol__slot">[CALENDAR / SCHEDULER EMBED]</div>
      <button type="button" class="btn btn--gold pathcol__cta pathcol__cta--demo" data-cta="demo">Book a demo →</button>
    </div>
    <div class="pathcol">
      <p class="pathcol__eyebrow">SELF-SERVICE</p>
      <h3>Start on your own</h3>
      <p class="pathcol__body">${esc(selfBody)}</p>
      <div class="pathcol__act">
        ${ctaHTML(selfCta, primarySolution, route, selfCls)}
        ${captionHTML(selfCta, 'pathcol__note')}
        ${pendingNoteHTML(vm, 'pathcol__note')}
      </div>
    </div>
  </div>`;
}

/* route === 'self_serve' — the state variant at the bottom of W5: a
   dominant navy hero replaces the three-card row entirely; demo and
   consultative collapse to quiet text links. */
function heroHTML(vm) {
  const { primarySolution, session, route } = vm;
  const cta = ctaFor(primarySolution, session, route, 'routing', 'Start your free trial →');
  /* the placeholder state is the one thing in this hero that must NOT look
     marigold — an amber button reading "[PRODUCT SITE — pending]" is the exact
     screenshot the client sent back. On navy the honest disabled treatment is
     the void ghost, not the gold. */
  const cls = 'btn ' + (cta.kind === 'pending' ? 'btn--ghost-void' : 'btn--gold') + ' pathhero__cta';
  const sub = cta.kind === 'coming'
    ? 'Your snapshot comes with you. Pick up where the product site takes over — no meeting in between.'
    : 'Your account starts with your snapshot already loaded. Free to try; upgrade when it earns it.';
  return `
    <div class="pathhero">
      <div class="pathhero__text">
        <h2 class="pathhero__title">You can start right now — <span class="accent">no meeting needed.</span></h2>
        <p class="pathhero__sub">${esc(sub)}</p>
      </div>
      <div class="pathhero__act">
        ${ctaHTML(cta, primarySolution, route, cls)}
        ${captionHTML(cta, 'pathhero__note')}
        ${pendingNoteHTML(vm, 'pathhero__note')}
        <p class="pathhero__walkline">Would rather be walked through it?</p>
        <button type="button" class="btn btn--light pathhero__walk" data-cta="demo">Book a demo →</button>
      </div>
    </div>
    <div class="pathcollapse">
      <button type="button" class="pathcollapse__link" data-cta="session">Or talk it through with Stagwell instead</button>
    </div>`;
}

/* route === 'follow_up' — RETIRED Sep 2. routing.json no longer routes anyone
   here ("we want everyone to end on book a demo, start a free trial or talk
   to Stagwell"); the renderer stays only so a follow_up cell written back into
   routing.json by hand still gets its designed quiet card rather than a blank.
   The old rule: a quiet card where the recommended column would be; the other
   two paths collapse to text links. */
/* did a report actually get an address? snapshot-data.js emits
   journey_converted {kind:'capture'} on Send my report, and capture_declined
   on "No thanks". The follow_up copy used to promise "the report's on its
   way" to a visitor who had just declined to give an email (QA, Sep 2). */
function reportCaptured() {
  try {
    const list = (window.SAI && window.SAI.events && window.SAI.events.list()) || [];
    return list.some(e => e && e.type === 'journey_converted' && e.payload && e.payload.kind === 'capture');
  } catch (e) { return false; }
}

function followUpHTML() {
  const captured = reportCaptured();
  const title = captured
    ? "No meeting needed — the report's on its way"
    : 'No meeting needed — your snapshot stays right here';
  const line = captured
    ? "Your snapshot goes out by email, and we'll follow up if it makes sense. No calendar invite required."
    : "You kept your details, so nothing goes anywhere. If you want the snapshot as a PDF, add an email on the snapshot page; otherwise we won't follow up unless you ask.";
  return `
    <div class="pathquiet">
      <p class="pathquiet__eyebrow">${captured ? "WE'LL TAKE IT FROM HERE" : 'NOTHING TO DO'}</p>
      <h3>${esc(title)}</h3>
      <p>${esc(line)}</p>
      <a class="pathquiet__link" href="/next-v1">Ask something else</a>
    </div>
    <!-- The ONE state where the demo is deliberately not a loud ask. This
         visitor said they are just exploring, and routing.json's follow_up
         cell is explicit: "Snapshot by email + light follow-up; no meeting
         push." So there is no gold button and no scheduler here — one quiet
         line offers a conversation for whoever wants one, and nothing else.
         (Two booking links under a "no meeting needed" headline read as a
         contradiction — QA, Sep 2.) -->
    <div class="pathcollapse">
      <button type="button" class="pathcollapse__link" data-cta="session">Prefer to talk it through? Book a working session</button>
    </div>`;
}

/* routing.json's own "[to confirm]" notes never reached a screen: nextStep is
   read by no surface and cellNote only rendered when a solution failed to
   resolve (QA, Sep 2). A bracketed note is the kit's placeholder discipline —
   it belongs in view, under the button it qualifies. */
function pendingNoteHTML(vm, cls) {
  const note = vm && vm.decision && vm.decision.cellNote;
  if (!note || !/\[/.test(String(note))) return '';
  return `<p class="${cls} pathnote--pending">${esc(String(note))}</p>`;
}

function continueSectionHTML(vm) {
  if (vm.route === 'self_serve') return heroHTML(vm);
  if (vm.route === 'follow_up') return followUpHTML(vm);
  return threeColumnsHTML(vm);
}

/* The footer's "Explore the product site" is about the PRIMARY solution — the
   one this screen just routed the visitor to — so it uses the best URL we
   actually know: the product site, or, where a product has no page of its own
   yet, the self-serve platform it runs on. That is the client's point in
   complaint A: if we know a URL, do not say pending. The cross-discovery row
   deliberately keeps the strict product-site-only discipline — those are other
   products, and a placeholder there is the honest answer, not a redirect. */
function siteSolution(s) {
  if (!s || s.url || !s.signupUrl) return s || null;
  return { id: s.id, name: s.name, url: s.signupUrl };
}

function footerWorkspaceHTML(session) {
  const domain = session && session.slots && session.slots.company_domain;
  if (domain) return `<button type="button" class="pathfoot__link" data-action="workspace-live">Request your full AI workspace</button>`;
  return `<button type="button" class="pathfoot__link" data-cta="workspace">Request your full AI workspace</button>`;
}

function sectionHTML(vm) {
  return `
    <div class="path__in">
      <p class="eyebrow path__eyebrow"><i class="pulse"></i>${esc(vm.eyebrow)}</p>
      <h1 class="display path__title">Here's the path we'd recommend for ${esc(vm.company)}</h1>
      <p class="path__sub">${esc(vm.sub)}</p>

      ${vm.matched.length ? `
      <div class="path__section">
        <div class="path__sectionhead">
          <p class="path__label">MATCHED CAPABILITIES</p>
          ${vm.matched.length >= 2 ? '<span class="path__note">Two capabilities matched · they work better together</span>' : ''}
        </div>
        <div class="pathcards">${vm.matched.map(m => cardHTML(m, vm.session, vm.route)).join('')}</div>
      </div>` : ''}

      ${crossSectionHTML(vm)}

      <div class="path__section">
        <p class="path__label">CHOOSE HOW TO CONTINUE</p>
        ${continueSectionHTML(vm)}
      </div>

      <div class="pathfoot">
        <p class="pathfoot__lede">Prefer to read first? Deeper education continues on the product sites.</p>
        <div class="pathfoot__links">
          ${footerWorkspaceHTML(vm.session)}
          <button type="button" class="pathfoot__link" data-cta="callback">Let Stagwell AI call you</button>
          ${productLinkHTML(siteSolution(vm.primarySolution), vm.session, vm.route, 'Explore the product site →', 'pathfoot__link pathfoot__link--arrow')}
        </div>
      </div>
    </div>`;
}

/* ─────────────────────────── POST-MOUNT WIRING ─────────────────────────── */

function wireLinks(root, session) {
  $$('[data-handoff]', root).forEach(a => {
    a.addEventListener('click', () => {
      try {
        eng().events.emit('handoff_click', {
          solution: a.dataset.solution || null,
          url: a.dataset.url || null,
          route: a.dataset.route || null
        });
      } catch (e) { /* the tab still opens without the log line */ }
    });
  });
  $$('[data-action="workspace-live"]', root).forEach(btn => {
    btn.addEventListener('click', () => {
      const domain = session && session.slots && session.slots.company_domain;
      if (domain && typeof window.startDashboard === 'function') window.startDashboard(domain);
    });
  });
  /* [data-cta] buttons (session / expert / callback / the no-domain
     workspace fallback) are picked up by machine/b.js's own delegated
     document click listener — nothing to wire here. */
}

/* ─────────────────────────── MOUNT / TEARDOWN ─────────────────────────── */

const HIDE_SELECTORS = '#hero2, #dash, #cloud, #cta, #snapView';
let mounted = false;
let savedHidden = null;

function ensureSection() {
  let el = $('#pathView');
  if (el) return el;
  el = document.createElement('section');
  el.id = 'pathView';
  el.className = 'path';
  el.hidden = true;
  el.setAttribute('aria-label', 'Your recommended path');
  const main = $('#top');
  const snapView = $('#snapView');
  if (main && snapView && snapView.parentElement === main) main.insertBefore(el, snapView.nextSibling);
  else if (main) main.appendChild(el);
  else document.body.appendChild(el);
  return el;
}

function hideRestOfPage() {
  const targets = $$(HIDE_SELECTORS);
  savedHidden = targets.map(el => ({ el, hidden: el.hidden }));
  targets.forEach(el => { el.hidden = true; });
}

function restoreRestOfPage() {
  if (!savedHidden) return;
  savedHidden.forEach(({ el, hidden }) => { el.hidden = hidden; });
  savedHidden = null;
}

function teardown() {
  const el = $('#pathView');
  if (el) { el.hidden = true; el.innerHTML = ''; }
  restoreRestOfPage();
  mounted = false;
}

function show(session) {
  const S = eng();
  let decision;
  try { decision = S ? S.route() : null; } catch (e) { decision = null; }
  /* a broken engine still gets a screen: the demo is the one ask every product
     can honestly make (follow_up, the old fallback, was retired Sep 2) */
  if (!decision) decision = { route: 'demo', primaryDomain: null, tier: null, matched: [], override: null, cellNote: null };

  const vm = buildViewModel(session, decision);
  vm.decision = decision;
  hideRestOfPage();
  const el = ensureSection();
  el.innerHTML = sectionHTML(vm);
  el.hidden = false;
  mounted = true;

  wireLinks(el, session);

  try { history.pushState({}, '', '/next-v1/path'); } catch (e) { /* fine, still works without a real route */ }

  requestAnimationFrame(() => el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }));
}

window.addEventListener('popstate', () => {
  if (location.pathname === '/next-v1/path') return;
  if (!mounted) return;
  teardown();
});

/* The recommendation, before the visitor reaches this screen.

   The conversation and the snapshot both need to say what the read is FOR —
   "you asked about influencer marketing, and the product I'd point at it is
   IMAI" — and they must name the same product this screen will. So the
   resolution lives here, once, and they ask for it rather than re-deriving
   it from routing.json themselves. Everything is optional: no route, no
   match, no solutions file all return nulls, and the callers fall back to
   copy that names nothing. */
/* "Protect reputation — see risks before they become stories" → "protect
   reputation". The head of the label is the goal; the rest is its gloss, and
   a sentence built around the whole thing reads as three clauses joined by
   dashes. Same trim as flow.js goalPhrase(), which q5 uses. */
function goalOf(label) {
  const t = String(label || '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .split(/\s+[—–:-]\s+/)[0]
    .replace(/[?.!]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : null;
}

function recommend() {
  const S = eng();
  try {
    const decision = S ? S.route() : null;
    if (!decision) return null;
    const m = (decision.matched || [])[0] || null;
    const list = solutionsList();
    const solution = m ? resolveSolution(m, decision.tier, list) : null;
    return {
      domain: (m && m.domain) || decision.primaryDomain || null,
      label: (m && m.label) || null,
      /* the label as a sentence can swallow it: "track brand health and
         campaign impact" — parenthetical gone, and the gloss after a dash or
         colon gone too, the same trim machine/flow.js makes for q5's goal */
      phrase: (m && goalOf(m.label)) || null,
      capability: m ? capabilityTitle(m) : null,
      solution: solution || null,
      solutionName: (solution && solution.name) || null,
      route: decision.route || null,
      tier: decision.tier || null
    };
  } catch (e) { return null; }
}

window.SAIPATH = { show, recommend };

})();
