/* ═══════════════════════════════════════════════════════════════════════════
   /products — every product in the Marketing Cloud, on a page of its own.

   The client, pointing at the "See every product" card: "instead of a
   sidebar with the companies, i want to see a dedicated page that showcases
   all the companies." So the slide-over is retired as a destination (see
   machine/directory.js, now a redirect) and this is where every "Find your
   solution" link lands.

   WHAT IT INHERITS FROM THE PANEL, deliberately unchanged, because the
   decisions behind them were the client's:

     · GROUPED BY PROBLEM, in routing.json's own order — not by company. The
       group heading is the domain's own label.
     · NO TWO CARDS READ ALIKE. A product that answers two problems is written
       twice from solutions.json's positioningByDomain, and the second card
       says so, naming the group it was first listed under.
     · A GROUP OF ONLY REPEATS SINKS to the foot of the page.
     · IMAI LEADS its group, the SMB packaging under it.
     · EVERY CARD IS AN INTERNAL DOOR — /s/{id}, or the richer /p/{campaign}
       landing for the two ids that have one. handoff_click still records it.

   WHAT THE PAGE ADDS, having room the panel did not:

     · a hero that says what the suite covers and what to do next,
     · each product's value props as pills,
     · a contents rail of the problems, so a long page is navigable,
     · and a closing band with the two asks — book a demo, talk to an expert.

   Reads window.STAGDATA (data-loader.js) and window.SAI (engine.js); with
   neither it renders the honest pending state rather than throwing.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const root = document.getElementById('productsRoot');
  if (!root) return;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

  /* solutions.json positioning runs several sentences; a card wants the
     first — but a couple of entries open on a very short beat ("Your data."),
     so short openers borrow the next sentence too. Same rule as the panel's
     and path.js's, so the same product reads the same everywhere. */
  function firstSentences(text) {
    const t = String(text || '').trim();
    if (!t) return '';
    const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean);
    let out = parts[0] || t;
    let i = 1;
    while (out.length < 40 && i < parts.length) { out += ' ' + parts[i]; i++; }
    return out;
  }

  /* ── domain → solution(s) ─────────────────────────────────────────────────
     The mapping the rest of the site uses (path.js resolveSolution), except
     influencer is not tier-narrowed: this page has no session context, so
     both products show, each labelled with the audience that picks it. */
  function resolveDomain(domain, list) {
    try {
      if (!domain || !domain.solution) return [];
      if (domain.id === 'influencer') {
        const out = [];
        const ent = list.find(s => s.id === 'imai');
        const smb = list.find(s => s.id === 'smb_platform');
        if (ent) out.push({ solution: ent, fit: '100+ creators' });
        if (smb) out.push({ solution: smb, fit: 'small teams' });
        return out;
      }
      if (domain.id === 'marketing_ops') {
        const hit = list.find(s => s.id === 'machines_family');
        return hit ? [{ solution: hit, fit: null }] : [];
      }
      const target = norm(domain.solution);
      if (!target) return [];
      let hit = list.find(s => norm(s.name) === target);
      if (!hit) hit = list.find(s => target.indexOf(norm(s.name)) !== -1 || norm(s.name).indexOf(target) !== -1);
      return hit ? [{ solution: hit, fit: null }] : [];
    } catch (e) { return []; }
  }

  /* Mirrors CAMPAIGN_PAGES in machine/solution.js — that file's header is the
     source of truth for what belongs here and why. */
  const CAMPAIGN_PAGES = {
    targeting_machine: '/next/p/targeting-machine',
    machines_family: '/next/p/the-machine',
    newvoices: '/next/p/newvoices',
    agent_cloud: '/next/p/agent-cloud'
  };
  const internalHref = id => CAMPAIGN_PAGES[id] || '/next/s/' + encodeURIComponent(id);

  /* The lockup plate is gone (client, 2026-09-09): the marks were a 36px navy
     tile with a contained PNG inside it, and at that size none of them could
     actually be read. A card leads with the product's name instead. markHTML
     is kept for the day real marks arrive at a size that works. */
  function markHTML(s) {
    if (s.lockup) {
      return `<span class="prodcard__mark"><img src="${esc(s.lockup)}" alt="${esc(s.name)}"
        loading="lazy" decoding="async"></span>`;
    }
    return `<span class="prodcard__mark prodcard__mark--word">${esc(s.name)}</span>`;
  }

  /* ── the picture on each card ──
     The same still the homepage gives that company, so a product reads the
     same on both pages (client, 2026-09-09). Keyed by solutions.json's id;
     the three that have no company card of their own take a neutral brand
     still rather than nothing, which would leave a ragged grid. */
  const PICTURE = {
    questbrand: '/assets/img/questbrand.jpg',
    questdiy: '/assets/img/hero-slide-4.jpg',
    bera: '/assets/img/brand-growth.jpg',
    unlock: '/assets/img/hero-slide-3.jpg',
    knowledge_machine: '/assets/img/hero-slide-1.jpg',
    unicepta: '/assets/img/newspaper.jpg',
    imai: '/assets/img/imai.jpg',
    geopulse: '/assets/img/geopulse.jpg',
    targeting_machine: '/assets/img/targeting.jpg',
    numetrix: '/assets/img/numetrix.jpg',
    newvoices: '/assets/img/newvoices.jpg',
    smb_platform: '/assets/img/crosswalk.jpg',
    machines_family: '/assets/img/solutions-guided.jpg',
    agent_cloud: '/assets/img/hero-slide-5.jpg'
  };
  /* the still sits INSIDE the card, beside the name and the line — small.
     It was a full-width band in the card (too much room), then a 4:3 block in
     the left column (still too much); a thumbnail next to the words is what
     the client asked for (2026-09-09). */
  function pictureHTML(s) {
    const src = s && s.id && PICTURE[s.id];
    if (!src) return '';
    return `<div class="prodcard__pic"><img src="${esc(src)}" alt="" loading="lazy" decoding="async"></div>`;
  }

  const PILLS = 4;
  function pillsHTML(s) {
    const props = (Array.isArray(s.valueProps) ? s.valueProps : []).filter(Boolean).slice(0, PILLS);
    if (!props.length) return '';
    return `<ul class="prodcard__pills">${
      props.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`;
  }

  function pendingCardHTML() {
    return `<article class="prodcard prodcard--pending"><h3>[SOLUTION — pending]</h3></article>`;
  }

  function cardHTML(entry) {
    if (!entry || !entry.solution) return pendingCardHTML();
    const s = entry.solution;
    const body = entry.line || firstSentences(s.positioning);
    const fit = entry.fit ? ` <span class="prodcard__fit">(${esc(entry.fit)})</span>` : '';
    const again = entry.repeatOf
      ? `<p class="prodcard__again">Also solves this &middot; first listed under &ldquo;${esc(entry.repeatOf)}&rdquo;</p>`
      : '';
    const href = internalHref(s.id);
    return `
      <article class="prodcard${entry.repeatOf ? ' prodcard--again' : ''}">
        ${again}
        <div class="prodcard__top">
          ${pictureHTML(s)}
          <div class="prodcard__head">
            <h3 class="prodcard__name">${esc(s.name)}${fit}</h3>
            <p class="prodcard__pos">${esc(body)}</p>
          </div>
        </div>
        ${s.whoFor ? `<p class="prodcard__who">Who it's for: ${esc(s.whoFor)}</p>` : ''}
        ${pillsHTML(s)}
        <a class="prodcard__link" href="${esc(href)}"
           data-prod-handoff data-solution="${esc(s.id)}" data-url="${esc(href)}">Explore</a>
      </article>`;
  }

  function groupHTML(domain, entries, index) {
    const cards = entries.length ? entries.map(cardHTML).join('') : pendingCardHTML();
    return `
      <section class="prodgroup" id="p-${esc(domain.id)}">
        <header class="prodgroup__head">
          <p class="prodgroup__n">${String(index + 1).padStart(2, '0')}</p>
          <h2 class="prodgroup__h">${esc(domain.label)}</h2>
        </header>
        <div class="prodgroup__cards">${cards}</div>
      </section>`;
  }

  /* one pass over routing.json's groups, remembering which products have
     already appeared and under which label */
  function buildGroups(data) {
    const routing = data && data.routing;
    const solutions = data && data.solutions;
    const domains = (routing && Array.isArray(routing.domains)) ? routing.domains : [];
    const list = (solutions && Array.isArray(solutions.solutions)) ? solutions.solutions : [];
    if (!domains.length) return null;

    const seen = Object.create(null);
    const built = domains.map(d => {
      const entries = resolveDomain(d, list).map(entry => {
        const s = entry.solution;
        const byDomain = s && s.positioningByDomain && s.positioningByDomain[d.id];
        const out = {
          solution: s,
          fit: entry.fit,
          line: byDomain ? String(byDomain) : null,
          repeatOf: (s && seen[s.id]) || null
        };
        if (s && s.id && !seen[s.id]) seen[s.id] = d.label;
        return out;
      });
      const allRepeats = entries.length > 0 && entries.every(e => e.repeatOf);
      return { domain: d, entries, allRepeats };
    });

    /* a group whose every card is a product already listed above sinks to the
       foot: the same product twice running reads as a mistake, however
       differently the two cards are written */
    const ordered = built.filter(g => !g.allRepeats).concat(built.filter(g => g.allRepeats));
    return { ordered };
  }


  function contentsHTML(ordered) {
    return `<nav class="prodtoc" aria-label="Problems">
      ${ordered.map(g => `<a href="#p-${esc(g.domain.id)}">${esc(g.domain.label)}</a>`).join('')}
    </nav>`;
  }

  function pageHTML(model) {
    return `
      <section class="prodhero">
        <div class="prodhero__in">
          <p class="eyebrow prodhero__eyebrow"><i class="pulse"></i>THE STAGWELL MARKETING CLOUD</p>
          <h1 class="display prodhero__title">Every product in the suite, <span class="accent">grouped by the problem it solves.</span></h1>
          <p class="prodhero__sub">Brand tracking, competitive benchmarking, consumer research, creator programs,
            AI-search visibility, reputation monitoring, audience activation and voice agents — each built by a team
            that does this and nothing else. Start with the problem; the product follows.</p>
          <div class="prodhero__acts">
            <a class="btn btn--gold prodhero__cta" href="/next">Find my fit in a conversation</a>
            <button class="btn btn--ghost prodhero__alt" type="button" data-cta="demo">Book a demo</button>
          </div>
        </div>
      </section>

      ${model ? contentsHTML(model.ordered) : ''}

      <div class="prodbody">
        ${model
          ? model.ordered.map((g, i) => groupHTML(g.domain, g.entries, i)).join('')
          : `<p class="prodbody__note">[DIRECTORY — pending]</p>`}
      </div>

      <section class="prodband">
        <div class="prodband__in">
          <h2>Not sure which one you need? <span class="accent">That is the normal case.</span></h2>
          <p>Tell the agent what you are up against and it reads your brand first — then names the products that
            actually fit, and the people who run them.</p>
          <div class="prodband__acts">
            <button class="btn btn--gold prodband__demo" type="button" data-cta="demo">Book a demo</button>
            <a class="btn btn--light" href="/next">Start with the agent</a>
          </div>
        </div>
      </section>

      <p class="prodfoot">This is a working prototype of Stagwell AI, not a live product page. Every product named
        here is a third-party product: its name, marks and positioning belong to its owners and are reproduced
        from published material. Nothing on this page is a Stagwell AI measurement.</p>`;
  }

  /* ── handoffs ──
     Same event the panel emitted, same route name, so a run that goes through
     this page is counted the way the demo script expects. */
  function wire() {
    root.addEventListener('click', e => {
      const a = e.target.closest('[data-prod-handoff]');
      if (!a) return;
      try {
        if (window.SAI && window.SAI.events) {
          window.SAI.events.emit('handoff_click', {
            solution: a.getAttribute('data-solution') || null,
            url: a.getAttribute('data-url') || null,
            route: 'directory'
          });
        }
      } catch (err) { /* a dead bus must never eat the click */ }
    });
  }

  function render(data) {
    root.innerHTML = pageHTML(buildGroups(data));
    wire();
    /* a deep link from another surface — /products#p-influencer */
    if (window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
    }
  }

  const DATA = (typeof window !== 'undefined' && window.STAGDATA) || null;
  if (DATA && typeof DATA.then === 'function') DATA.then(render, () => render(null));
  else render(DATA);
})();
