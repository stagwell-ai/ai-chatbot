/* ═══════════════════════════════════════════════════════════════════════════
   MIXPANEL — the browser SDK, loaded once per page.

   Events do not come from here. Everything the site considers worth counting
   already goes through SAIANALYTICS.track() (analytics.js), which forwards to
   window.mixpanel when it exists. This file's only job is to make it exist,
   and to set the things that must be true before the first event: the token,
   the config, and the super properties every event should carry.

   THE TOKEN IS NOT A SECRET. A Mixpanel project token is client-side by
   design — it sits in the page source of every site that uses Mixpanel, and
   it can only write events into this one project. It is not a key and there
   is nothing to rotate.

   NO identify(). The SDK skill is explicit: use a stable database primary
   key, never an email. We have neither. A visitor here is anonymous until
   they hand over an address, and our own rule is that the address never
   reaches analytics — only its domain. Calling identify() with a session id
   would be worse than not calling it: every visit would become a new person
   and every retention number would be a lie. So Mixpanel's own device id
   stands, and the session id rides along as a super property instead.

   WHO IS NOT TRACKED. Global Privacy Control and Do Not Track are honoured,
   and `localStorage['sai-no-track']` opts a browser out for good. That is not
   a consent banner, and it is not a substitute for one: a visitor in the EU
   or California needs to be asked BEFORE anything is sent. Until this site
   has that, TRACK below is the switch that turns everything off in one edit.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const TOKEN = 'bbf389fb4acc7156b56cb21aac4b969d';
  const TRACK = true;                       /* false disables Mixpanel site-wide */

  function refused() {
    try {
      if (navigator.globalPrivacyControl === true) return 'gpc';
      const dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
      if (String(dnt) === '1' || String(dnt).toLowerCase() === 'yes') return 'dnt';
      if (localStorage.getItem('sai-no-track')) return 'opt-out';
    } catch (e) { /* storage blocked: not a refusal */ }
    return null;
  }

  /* which part of the site this is, for a super property that survives the
     single-page conversation — the pathname alone says /book forever */
  function area() {
    const p = String(location.pathname || '/').replace(/\/+$/, '') || '/';
    if (p === '/' || /^\/home-[abc]$/.test(p)) return 'home';
    if (p === '/book') return 'book';
    if (p.indexOf('/s/') === 0) return 'solution';
    if (p.indexOf('/p/') === 0) return 'campaign';
    if (p === '/products') return 'products';
    return p.replace(/^\//, '') || 'other';
  }

  if (!TRACK) return;
  const no = refused();
  if (no) { window.SAIMIXPANEL = { on: false, why: no }; return; }

  const s = document.createElement('script');
  s.src = 'https://cdn.mxpnl.com/libs/mixpanel-2/mixpanel.js';
  s.async = true;
  s.onload = () => {
    try {
      window.mixpanel.init(TOKEN, {
        track_pageview: true,
        persistence: 'localStorage',
        batch_requests: true,
        /* every click would be noise: the site already decides what matters
           and sends it through SAIANALYTICS */
        autocapture: false,
        debug: false
      });
      const sess = (window.SAI && window.SAI.sessionId) || null;
      const props = { platform: 'web', site_area: area() };
      if (sess) props.session_id = sess;
      window.mixpanel.register(props);
      window.SAIMIXPANEL = { on: true };
    } catch (e) { window.SAIMIXPANEL = { on: false, why: 'init_failed' }; }
  };
  s.onerror = () => { window.SAIMIXPANEL = { on: false, why: 'blocked' }; };
  document.head.appendChild(s);
})();
