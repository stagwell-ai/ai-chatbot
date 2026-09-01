/* ═══════════════════════════════════════════════════════════════════════════
   ADS.JS — /ads, the campaign switchboard.

   The client's ask: "part of the project is whether or not the user came from
   a specific ad. And there are four different ads. So we need four different
   landing pages. And we need some type of like home page which you click on
   which then shows you how you got there and shows you which ad that you saw
   to get to start the flow that you are on."

   The four landings already exist at /p/{id}. This is the page in front of
   them: a presenter opens it, picks the ad a visitor would have clicked, and
   the run starts on that ad's landing with attribution captured. ribbon.js is
   the other half — it keeps the answer on screen for the rest of the journey.

   Every card is rendered FROM data/campaigns.json. That file is the contract
   (five entries: the master brand ad plus four product ads), so nothing about
   the list — order, names, openers, prefills, status — is written down twice.
   A fifth product ad added to the JSON appears here with no code change.

   The one event it emits is 'handoff_click', an existing type, so the console
   shows the demo's own opening move in the vocabulary it already renders.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const root = document.getElementById('adsRoot');
  if (!root) return;

  const MASTER = 'master';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  /* "targeting_machine" → "Targeting machine"; only ever a fallback for a
     value routing.json doesn't carry a label for */
  const pretty = s => String(s == null ? '' : s)
    .replace(/[_-]+/g, ' ')
    .replace(/^\s*([a-z])/, (m, c) => c.toUpperCase())
    .trim();

  const domainLabel = id => {
    let d = null;
    try { d = (window.SAI && typeof window.SAI.domain === 'function') ? window.SAI.domain(id) : null; }
    catch (e) { d = null; }
    return (d && (d.label || d.name)) || pretty(id);
  };

  /* routeBias trimmed to its first clause — but bracket-aware, because two of
     the five notes are a whole "[to confirm — …]" placeholder whose own em
     dash must not be mistaken for the end of the clause. Cut at the first ';'
     or em dash sitting at bracket depth zero. */
  function firstClause(text) {
    const s = String(text == null ? '' : text).trim();
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '[') depth++;
      else if (ch === ']') depth = Math.max(0, depth - 1);
      else if (depth === 0 && (ch === ';' || ch === '—')) return s.slice(0, i).trim();
    }
    return s;
  }

  /* ── the facts row: what this entry hands the engine before question one ── */
  function factsHtml(campaign, opts) {
    const prefill = (campaign && campaign.prefill) || {};
    const bits = [];

    if (Array.isArray(prefill.problem_domains) && prefill.problem_domains.length) {
      bits.push(prefill.problem_domains.map(domainLabel).join(' · '));
    }
    if (prefill.product_interest) {
      bits.push('product interest: <code>' + esc(prefill.product_interest) + '</code>');
    }
    const prefillHtml = bits.length
      ? bits.join(' &nbsp;·&nbsp; ')
      : '<span class="none">attribution only — no product bias</span>';

    const rows = [
      ['Pre-fills', prefillHtml],
      ['Route bias', esc(firstClause(campaign.routeBias) || 'none')],
      ['Lands on', '<code>' + esc((opts && opts.href) || '/') + '</code>']
    ];

    return '<dl class="adfacts">' + rows.map(r =>
      '<div class="adfact"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'
    ).join('') + '</dl>';
  }

  function openerHtml(campaign) {
    if (!campaign.opener) return '';
    return '<blockquote class="adcard__opener">&ldquo;' + esc(campaign.opener) + '&rdquo;</blockquote>';
  }

  /* ── a product ad ───────────────────────────────────────────────────────── */
  function productCard(campaign, index) {
    const href = '/p/' + campaign.id;
    const pending = campaign.status === 'pending_positioning'
      ? '<span class="pendtag">[Positioning pending]</span>' : '';

    return '' +
      '<article class="adcard" data-campaign="' + esc(campaign.id) + '">' +
        '<div class="adcard__top">' +
          '<span class="adcard__slot">Ad ' + String(index + 1).padStart(2, '0') + '</span>' +
          '<h2 class="adcard__name">' + esc(campaign.name) + '</h2>' +
          pending +
        '</div>' +
        '<div class="phbox">[AD CREATIVE &mdash; mirrors the campaign creative when it lands]</div>' +
        openerHtml(campaign) +
        factsHtml(campaign, { href: href }) +
        '<a class="btn btn--gold adcard__go" href="' + esc(href) + '" data-go="' + esc(href) + '">' +
          'Click this ad &rarr;</a>' +
      '</article>';
  }

  /* ── the master brand ad — last, and visibly a different animal ─────────── */
  function masterCard(campaign) {
    return '' +
      '<div class="adhub__split">The brand campaign</div>' +
      '<article class="adcard adcard--master" data-campaign="' + esc(campaign.id) + '">' +
        '<div class="adcard__body">' +
          '<div class="adcard__top">' +
            '<span class="adcard__slot">Master</span>' +
            '<h2 class="adcard__name">' + esc(campaign.name) + '</h2>' +
          '</div>' +
          '<p class="adcard__note">The brand ad names no product, so it carries no product bias into ' +
            'the session — the routing matrix decides, off the answers alone.</p>' +
          openerHtml(campaign) +
          factsHtml(campaign, { href: '/' }) +
        '</div>' +
        '<div class="adcard__aside">' +
          '<div class="phbox">[BRAND CAMPAIGN CREATIVE]</div>' +
          '<a class="btn btn--gold adcard__go" href="/" data-go="/">Open the brand landing &rarr;</a>' +
        '</div>' +
      '</article>';
  }

  function renderEmpty(why) {
    root.innerHTML = '<p class="adhub__empty">[CAMPAIGNS UNAVAILABLE — ' + esc(why) +
      '. This page renders entirely from /data/campaigns.json; with the file missing there is ' +
      'nothing honest to show.]</p>';
  }

  /* ── the one event: the demo's own opening move ─────────────────────────── */
  function wire() {
    root.addEventListener('click', e => {
      const go = e.target.closest('[data-go]');
      if (!go) return;
      const url = go.getAttribute('data-go');
      try {
        if (window.SAI && window.SAI.events && typeof window.SAI.events.emit === 'function') {
          window.SAI.events.emit('handoff_click', {
            solution: 'demo-hub',
            url: url,
            route: 'ad-hub'
          });
        }
      } catch (err) { /* the click still has to work */ }
      /* no preventDefault: emit() is synchronous (memory + localStorage ring),
         so the record is written before the browser leaves the page */
    });
  }

  /* ── chrome shared with campaign.html: the mobile drawer ─────────────────── */
  function wireChrome() {
    const navMenu = document.getElementById('navMenu');
    const navScrim = document.getElementById('navScrim');
    const mnavClose = document.getElementById('mnavClose');
    const closeNav = () => document.body.classList.remove('nav-open');
    if (navMenu) navMenu.addEventListener('click', () => document.body.classList.toggle('nav-open'));
    if (navScrim) navScrim.addEventListener('click', closeNav);
    if (mnavClose) mnavClose.addEventListener('click', closeNav);
  }

  function render(list) {
    if (!Array.isArray(list) || !list.length) { renderEmpty('no entries loaded'); return; }

    const products = list.filter(c => c && c.id && c.id !== MASTER);
    const master = list.find(c => c && c.id === MASTER) || null;

    if (!products.length) { renderEmpty('no product campaigns declared'); return; }

    root.innerHTML =
      '<div class="adgrid">' + products.map(productCard).join('') + '</div>' +
      (master ? masterCard(master) : '');

    wire();
  }

  wireChrome();

  const boot = () => {
    let list = [];
    try { list = ((window.SAI.data || {}).campaigns || {}).campaigns || []; }
    catch (e) { list = []; }
    render(list);
  };

  if (window.SAI && window.SAI.ready && typeof window.SAI.ready.then === 'function') {
    window.SAI.ready.then(boot).catch(() => renderEmpty('engine failed to start'));
  } else {
    /* engine.js absent — the page is still worth showing, so read the contract
       directly rather than blanking */
    fetch('/data/campaigns.json')
      .then(r => (r.ok ? r.json() : null))
      .then(j => render((j && j.campaigns) || []))
      .catch(() => renderEmpty('fetch failed'));
  }
})();
