/* ═══════════════════════════════════════════════════════════════════════════
   SOLUTION.JS — the internal solution landing (/s/:solution), served by
   machine/solution.html.

   Why it exists — the client, looking at "Find your solution":
     "rework this, don't make it repetitive, add the brand assets, and have
      each of these link to a landing page within stagwell.ai."

   The directory's cards used to hand the visitor straight out to a third
   party's marketing site. They now land here instead: one page per
   data/solutions.json entry, rendered from that entry alone, whose real job
   is to turn a browse back into a conversation. Every product word on this
   page comes from data/solutions.json and every problem label from
   data/routing.json — nothing is written in this file.

   Page shape:
     · lockup band (the product's own mark on the deck navy, path.css's
       .pathband idiom) — or the name set in type where there is no lockup
     · name, the full positioning, who it's for
     · THE AGENT PANEL — the conversation, right here (see below)
     · PROBLEMS IT SOLVES — the routing.json domains that resolve to this
       solution, each a button that opens the qualification in that panel,
       seeded with the problem the visitor picked
     · what it does for you — valueProps as pills
     · "Teams solving this also ask about…" — companions, each linking to
       that companion's own /s/{id}
     · CTA row: the real trial where one exists, and the product's own site
       (secondary, attributed, external)

   ── THE CONVERSATION HAPPENS HERE (client, Sept 1) ────────────────────────
     "instead of asking the agent and it taking you to a different site, just
      have the agent text here and have the user ask questions and explain
      what is this product and try and collect the users info and get them to
      answer the questions and make them a report, we want to bring them back
      to the regular flow."

   Until now every internal door on this page was a link to
   /?autostart=1&q={label} — it left the page, and the visitor lost the
   product they were reading. Nothing on this page navigates for that reason
   any more. machine/product-chat.js mounts one panel that answers questions
   about THIS product (api/ask.js mode 'product', which resolves the id
   server-side so no product fact ever leaves this page), then hands the
   visitor to window.SAIFLOW's ordinary six questions in the same panel, and
   ends on window.SAISNAP — the same snapshot, the same capture band, the
   same /path afterwards as every other surface. The only navigation left on
   this page is outward: a companion's page, the product's own site, the real
   trial. Those are all attributed and all deliberate.

   HONESTY — the same rule the rest of the kit keeps. These are real
   third-party products: a `url` of null gets the disabled
   [PRODUCT SITE — pending] placeholder, never an enabled button, and the
   prototype footnote stays at the foot of every solution.

   ── THE CAMPAIGN MAPPING (the one place it is documented) ────────────────
   Two solutions.json ids already have a RICHER landing page of their own,
   built by machine/campaign.js from data/products.json — proof figures,
   screenshots, quotes, partners. Building a second, thinner page for them
   would be a duplicate that reads worse than the one we have, so /s/{id}
   for those two redirects (location.replace, so Back still works) to the
   campaign landing, and machine/directory.js links its cards straight
   there rather than bouncing through this file.

     solutions.json id   →   campaign landing
     ─────────────────────────────────────────
     targeting_machine   →   /p/targeting-machine
     machines_family     →   /p/the-machine

   machine/directory.js mirrors this table; it is deliberately short, and
   this comment is the source of truth for what belongs in it.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const root = document.getElementById('solutionRoot');
  if (!root) return;

  const CAMPAIGN_PAGES = {
    targeting_machine: '/p/targeting-machine',
    machines_family: '/p/the-machine'
  };

  /* GEOPulse carries companions:["all"] — "D: universal companion" in its own
     shownWhen, a statement about GEOPulse rather than a set of ids. Same
     handling and same stand-ins as machine/path.js's surface D, so the two
     surfaces name the same two products. */
  const COMPANIONS_ALL_FALLBACK = ['questbrand', 'knowledge_machine'];
  const COMPANIONS_MAX = 3;

  /* Where a product's self-serve door sits on ANOTHER product's platform, the
     button says so under itself — the same note, keyed the same way, as
     machine/path.js's SIGNUP_NOTES. */
  const SIGNUP_NOTES = { smb_platform: 'Runs on the IMAI platform' };

  /* One solutions.json entry answers no routing.json domain at all (Unlock is
     "a supporting role by design"). Its page still needs a sensible thing to
     ask the agent, and its own shownWhen says what that is. */
  const ASK_FALLBACK = {
    unlock: 'Where does the sample behind your research come from?'
  };

  /* ── helpers ──────────────────────────────────────────────────────────── */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
  const arr = v => (Array.isArray(v) ? v : []);
  const has = v => !!(v && String(v).trim());

  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ''); }

  function resolveSolutionId() {
    let m;
    try { m = /^\/s\/([a-z0-9_-]+)/i.exec(window.location.pathname || ''); }
    catch (e) { m = null; }
    if (m) return m[1];

    /* dev/test door: machine/solution.html?s={id} reaches the same page with
       no vercel rewrite in front of it */
    try {
      const p = new URLSearchParams(window.location.search || '');
      const s = (p.get('s') || '').trim();
      if (s) return s;
    } catch (e) { /* falls through */ }
    return '';
  }

  /* Every internal door on this page is now a button that talks to the panel
     rather than a link that leaves. One attribute, read by one delegated
     listener (wirePanelEntries) — data-solask carries the seed the flow
     should open on, which is the problem label the visitor actually picked. */
  function askAttr(q) {
    const text = String(q == null ? '' : q).trim();
    return `data-solask="${esc(text)}"`;
  }

  /* the external product site keeps its own attribution, distinct from the
     directory's and from routing's, so the three are countable apart */
  function withUtm(url) {
    const sep = String(url).indexOf('?') === -1 ? '?' : '&';
    return `${url}${sep}utm_source=stagwell-ai&utm_medium=solution-page`;
  }

  function hrefFor(id) {
    return CAMPAIGN_PAGES[id] || `/s/${encodeURIComponent(id)}`;
  }

  /* ── domain → solution resolution ─────────────────────────────────────────
     The same mapping machine/directory.js and machine/path.js use, read the
     other way round: given a solution, which routing.json domains land on it.
     Kept local so this file depends on no other script's load order. */
  function domainSolutionIds(domain, list) {
    if (!domain || !domain.solution) return [];
    if (domain.id === 'influencer') return ['smb_platform', 'imai'].filter(id => list.some(s => s.id === id));
    if (domain.id === 'marketing_ops') return list.some(s => s.id === 'machines_family') ? ['machines_family'] : [];
    const target = norm(domain.solution);
    if (!target) return [];
    let hit = list.find(s => norm(s.name) === target);
    if (!hit) hit = list.find(s => target.indexOf(norm(s.name)) !== -1 || norm(s.name).indexOf(target) !== -1);
    return hit ? [hit.id] : [];
  }

  function domainsFor(id, domains, list) {
    return domains.filter(d => domainSolutionIds(d, list).indexOf(id) !== -1);
  }

  function companionIds(solution) {
    const raw = arr(solution.companions).map(String);
    const real = raw.filter(x => x && x !== 'all');
    const all = raw.indexOf('all') === -1
      ? real
      : real.concat(COMPANIONS_ALL_FALLBACK.filter(x => real.indexOf(x) === -1));
    return all.filter(x => x !== solution.id).slice(0, COMPANIONS_MAX);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     SECTION BUILDERS — each returns '' when the entry has nothing for it, so
     a thinner solution produces a shorter page rather than an empty frame.
     ═══════════════════════════════════════════════════════════════════════ */

  /* the lockup band: machine/path.css's .pathband idiom, restated here at
     page scale. solutions.json has one entry with no lockup in the deck at
     all (Unlock) — the band still carries the credit, set as a wordmark,
     rather than showing a broken image or collapsing for that one product. */
  function bandHtml(s) {
    if (has(s.lockup)) {
      return `<div class="solband"><img class="solband__lockup" src="${esc(s.lockup)}"
        alt="${esc(s.name)}" decoding="async"></div>`;
    }
    return `<div class="solband"><span class="solband__word">${esc(s.name)}</span></div>`;
  }

  function problemsHtml(s, domains) {
    if (!domains.length) {
      /* Unlock: no domain routes here, and its own shownWhen says why */
      return `<section class="solsec" aria-labelledby="probH">
          <h2 class="solsec__h" id="probH">Problems it solves</h2>
          <p class="solsec__note">${esc(s.name)} is a supporting layer rather than a starting problem — it sits under our research offerings. Ask the agent what you're trying to learn and it will say where ${esc(s.name)} comes in.</p>
          <button class="sollink" type="button" ${askAttr(ASK_FALLBACK[s.id] || s.name)}>Start that conversation &rarr;</button>
        </section>`;
    }
    const items = domains.map(d => `
      <li><button class="solproblem" type="button" ${askAttr(d.label)} data-domain="${esc(d.id)}">
        <span class="solproblem__t">${esc(d.label)}</span>
        <span class="solproblem__go" aria-hidden="true">&rarr;</span>
      </button></li>`).join('');
    return `<section class="solsec" aria-labelledby="probH">
        <h2 class="solsec__h" id="probH">Problems it solves</h2>
        <p class="solsec__lede">Pick the one that sounds like yours — the agent opens on it in the conversation above and takes it from there.</p>
        <ul class="solproblems">${items}</ul>
      </section>`;
  }

  function valueHtml(s) {
    const props = arr(s.valueProps).filter(has);
    if (!props.length) return '';
    return `<section class="solsec" aria-labelledby="valH">
        <h2 class="solsec__h" id="valH">What it does for you</h2>
        <ul class="solpills">${props.map((p, i) => `
          <li class="solpill"><span class="solpill__n">${String(i + 1).padStart(2, '0')}</span>${esc(p)}</li>`).join('')}</ul>
      </section>`;
  }

  function companionsHtml(s, list) {
    const ids = companionIds(s);
    const cards = ids.map(id => list.find(x => x && x.id === id)).filter(Boolean).map(c => `
      <li><a class="solcomp" href="${esc(hrefFor(c.id))}">
        ${has(c.lockup)
          ? `<span class="solcomp__mark"><img src="${esc(c.lockup)}" alt="${esc(c.name)}" loading="lazy" decoding="async"></span>`
          : `<span class="solcomp__mark solcomp__mark--word">${esc(c.name)}</span>`}
        <span class="solcomp__b">
          <b class="solcomp__n">${esc(c.name)}</b>
          <i class="solcomp__w">${esc(c.whoFor || '')}</i>
        </span>
        <span class="solcomp__go" aria-hidden="true">&rarr;</span>
      </a></li>`).join('');
    if (!cards) return '';
    return `<section class="solsec" aria-labelledby="compH">
        <h2 class="solsec__h" id="compH">Teams solving this also ask about&hellip;</h2>
        <ul class="solcomps">${cards}</ul>
      </section>`;
  }

  /* the CTA row. The agent used to be the first of three doors here and the
     only internal one; it is not a door any more, it is the panel directly
     underneath. What is left is the two OUTWARD doors, which are the two that
     were always meant to leave:
       1 the real trial, where solutions.json carries a signupUrl
       2 the product's own site — external, attributed, or the kit's
         disabled placeholder where there is no site to send anyone to.
     The placeholder is deliberately NOT a button: the bug machine/path.js
     documents ("[PRODUCT SITE — PENDING]" set inside an enabled marigold
     button) cannot recur on this page either. */
  function ctaHtml(s) {
    const trial = has(s.signupUrl)
      ? `<a class="btn btn--dark solcta__trial" href="${esc(withUtm(s.signupUrl))}"
           target="_blank" rel="noopener"
           data-sol-handoff data-solution="${esc(s.id)}" data-url="${esc(s.signupUrl)}">Start your free trial &rarr;</a>`
      : '';

    const site = has(s.url)
      ? `<a class="sitelink" href="${esc(withUtm(s.url))}" target="_blank" rel="noopener"
           data-sol-handoff data-solution="${esc(s.id)}" data-url="${esc(s.url)}">Visit the ${esc(s.name)} site &rarr;</a>`
      : `<span class="sitelink sitelink--disabled" aria-disabled="true">[PRODUCT SITE &mdash; pending]</span>`;

    const note = has(s.signupUrl) && SIGNUP_NOTES[s.id]
      ? `<p class="solcta__note">${esc(SIGNUP_NOTES[s.id])}</p>` : '';

    return `<div class="solcta">
        ${trial ? `<div class="solcta__row">${trial}</div>` : ''}
        ${note}
        ${site}
      </div>`;
  }

  /* ── not-found state — matches machine/campaign.js's card ─────────────── */
  function renderNotFound(id) {
    document.title = 'Solution not found — Stagwell.AI';
    root.innerHTML = `
      <section class="solNF">
        <p class="eyebrow"><i class="pulse"></i>Stagwell.AI</p>
        <h1 class="display">Solution not found</h1>
        <p class="solNF__sub">We don't have a solution page for &ldquo;${esc(id || '')}&rdquo;. Head back to the main site and tell the agent what you're trying to solve instead.</p>
        <a class="btn btn--dark" href="/">Go to Stagwell.AI &rarr;</a>
      </section>`;
  }

  /* ── the page ─────────────────────────────────────────────────────────── */
  function renderSolution(s, domains, list) {
    document.title = `${s.name} — Stagwell.AI`;
    const descMeta = document.getElementById('pageDesc');
    if (descMeta) descMeta.setAttribute('content', s.positioning || `${s.name} — Stagwell.AI`);

    root.innerHTML = `
      <section class="sol">
        <div class="sol__in">
          <a class="sol__back" href="/#solutions">&larr; All solutions</a>
          ${bandHtml(s)}
          <p class="eyebrow sol__kicker"><i class="pulse"></i>The Stagwell Marketing Cloud</p>
          <h1 class="sol__h1">${esc(s.name)}</h1>
          ${has(s.positioning) ? `<p class="sol__pos">${esc(s.positioning)}</p>` : ''}
          ${has(s.whoFor) ? `<p class="sol__who"><span class="sol__wholab">Who it's for</span>${esc(s.whoFor)}</p>` : ''}
          ${ctaHtml(s)}
          <div class="solconvo__host" id="solConvoHost"><!-- product-chat.js mounts the panel here --></div>
        </div>
      </section>

      <div class="solbody">
        <div class="solbody__in">
          ${problemsHtml(s, domains)}
          ${valueHtml(s)}
          ${companionsHtml(s, list)}
        </div>
      </div>

      <section class="band">
        <div class="band__in">
          <h2 class="band__h">One of ten AI products. <span class="accent">The agent finds your fit.</span></h2>
          <div class="band__acts">
            <button class="btn btn--gold" type="button" ${askAttr(domains.length ? domains[0].label : (ASK_FALLBACK[s.id] || s.name))}>Ask the agent</button>
            <button class="btn btn--ghost-void" type="button" data-cta="expert">Talk to an AI expert</button>
          </div>
        </div>
      </section>

      <p class="solfoot">This is a working prototype of Stagwell.AI, not a live product page. ${
        esc(s.name)} is a third-party product: its name, marks and positioning belong to their owners and are reproduced here from published material. Everything the agent says about ${esc(s.name)} is drawn from that same material.</p>`;

    wireHandoffs();
    mountPanel(s, domains);
    wirePanelEntries();
  }

  /* ── the panel ────────────────────────────────────────────────────────────
     product-chat.js owns the conversation; this file owns where it sits and
     which of the page's own controls hand it a seed. If product-chat.js
     failed to load, the page keeps every other section and the [data-solask]
     controls fall back to the old handoff — the visitor still reaches the
     agent, just on "/" as they did before. */
  function mountPanel(s, domains) {
    const host = document.getElementById('solConvoHost');
    if (!host) return;
    if (window.SAIPRODUCT && typeof window.SAIPRODUCT.mount === 'function') {
      window.SAIPRODUCT.mount({ host, solution: s, domains });
    }
  }

  function wirePanelEntries() {
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-solask]');
      if (!b) return;
      e.preventDefault();
      const seed = b.getAttribute('data-solask') || '';
      const P = window.SAIPRODUCT;
      if (P && typeof P.startFlow === 'function') { P.startFlow(seed); return; }
      /* no panel — the pre-panel behaviour, so this never dead-ends */
      window.location.href = `/?autostart=1${seed ? `&q=${encodeURIComponent(seed)}` : ''}`;
    });
  }

  /* the directory's card used to be the handoff to a product site; that
     handoff lives here now, and says so — route:'solution-page'. Existing
     event type, existing payload shape (machine/directory.js, machine/path.js). */
  function wireHandoffs() {
    Array.from(root.querySelectorAll('[data-sol-handoff]')).forEach(a => {
      a.addEventListener('click', () => {
        try {
          const S = window.SAI;
          if (S && S.events && typeof S.events.emit === 'function') {
            S.events.emit('handoff_click', {
              solution: a.dataset.solution || null,
              url: a.dataset.url || null,
              route: 'solution-page'
            });
          }
        } catch (e) { /* the tab still opens without the log line */ }
      });
    });
  }

  /* ── chrome shared with the rest of the site (see machine/campaign.js) ── */
  function wireChrome() {
    const navMenu = document.getElementById('navMenu');
    const navScrim = document.getElementById('navScrim');
    const mnavClose = document.getElementById('mnavClose');
    const closeNav = () => document.body.classList.remove('nav-open');
    if (navMenu) navMenu.addEventListener('click', () => document.body.classList.toggle('nav-open'));
    if (navScrim) navScrim.addEventListener('click', closeNav);
    if (mnavClose) mnavClose.addEventListener('click', closeNav);

    document.addEventListener('click', e => {
      const b = e.target.closest('[data-cta]');
      if (!b || b.tagName === 'FORM') return;
      e.preventDefault();
      closeNav();
      if (window.SAILEAD && typeof window.SAILEAD.open === 'function') {
        window.SAILEAD.open(b.dataset.cta || 'expert');
        return;
      }
      window.location.href = '/#cta';
    });
  }

  /* ── boot ─────────────────────────────────────────────────────────────── */
  function boot(data) {
    const list = (data && data.solutions && Array.isArray(data.solutions.solutions))
      ? data.solutions.solutions : [];
    const domains = (data && data.routing && Array.isArray(data.routing.domains))
      ? data.routing.domains : [];

    const id = resolveSolutionId();
    const s = list.find(x => x && x.id === id);
    if (!s) { renderNotFound(id); return; }

    renderSolution(s, domainsFor(s.id, domains, list), list);
  }

  wireChrome();

  /* The redirect runs BEFORE any data is fetched: a visitor whose card points
     at a campaign landing should never see this page paint first. */
  const early = resolveSolutionId();
  if (CAMPAIGN_PAGES[early]) {
    window.location.replace(CAMPAIGN_PAGES[early]);
    return;
  }

  if (window.STAGDATA && typeof window.STAGDATA.then === 'function') {
    window.STAGDATA.then(boot).catch(() => renderNotFound(early));
  } else {
    /* data-loader.js failed to load entirely — fetch directly rather than blank the page */
    const grab = name => fetch(`/data/${name}.json`).then(r => (r.ok ? r.json() : null)).catch(() => null);
    Promise.all([grab('solutions'), grab('routing')])
      .then(([solutions, routing]) => boot({ solutions, routing }))
      .catch(() => renderNotFound(early));
  }
})();
