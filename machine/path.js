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

/* utm_source=stagwell-ai · utm_medium=routing · utm_campaign (session's, or
   'master') · sai_route — every external product link carries all four. */
function attributedUrl(baseUrl, session, route) {
  if (!baseUrl) return null;
  let u;
  try { u = new URL(baseUrl); } catch (e) { return baseUrl; }
  const params = new URLSearchParams(u.search);
  params.set('utm_source', 'stagwell-ai');
  params.set('utm_medium', 'routing');
  params.set('utm_campaign', (session && session.attribution && session.attribution.utm_campaign) || 'master');
  params.set('sai_route', route || '');
  u.search = params.toString();
  return u.toString();
}

/* the one place a product link gets built, live or as a disabled placeholder
   — solutions.json's own url:null products (no public site yet) render the
   kit's placeholder discipline instead of a dead link. handoff_click fires
   only from the real link; a disabled placeholder emits nothing. */
function productLinkHTML(solution, session, route, label, cls) {
  if (solution && solution.url) {
    const href = attributedUrl(solution.url, session, route);
    return `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener"
      data-handoff data-solution="${esc(solution.id)}" data-url="${esc(solution.url)}" data-route="${esc(route)}">${esc(label)}</a>`;
  }
  return `<span class="${cls} is-disabled" aria-disabled="true">${esc(label)} <i>[PRODUCT SITE — pending]</i></span>`;
}

/* ─────────────────────────── VIEW MODEL ─────────────────────────── */

function buildViewModel(session, decision) {
  const solutions = solutionsList();
  const tier = decision.tier;
  const matchedRaw = Array.isArray(decision.matched) ? decision.matched : [];

  const matched = matchedRaw.map(m => {
    const solution = resolveSolution(m, tier, solutions);
    const body = solution ? firstSentences(solution.positioning)
      : (decision.cellNote || 'A dedicated capability matched to what you told us.');
    return {
      domain: m.domain,
      title: capabilityTitle(m),
      body,
      why: m.why || 'matches what you told us',
      credit: solution ? solution.name : null
    };
  });

  const primarySolution = matchedRaw.length ? resolveSolution(matchedRaw[0], tier, solutions) : null;

  let askedCount = 0;
  try {
    if (window.SAIFLOW && typeof window.SAIFLOW.result === 'function') {
      askedCount = (SAIFLOW.result().asked || []).length;
    }
  } catch (e) { askedCount = 0; }

  return {
    company: companyName(session),
    eyebrow: `BASED ON YOUR ${countWord(askedCount)} ANSWERS`,
    sub: subSentence(matchedRaw),
    matched,
    route: decision.route,
    primarySolution,
    session
  };
}

/* ─────────────────────────── RENDER PIECES ─────────────────────────── */

function cardHTML(m) {
  return `
    <article class="pathcard">
      <h3>${esc(m.title)}</h3>
      <p class="pathcard__body">${esc(m.body)}</p>
      <p class="pathcard__why">Why matched: ${esc(m.why)}</p>
      ${m.credit ? `<span class="pathcard__credit">powered by ${esc(m.credit)}</span>` : ''}
    </article>`;
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
  const trialCta = productLinkHTML(primarySolution, session, route, 'Start a trial', ctaCls(false));

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
      <button type="button" class="${ctaCls(demoRecommended)}" data-cta="expert">Request a demo</button>
    </div>
    <div class="pathcol">
      <p class="pathcol__eyebrow">SELF-SERVICE</p>
      <h3>Start on your own</h3>
      <p class="pathcol__body">Where a capability has a self-serve product, go straight to signup or trial — your snapshot comes with you.</p>
      ${trialCta}
    </div>
  </div>`;
}

/* route === 'self_serve' — the state variant at the bottom of W5: a
   dominant navy hero replaces the three-card row entirely; demo and
   consultative collapse to quiet text links. */
function heroHTML(vm) {
  const { primarySolution, session, route } = vm;
  const trial = productLinkHTML(primarySolution, session, route, 'Start your free trial →', 'btn btn--gold pathhero__cta');
  return `
    <div class="pathhero">
      <div class="pathhero__text">
        <h2 class="pathhero__title">You can start right now — <span class="accent">no meeting needed.</span></h2>
        <p class="pathhero__sub">Your account starts with your snapshot already loaded. Free to try; upgrade when it earns it.</p>
      </div>
      <div class="pathhero__act">
        ${trial}
        <button type="button" class="pathhero__walk" data-cta="expert">Prefer a walkthrough? Book a demo</button>
      </div>
    </div>
    <div class="pathcollapse">
      <button type="button" class="pathcollapse__link" data-cta="session">Or talk it through with Stagwell instead</button>
    </div>`;
}

/* route === 'follow_up' — routing.json: "Snapshot by email + light
   follow-up; no meeting push." A quiet card stands where the recommended
   column would be; the other two paths collapse to text links. */
function followUpHTML() {
  return `
    <div class="pathquiet">
      <p class="pathquiet__eyebrow">WE'LL TAKE IT FROM HERE</p>
      <h3>No meeting needed — the report's on its way</h3>
      <p>Your snapshot goes out by email, and we'll follow up if it makes sense. No calendar invite required.</p>
      <a class="pathquiet__link" href="/">Ask something else</a>
    </div>
    <div class="pathcollapse">
      <button type="button" class="pathcollapse__link" data-cta="session">Prefer to talk it through? Book a working session</button>
      <button type="button" class="pathcollapse__link" data-cta="expert">Or see a demo of one capability</button>
    </div>`;
}

function continueSectionHTML(vm) {
  if (vm.route === 'self_serve') return heroHTML(vm);
  if (vm.route === 'follow_up') return followUpHTML(vm);
  return threeColumnsHTML(vm);
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
        <div class="pathcards">${vm.matched.map(cardHTML).join('')}</div>
      </div>` : ''}

      <div class="path__section">
        <p class="path__label">CHOOSE HOW TO CONTINUE</p>
        ${continueSectionHTML(vm)}
      </div>

      <div class="pathfoot">
        <p class="pathfoot__lede">Prefer to read first? Deeper education continues on the product sites.</p>
        <div class="pathfoot__links">
          ${footerWorkspaceHTML(vm.session)}
          <button type="button" class="pathfoot__link" data-cta="callback">Let the machine call you</button>
          ${productLinkHTML(vm.primarySolution, vm.session, vm.route, 'Explore the product site →', 'pathfoot__link pathfoot__link--arrow')}
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
  if (!decision) decision = { route: 'follow_up', primaryDomain: null, tier: null, matched: [], override: null, cellNote: null };

  const vm = buildViewModel(session, decision);
  hideRestOfPage();
  const el = ensureSection();
  el.innerHTML = sectionHTML(vm);
  el.hidden = false;
  mounted = true;

  wireLinks(el, session);

  try { history.pushState({}, '', '/path'); } catch (e) { /* fine, still works without a real route */ }

  requestAnimationFrame(() => el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }));
}

window.addEventListener('popstate', () => {
  if (location.pathname === '/path') return;
  if (!mounted) return;
  teardown();
});

window.SAIPATH = { show };

})();
