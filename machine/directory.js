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
      if (domain.id === 'influencer') {
        const out = [];
        const smb = list.find(s => s.id === 'smb_platform');
        const ent = list.find(s => s.id === 'imai');
        if (smb) out.push({ solution: smb, fit: 'small teams' });
        if (ent) out.push({ solution: ent, fit: '100+ creators' });
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

  /* every external product link carries the directory's own attribution —
     separate from routing's utm_medium so the two surfaces are countable
     apart in analytics. */
  function attributedUrl(baseUrl) {
    if (!baseUrl) return null;
    let u;
    try { u = new URL(baseUrl, window.location.href); } catch (e) { return baseUrl; }
    const params = new URLSearchParams(u.search);
    params.set('utm_source', 'stagwell-ai');
    params.set('utm_medium', 'directory');
    u.search = params.toString();
    return u.toString();
  }

  function pendingCardHTML() {
    return `<article class="dircard dircard--pending"><h3>[SOLUTION — pending]</h3></article>`;
  }

  function cardHTML(entry) {
    if (!entry || !entry.solution) return pendingCardHTML();
    const s = entry.solution;
    const body = firstSentences(s.positioning);
    const fit = entry.fit ? ` <span class="dircard__fit">(${esc(entry.fit)})</span>` : '';
    const link = s.url
      ? `<a class="dircard__link" href="${esc(attributedUrl(s.url))}" target="_blank" rel="noopener"
           data-dir-handoff data-solution="${esc(s.id)}" data-url="${esc(s.url)}">Visit site <i aria-hidden="true">↗</i></a>`
      : `<span class="dircard__link is-disabled" aria-disabled="true">[PRODUCT SITE — pending]</span>`;
    return `
      <article class="dircard">
        <h3 class="dircard__name">${esc(s.name)}${fit}</h3>
        <p class="dircard__pos">${esc(body)}</p>
        <p class="dircard__who">Who it's for: ${esc(s.whoFor || '')}</p>
        ${link}
      </article>`;
  }

  function groupHTML(domain, list) {
    const entries = resolveDomain(domain, list);
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
    return domains.map(d => groupHTML(d, list)).join('');
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
        } catch (e) { /* the tab still opens without the log line */ }
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

  /* ── wiring: any current or future `#solutions` link opens the panel,
     no matter which page or which drawer it lives in ── */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href="#solutions"]');
    if (!a) return;
    e.preventDefault();
    open(a);
  });

  if (window.location.hash === '#solutions') {
    /* deep link: /#solutions opens on load — DOM is already parsed since
       this script tag sits at the end of body */
    open(null);
  }

  window.SAIDIR = { open: () => open(null), close, toggle: () => toggle(null) };
})();
