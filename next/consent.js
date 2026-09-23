/* ═══════════════════════════════════════════════════════════════════════════
   CONSENT — the one gate in front of every third-party tracker on this site.

   Three of them arrived within a day of each other: Contentsquare (heatmaps
   and session replay), HubSpot (visitor cookie, ties a form submission to a
   browsing history) and Mixpanel (product analytics). Each was added for a
   good reason. Together they are a site that follows people around, and the
   privacy notice named none of them.

   So none of them start themselves any more. Each asks here first:

       SAICONSENT.whenGranted(() => { … load the thing … })

   Nothing is fetched, no cookie is set and no script is injected until a
   visitor has said yes. A refusal is remembered, so is a yes, and either can
   be changed later — SAICONSENT.reset() puts the question back.

   ASKED OF EVERYONE, not only where the law names a region. Partly because
   deciding who is "in the EU" from a browser is guesswork, partly because the
   answer to "may we watch what you do here" should not depend on the passport
   of the person asking. MODE below can narrow it if somebody decides
   otherwise; the machinery does not change.

   Global Privacy Control and Do Not Track are treated as an answer already
   given. They ARE the visitor saying no, in the form the browser provides,
   and asking again after that is not consent-gathering, it is nagging.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const KEY = 'sai-consent';
  const VERSION = 1;                 /* bump to ask again after a material change */
  const MODE = 'all';                /* 'all' | 'off' — 'off' disables every tracker */
  const PRIVACY = 'https://www.stagwellglobal.com/privacy-policy/';

  const COPY = {
    title: 'Cookies and analytics',
    body: 'We use Contentsquare, HubSpot and Mixpanel to understand how this site is used and to follow up on a request you send us. Nothing is loaded until you choose.',
    yes: 'Accept',
    no: 'Decline',
    more: 'Privacy Notice'
  };

  const waiting = [];
  let decided = null;                /* true | false | null (not asked yet) */

  function signalled() {
    try {
      if (navigator.globalPrivacyControl === true) return true;
      const d = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
      if (String(d) === '1' || String(d).toLowerCase() === 'yes') return true;
    } catch (e) { /* nothing to read is not a refusal */ }
    return false;
  }

  function stored() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (!v || v.version !== VERSION) return null;      /* the question changed */
      return v.granted === true;
    } catch (e) { return null; }
  }

  function remember(granted) {
    try { localStorage.setItem(KEY, JSON.stringify({ granted: granted, version: VERSION, at: new Date().toISOString() })); } catch (e) {}
  }

  function settle(granted) {
    decided = granted;
    if (!granted) { waiting.length = 0; return; }
    while (waiting.length) { const fn = waiting.shift(); try { fn(); } catch (e) {} }
  }

  /* ── the bar ──────────────────────────────────────────────────────────────
     Deliberately not a modal and not a wall: it does not trap focus, does not
     cover the page and does not stop anybody reading. Refusing is one click,
     exactly like accepting — a "Decline" hidden behind a settings panel is
     not a choice, it is an obstacle course. */
  function ask() {
    if (document.getElementById('saiConsent')) return;
    const css = document.createElement('style');
    css.textContent = [
      '#saiConsent{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:620px;margin:0 auto;',
      'background:#0C2331;color:#F1FAFF;border:1px solid #12303F;border-radius:14px;padding:18px 20px;',
      'box-shadow:0 18px 50px rgba(0,0,0,.45);font:400 14px/1.5 Montserrat,"Segoe UI",Arial,sans-serif;}',
      '#saiConsent h2{margin:0 0 6px;font-size:15px;font-weight:600;color:#F1FAFF}',
      '#saiConsent p{margin:0 0 14px;color:#8FB2C4}',
      '#saiConsent a{color:#77E3F6}',
      '#saiConsent .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
      '#saiConsent button{border:0;border-radius:999px;padding:10px 20px;cursor:pointer;',
      'font:600 14px Montserrat,sans-serif}',
      '#saiConsent .yes{background:#FF6D24;color:#FFFFFF}',
      '#saiConsent .no{background:transparent;color:#F1FAFF;border:1px solid #2A4B5C}',
      '#saiConsent .no:hover{border-color:#77E3F6}',
      '@media (max-width:520px){#saiConsent .row button{flex:1 1 auto}}'
    ].join('');
    document.head.appendChild(css);

    const el = document.createElement('div');
    el.id = 'saiConsent';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', COPY.title);
    el.innerHTML = '<h2></h2><p></p><div class="row">'
      + '<button type="button" class="yes"></button>'
      + '<button type="button" class="no"></button>'
      + '<a target="_blank" rel="noopener"></a></div>';
    el.querySelector('h2').textContent = COPY.title;
    el.querySelector('p').textContent = COPY.body;
    el.querySelector('.yes').textContent = COPY.yes;
    el.querySelector('.no').textContent = COPY.no;
    const a = el.querySelector('a');
    a.textContent = COPY.more; a.href = PRIVACY;

    const close = granted => { remember(granted); el.remove(); settle(granted); };
    el.querySelector('.yes').addEventListener('click', () => close(true));
    el.querySelector('.no').addEventListener('click', () => close(false));
    (document.body || document.documentElement).appendChild(el);
  }

  function start() {
    if (MODE === 'off') { settle(false); return; }
    if (signalled()) { settle(false); return; }      /* already told us, in the browser's own words */
    const was = stored();
    if (was === true) { settle(true); return; }
    if (was === false) { settle(false); return; }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ask, { once: true });
    else ask();
  }

  window.SAICONSENT = {
    granted: () => decided,
    whenGranted(fn) {
      if (typeof fn !== 'function') return;
      if (decided === true) { try { fn(); } catch (e) {} return; }
      if (decided === false) return;
      waiting.push(fn);
    },
    grant() { remember(true); const el = document.getElementById('saiConsent'); if (el) el.remove(); settle(true); },
    deny() { remember(false); const el = document.getElementById('saiConsent'); if (el) el.remove(); settle(false); },
    /* forget the answer and ask again — for a privacy page, and for testing */
    reset() { try { localStorage.removeItem(KEY); } catch (e) {} decided = null; ask(); }
  };

  /* Contentsquare used to be a hard-coded <script> in every page's head,
     which meant it ran before anybody could be asked anything. It is loaded
     from here now, on the same terms as the other two. */
  window.SAICONSENT.whenGranted(() => {
    if (document.getElementById('cs-tag')) return;
    const s = document.createElement('script');
    s.id = 'cs-tag';
    s.src = 'https://t.contentsquare.net/uxa/f6c5bb82a83a7.js';
    s.defer = true;
    document.head.appendChild(s);
  });

  start();
})();
