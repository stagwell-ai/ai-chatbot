/* ═══════════════════════════════════════════════════════════════════════════
   S6 · SAIDIR — the solutions directory panel ("Find your solution").

   Surface A per data/solutions.json: "Always available under 'Find your
   solution' — card = positioning line + who it's for, grouped by problem,
   not by company." A right-side slide-over so the homepage's below-the-fold
   sections stay untouched, opened from any `<a href="#solutions">` link.

   Self-contained: reads window.STAGDATA (data-loader.js) and window.SAI
   (engine.js) if present, but degrades to an empty shell rather than
   throwing if either is missing. Injects its own DOM on first open and
   never touches #cloud / #cta or any other homepage markup.

   ── THE SPRINT'S REWORK ──────────────────────────────────────────────────
   The client, pointing at this panel: "rework this, don't make it
   repetitive, add the brand assets, and have each of these link to a
   landing page within stagwell.ai." Three answers, all here:

   1 REPETITION. The panel groups by problem, so one product can answer two
     of them — QuestBrand is both "Track brand health and campaign impact"
     and "Track competitors and benchmark against them". Both cards used to
     be byte-identical, which reads like a bug rather than a fact. A card's
     line now comes from solutions.json's `positioningByDomain[domain]`
     where the entry has one, falling back to the general positioning; and
     the SECOND appearance of a product says so, quietly, naming the group
     it was first listed under. No two cards in the panel read alike.

   2 BRAND. Every card carries the product's own lockup on a small plate of
     the deck navy the lockups were normalised onto — one size for all of
     them, contained, never stretched. The one entry with no lockup (Unlock)
     gets its name set in type on the same plate.

   3 INTERNAL LINKS. A card's action is no longer an exit to a third party's
     marketing site: it is /s/{id}, the internal solution page, except for
     the two ids that already have a richer campaign landing (see
     CAMPAIGN_PAGES below). The external product site still exists — it now
     lives on the solution page, where there is room to attribute it. The
     handoff_click emit stays, route:'directory', now recording the internal
     destination the card actually goes to.

   window.SAIDIR: .open() / .close() / .toggle()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function eng() { return (typeof window !== 'undefined' && window.SAI) || null; }

  /* ── copy helpers (mirrors path.js's own — kept local so this file has no
     dependency on path.js, which an Opus agent is editing in parallel) ── */
  function firstSentences(text) {
    const t = String(text || '').trim();
    if (!t) return '';
    const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean);
    let out = parts[0] || t;
    let i = 1;
    while (out.length < 40 && i < parts.length) { out += ' ' + parts[i]; i++; }
    return out;
  }

  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }

  /* ── domain → solution(s) resolution ──────────────────────────────────────
     Same mapping the rest of the site uses (see path.js's resolveSolution),
     except influencer is NOT tier-narrowed here: the directory is always
     available with no session/tier context, so both products show, each
     labelled with the audience that picks it. Unresolved → []; the caller
     renders a pending placeholder rather than skipping the group. */
  function resolveDomain(domain, list) {
    try {
      if (!domain || !domain.solution) return [];
      /* IMAI leads this group: it is the full platform, and the SMB packaging
         of it is the lighter alternative underneath. */
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

  /* ── where a card goes ────────────────────────────────────────────────────
     Every card is now an internal door. Two solutions.json ids already have
     a RICHER landing built by machine/campaign.js from data/products.json,
     so their cards go straight there rather than through a thinner /s/ page
     that would only redirect. This table mirrors CAMPAIGN_PAGES in
     machine/solution.js — that file's header block is the source of truth
     for what belongs in it and why. */
  const CAMPAIGN_PAGES = {
    targeting_machine: '/next-v1/p/targeting-machine',
    machines_family: '/next-v1/p/the-machine'
  };

  function internalHref(id) {
    return CAMPAIGN_PAGES[id] || '/next-v1/s/' + encodeURIComponent(id);
  }

  function pendingCardHTML() {
    return `<article class="dircard dircard--pending"><h3>[SOLUTION — pending]</h3></article>`;
  }

  /* the brand mark: the lockup PNGs are all one normalised 640×200 canvas on
     the ICP deck's navy (#0A1743, the plate colour in directory.css), so a
     fixed plate with a contained image gives every product the same optical
     weight and can never stretch one. Unlock ships no lockup — it gets its
     name set in type on the same plate rather than a broken image. */
  function markHTML(s) {
    if (s.lockup) {
      return `<span class="dircard__mark"><img src="${esc(s.lockup)}" alt="${esc(s.name)}"
        loading="lazy" decoding="async"></span>`;
    }
    return `<span class="dircard__mark dircard__mark--word">${esc(s.name)}</span>`;
  }

  /* entry.repeatOf, when set, is the label of the group this product was
     already listed under. Saying so is the honest treatment: the reader sees
     one product answering two problems, not two products. */
  function cardHTML(entry) {
    if (!entry || !entry.solution) return pendingCardHTML();
    const s = entry.solution;
    /* the per-domain line is authored for THIS problem — it is the whole
       reason two cards for one product can't read alike */
    const body = entry.line || firstSentences(s.positioning);
    const fit = entry.fit ? ` <span class="dircard__fit">(${esc(entry.fit)})</span>` : '';
    const again = entry.repeatOf
      ? `<p class="dircard__again">Also solves this &middot; first listed under &ldquo;${esc(entry.repeatOf)}&rdquo;</p>`
      : '';
    const href = internalHref(s.id);
    return `
      <article class="dircard${entry.repeatOf ? ' dircard--again' : ''}">
        ${again}
        <div class="dircard__id">
          ${markHTML(s)}
          <h3 class="dircard__name">${esc(s.name)}${fit}</h3>
        </div>
        <p class="dircard__pos">${esc(body)}</p>
        <p class="dircard__who">Who it's for: ${esc(s.whoFor || '')}</p>
        <a class="dircard__link" href="${esc(href)}"
           data-dir-handoff data-solution="${esc(s.id)}" data-url="${esc(href)}">See the solution <i aria-hidden="true">&rarr;</i></a>
      </article>`;
  }

  function groupHTML(domain, entries) {
    const cards = entries.length ? entries.map(cardHTML).join('') : pendingCardHTML();
    return `
      <section class="dirgroup">
        <h3 class="dirgroup__h">${esc(domain.label)}</h3>
        <div class="dirgroup__cards">${cards}</div>
      </section>`;
  }

  function panelBodyHTML(data) {
    const routing = data && data.routing;
    const solutions = data && data.solutions;
    const domains = (routing && Array.isArray(routing.domains)) ? routing.domains : [];
    const list = (solutions && Array.isArray(solutions.solutions)) ? solutions.solutions : [];
    if (!domains.length) return `<p class="dir__note">[DIRECTORY — pending]</p>`;

    /* one pass over the groups in routing.json's own order, remembering which
       products have already been shown and under which label */
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
      /* a group every one of whose cards is a product already listed above
         sinks to the foot of the panel: the same product twice in a row reads
         as a mistake, however differently the two cards are written. The group
         itself is kept — the problem is real and the product does answer it —
         it just stops sitting under its own first appearance. */
      const allRepeats = entries.length > 0 && entries.every(e => e.repeatOf);
      return { html: groupHTML(d, entries), allRepeats };
    });
    return built.filter(g => !g.allRepeats).map(g => g.html).join('')
         + built.filter(g =>  g.allRepeats).map(g => g.html).join('');
  }

  /* ─────────────────────────── STATE + DOM ─────────────────────────── */
  let isOpen = false;
  let rendered = false;
  let opener = null;
  let scrimEl = null;
  let panelEl = null;
  let bodyEl = null;
  let closeBtn = null;

  function ensureDOM() {
    if (panelEl) return;

    scrimEl = document.createElement('div');
    scrimEl.className = 'dirscrim';
    scrimEl.setAttribute('aria-hidden', 'true');

    panelEl = document.createElement('aside');
    panelEl.className = 'dirpanel';
    panelEl.setAttribute('aria-hidden', 'true');
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-modal', 'true');
    panelEl.setAttribute('aria-labelledby', 'dirTitle');
    panelEl.innerHTML = `
      <div class="dirpanel__head">
        <div>
          <h2 class="dirpanel__title" id="dirTitle">Find your solution</h2>
          <p class="dirpanel__sub">Grouped by the problem you're solving — every card is the door to one solution.</p>
        </div>
        <button type="button" class="dirpanel__close" id="dirClose" aria-label="Close">
          <svg viewBox="0 0 16 16" width="16" height="16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="dirpanel__body scroll" id="dirBody" tabindex="-1"></div>`;

    document.body.appendChild(scrimEl);
    document.body.appendChild(panelEl);

    bodyEl = $('#dirBody', panelEl);
    closeBtn = $('#dirClose', panelEl);

    scrimEl.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
  }

  function renderIfNeeded() {
    if (rendered) return;
    rendered = true;
    bodyEl.innerHTML = `<p class="dir__note">Loading solutions…</p>`;
    Promise.resolve(window.STAGDATA).then(data => {
      bodyEl.innerHTML = panelBodyHTML(data || {});
      wireCardLinks();
    }).catch(() => {
      bodyEl.innerHTML = `<p class="dir__note">[DIRECTORY — pending]</p>`;
    });
  }

  /* the handoff is internal now, so `url` records the /s/ or /p/ destination
     the card actually goes to — same event type, same payload shape, same
     route:'directory' the analytics already counts. */
  function wireCardLinks() {
    $$('[data-dir-handoff]', bodyEl).forEach(a => {
      a.addEventListener('click', () => {
        try {
          const S = eng();
          if (S && S.events && typeof S.events.emit === 'function') {
            S.events.emit('handoff_click', {
              solution: a.dataset.solution || null,
              url: a.dataset.url || null,
              route: 'directory'
            });
          }
        } catch (e) { /* the page still opens without the log line */ }
      });
    });
  }

  /* ── scroll lock — self-contained, no dependency on the mnav pattern's
     own (page-specific) markup ── */
  let savedOverflow = null;
  function lockScroll() {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  function unlockScroll() {
    document.body.style.overflow = savedOverflow || '';
    savedOverflow = null;
  }

  /* ── focus trap, active only while the panel is open ── */
  function focusables() {
    return $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', panelEl)
      .filter(el => el.offsetParent !== null || el === document.activeElement);
  }
  function onKeydown(e) {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      const items = focusables();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function setHash(on) {
    try {
      const path = window.location.pathname + window.location.search;
      if (on) { if (window.location.hash !== '#solutions') history.replaceState(null, '', path + '#solutions'); }
      else if (window.location.hash === '#solutions') { history.replaceState(null, '', path); }
    } catch (e) { /* history API unavailable — the panel still opens */ }
  }

  function open(trigger) {
    ensureDOM();
    if (isOpen) return;
    isOpen = true;
    opener = (trigger && trigger.nodeType) ? trigger : document.activeElement;
    /* the mobile drawer, if open, sits under the panel at a lower z-index —
       close it too so it isn't left stranded behind the scrim */
    document.body.classList.remove('nav-open');
    renderIfNeeded();
    lockScroll();
    scrimEl.classList.add('is-open');
    panelEl.classList.add('is-open');
    panelEl.setAttribute('aria-hidden', 'false');
    setHash(true);
    document.addEventListener('keydown', onKeydown, true);
    requestAnimationFrame(() => { if (closeBtn) closeBtn.focus(); });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    scrimEl.classList.remove('is-open');
    panelEl.classList.remove('is-open');
    panelEl.setAttribute('aria-hidden', 'true');
    setHash(false);
    document.removeEventListener('keydown', onKeydown, true);
    unlockScroll();
    if (opener && typeof opener.focus === 'function') { try { opener.focus(); } catch (e) { /* opener gone */ } }
    opener = null;
  }

  function toggle(trigger) { if (isOpen) close(); else open(trigger); }

  /* ── THE PANEL IS NO LONGER A DESTINATION ──────────────────────────────
     The client, pointing at "See all ten products": "instead of a sidebar
     with the companies, i want to see a dedicated page that showcases all
     the companies." That page is /products (machine/products.js), which
     inherits this file's grouping, de-duplication and ordering rules
     wholesale — they were the client's calls and none of them changed.

     Every entry point now links straight there. What survives here is the
     legacy `#solutions` contract: an old link, a bookmark or a deep link
     still resolves, by going to the page rather than sliding the panel over
     the one behind it. window.SAIDIR keeps its shape so nothing that calls
     it breaks; open() navigates. ─────────────────────────────────────── */
  const PAGE = '/next-v1/products';
  const goPage = () => { try { window.location.href = PAGE; } catch (e) { /* nothing else to try */ } };

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href="#solutions"]');
    if (!a) return;
    e.preventDefault();
    goPage();
  });

  /* on load, and on a hash change that never reloads the document — an old
     bookmark opens fresh, but `location.hash = 'solutions'` from anything
     still holding the legacy contract is a same-document change, and would
     otherwise sit there doing nothing at all */
  const hashCheck = () => {
    if (window.location.hash === '#solutions' && window.location.pathname !== PAGE) goPage();
  };
  window.addEventListener('hashchange', hashCheck);
  hashCheck();

  window.SAIDIR = { open: goPage, close, toggle: goPage, page: PAGE };
})();
