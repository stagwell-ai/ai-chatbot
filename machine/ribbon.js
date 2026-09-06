/* ═══════════════════════════════════════════════════════════════════════════
   RIBBON.JS — the persistent "arrived from" indicator.

   The client's ask, in their words: "some type of like home page which you
   click on which then shows you how you got there and shows you which ad that
   you saw to get to start the flow that you are on." /ads is the home page;
   this is the second half — the answer stays on screen for the whole run.

   Rules it holds itself to:
     · it renders ONLY for a campaign that data/campaigns.json actually
       declares. A direct visit, or an unknown ?utm_campaign, shows nothing —
       there is no empty state, because "we don't know" is not a story worth
       a band of screen.
     · it never emits an event. The console is the record of what the demo
       "sent to HubSpot"; a read-only indicator has no business in it.
     · it never traps focus and owns no keyboard shortcut. Two links, in DOM
       order, before the nav.
     · dismissal is sessionStorage, never localStorage: every fresh demo run
       starts with the story back on screen.

   Mounted at body level, once, on a page that loads it — b.html carries the
   landing, the conversation, the snapshot and the path as sections of ONE
   document, so one mount survives the entire journey with nothing to re-run.

   LAYOUT SHIFT: the height is reserved synchronously, off the URL alone (a
   /p/{id} path or a ?utm_campaign= param), before first paint — the campaign
   NAME then fills in when SAI.ready resolves, a few milliseconds later. The
   one case that still moves is a campaign id the JSON does not know, where
   the reservation is given back; that is a demo-operator typo, not a visitor
   path, and the alternative (waiting for data) would shift every real run.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const KEY = 'sai-ribbon-dismissed';
  const CAMPAIGN_PATH = /^\/p\/([a-z0-9-]+)\/?$/;

  /* storage is wrapped end to end, same as engine.js's event ring: a
     locked-down browser costs us the dismissal, never the page */
  function dismissed() {
    try { return window.sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  }
  function rememberDismissal() {
    try { window.sessionStorage.setItem(KEY, '1'); } catch (e) { /* fine */ }
  }

  /* the same two sources engine.js reads attribution from, in the same order:
     a real utm param came from the ad and wins over standing on the landing */
  function candidateId() {
    let id = null;
    try {
      const params = new URLSearchParams(window.location.search || '');
      id = params.get('utm_campaign') || params.get('campaign') || null;
    } catch (e) { id = null; }
    if (id) return String(id).trim() || null;

    try {
      const m = String((window.location && window.location.pathname) || '').match(CAMPAIGN_PATH);
      if (m) return m[1];
    } catch (e) { /* fall through */ }
    return null;
  }

  if (dismissed()) return;
  if (!candidateId()) return;                 /* direct visit — nothing to say */

  /* ── the band ─────────────────────────────────────────────────────────── */
  const bar = document.createElement('div');
  bar.className = 'rbn';
  bar.id = 'saiRibbon';
  bar.setAttribute('role', 'note');
  bar.setAttribute('aria-label', 'How you arrived');
  bar.innerHTML =
    '<div class="rbn__in">' +
      /* two widths of the same words: at 360px the campaign NAME is the one
         thing that must not be truncated, so the furniture shortens instead */
      '<span class="rbn__label"><span class="rbn__lg">Arrived from</span>' +
        '<span class="rbn__sm">From</span></span>' +
      '<span class="rbn__name" id="rbnName"></span>' +
      '<span class="rbn__acts">' +
        '<a class="rbn__link" href="/ads">' +
          '<span class="rbn__lg">See the ad</span><span class="rbn__sm">See ad</span></a>' +
        '<button type="button" class="rbn__x" id="rbnX" aria-label="Dismiss this notice">' +
          '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">' +
            '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
          '</svg>' +
        '</button>' +
      '</span>' +
    '</div>';

  function mount() {
    if (!document.body || document.getElementById('saiRibbon')) return;
    document.body.appendChild(bar);
    document.body.classList.add('has-ribbon');   /* reserves the 44px */
    const x = document.getElementById('rbnX');
    if (x) x.addEventListener('click', teardown);
  }

  function teardown() {
    rememberDismissal();
    const el = document.getElementById('saiRibbon');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (document.body) document.body.classList.remove('has-ribbon');
  }

  /* give the height back, silently, when the id turns out not to be ours */
  function withdraw() {
    const el = document.getElementById('saiRibbon');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (document.body) document.body.classList.remove('has-ribbon');
  }

  function fill(name) {
    const slot = document.getElementById('rbnName');
    if (!slot) return;
    slot.textContent = '';
    const b = document.createElement('b');
    b.textContent = name;
    const word = document.createElement('span');
    word.className = 'rbn__word';
    word.textContent = ' ad';
    slot.appendChild(b);
    slot.appendChild(word);
  }

  /* ── resolve against the contract ─────────────────────────────────────── */
  function settle() {
    const SAI = window.SAI;
    const attributed = (SAI && SAI.session && SAI.session.attribution &&
                        SAI.session.attribution.utm_campaign) || null;
    const campaign = (attributed && SAI && typeof SAI.campaign === 'function')
      ? SAI.campaign(attributed) : null;

    if (!campaign || !campaign.name) { withdraw(); return; }
    fill(campaign.name);
  }

  function boot() {
    mount();
    const SAI = window.SAI;
    if (!SAI || !SAI.ready || typeof SAI.ready.then !== 'function') { withdraw(); return; }
    SAI.ready.then(settle).catch(withdraw);
  }

  /* scripts sit at the end of <body>, so the body is nearly always there
     already; the listener is the safety net for a defer/head placement */
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot, { once: true });
})();

/* ═══════════════════════════════════════════════════════════════════════════
   THEME TOGGLE. The <head> script has already stamped data-theme before first
   paint (stored choice, else dark); this only flips it and remembers.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  const root = document.documentElement;
  const label = () => {
    const dark = root.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('#themeToggle,[data-theme-toggle]').forEach(b => {
      b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      const t = b.querySelector('span'); if (t) t.textContent = dark ? 'Light mode' : 'Dark mode';
    });
  };
  const flip = () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('sw-theme', next); } catch (e) {}
    label();
  };
  const wire = () => {
    document.querySelectorAll('#themeToggle,[data-theme-toggle]').forEach(b => {
      if (b.__themed) return; b.__themed = true;
      b.addEventListener('click', flip);
    });
    label();
  };
  if (document.body) wire();
  else document.addEventListener('DOMContentLoaded', wire, { once: true });
})();
