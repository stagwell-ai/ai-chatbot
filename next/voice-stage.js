/* ═══════════════════════════════════════════════════════════════════════════
   VOICE STAGE — the Stagwell AI story, as pictures (client, 2026-09-11: "a
   banger, awesome opening statement … very visual, with something flying out
   and another thing coming in … list another product, explain what it does";
   then: "when each of them is named, display the logo, or some kind of SVG
   icon … think of how to make it feel like introducing a team of superheroes").

   The stage sits over the thread inside the chat card while the agent tells
   the story. It is DRIVEN BY THE TRANSCRIPT, not a clock: voice.js calls
   reveal(id) the moment the agent's words name a product, so the picture can
   never run ahead of, or behind, the voice.

     create(host, cfg) → { open, reveal, revealMore, caption, assemble, close, destroy, state }
       cfg.burst    [url]                         the brand pictures that flash and fly out
       cfg.self     {name, sub, img, logo, icon}  the card that comes in — NewVoices
       cfg.products [{id, name, line, img, icon, lockup}]   the team, in speaking order
       cfg.teamLabel string                       under the assembled team
       cfg.moreLabel string                       the badge for the rest of the family ("10+ products")
       cfg.closeOn  string                        the words after which the stage goes away

   Beats:  burst (stop-motion) → fly out / fly in (NewVoices) → each member's
   card slams in as it is named — its EMBLEM (an icon in a glowing ring) lands
   first, then its mark and its power line; the ones already named line up as
   badges on the roster at the foot → assemble: the whole team, centre stage →
   close: everything lifts away and the thread is there underneath.

   The icons are drawn here from a fixed set (keys in the copy, never markup
   from the copy). Reduced motion: no flight, fades only, no burst.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.SAIVOICESTAGE = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const list = v => (Array.isArray(v) ? v : []);

  /* the emblems: one glyph per power. 24-unit strokes, currentColor. */
  const ICONS = {
    radar:     '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6.5-6.5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    shield:    '<path d="M12 3l7 3v6c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6z"/><path d="M8 12.5h2l1.5-3 2 6 1.5-3H16"/>',
    crosshair: '<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>',
    megaphone: '<path d="M4 10v4a1 1 0 0 0 1 1h3l7 4V5L8 9H5a1 1 0 0 0-1 1z"/><path d="M18 9.5a3.5 3.5 0 0 1 0 5"/><path d="M20.5 7.5a7 7 0 0 1 0 9"/>',
    pulse:     '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/><path d="M7 11h2l1.2-2.5 1.8 5 1.2-2.5H15"/>',
    waveform:  '<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4"/>',
    cloud:     '<path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 9.5 4.25 4.25 0 0 0 7 18z"/><path d="M9 14.5h6"/>',
    audience:  '<circle cx="8" cy="9" r="3"/><circle cx="16.5" cy="10" r="2.5"/><path d="M2.5 19a5.5 5.5 0 0 1 11 0"/><path d="M13.5 18.5a4 4 0 0 1 8 0"/>',
    chart:     '<path d="M4 19V5M4 19h16"/><path d="M8 15l3-4 3 2 4-6"/>',
    spark:     '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'
  };
  const icon = key => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[key] || ICONS.spark) + '</svg>';
  const emblem = (key, cls) => '<span class="vstage__emblem' + (cls ? ' ' + cls : '') + '">' + icon(key) + '</span>';

  function create(host, cfg) {
    const c = cfg || {};
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const D = reduced ? 0 : 1;                       /* motion multiplier */
    let el = null, thread = null, timers = [], phase = 'closed', revealed = [], captionEl = null, deck = null, roster = null, heroCard = null;

    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const clear = () => { timers.forEach(clearTimeout); timers = []; };

    function build() {
      const self = c.self || {};
      el = document.createElement('div');
      el.className = 'vstage' + (reduced ? ' vstage--still' : '');
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML =
        '<div class="vstage__burst"></div>' +
        '<div class="vstage__hero">' +
          '<img class="vstage__heroimg" alt="" decoding="async" src="' + esc(self.img) + '">' +
          (self.logo ? '<img class="vstage__herologo" alt="" decoding="async" src="' + esc(self.logo) + '">' : '') +
          emblem(self.icon || 'waveform', 'vstage__emblem--hero') +
          '<div class="vstage__herotext"><span class="vstage__heroname">' + esc(self.name || 'NewVoices') + '</span><span class="vstage__herosub">' + esc(self.sub || '') + '</span></div>' +
        '</div>' +
        '<div class="vstage__deck"></div>' +
        '<div class="vstage__roster"><span class="vstage__teamlabel">' + esc(c.teamLabel || 'The Stagwell AI team') + '</span></div>' +
        '<p class="vstage__caption"></p>';
      deck = el.querySelector('.vstage__deck');
      roster = el.querySelector('.vstage__roster');
      heroCard = el.querySelector('.vstage__hero');
      captionEl = el.querySelector('.vstage__caption');
      const burst = el.querySelector('.vstage__burst');
      list(c.burst).forEach((src, i) => { const im = document.createElement('img'); im.alt = ''; im.decoding = 'async'; im.src = src; im.className = 'vstage__frame' + (i === 0 ? ' is-on' : ''); burst.appendChild(im); });
      return el;
    }

    function open() {
      if (phase !== 'closed') return;
      phase = 'burst';
      thread = host.querySelector('#agentThread');
      build();
      host.insertBefore(el, thread || host.firstChild);
      if (thread) thread.setAttribute('data-vstage-hidden', '1');
      /* preload every picture the beats will need */
      list(c.products).forEach(p => { [p.img, p.lockup].filter(Boolean).forEach(src => { const im = new Image(); im.src = src; }); });
      requestAnimationFrame(() => el.classList.add('is-open'));
      /* the burst: brand pictures as stop motion, then the last one flies out
         as NewVoices comes in */
      const frames = [...el.querySelectorAll('.vstage__frame')];
      if (!reduced && frames.length > 1) {
        let i = 0;
        const step = () => { frames[i].classList.remove('is-on'); i = (i + 1) % frames.length; frames[i].classList.add('is-on'); };
        for (let k = 1; k < frames.length * 2; k++) later(step, k * 115);
      }
      later(() => { phase = 'hero'; el.classList.add('is-hero'); }, D ? 1450 : 200);
    }

    /* a member of the team is named: its card slams in — emblem first, then
       its mark and its line; the one before it steps onto the roster */
    function reveal(id) {
      if (phase === 'closed' || phase === 'closing' || phase === 'team') return false;
      if (revealed.indexOf(id) !== -1) return false;
      const p = list(c.products).find(x => x && x.id === id);
      if (!p) return false;
      revealed.push(id);
      phase = 'deck';
      el.classList.add('is-deck');
      deck.querySelectorAll('.vstage__tile.is-current').forEach(t => { t.classList.remove('is-current'); t.classList.add('is-past'); });
      const tile = document.createElement('div');
      tile.className = 'vstage__tile is-current' + (revealed.length % 2 ? ' from-left' : ' from-right');
      tile.setAttribute('data-product', p.id);
      tile.innerHTML = '<img class="vstage__tileimg" alt="" decoding="async" src="' + esc(p.img) + '">' +
        emblem(p.icon) +
        '<div class="vstage__tiletext">' +
          (p.lockup ? '<span class="vstage__tilelogo"><img alt="" decoding="async" src="' + esc(p.lockup) + '"></span>' : '') +
          '<span class="vstage__tilename">' + esc(p.name) + '</span>' +
          '<span class="vstage__tileline">' + esc(p.line) + '</span>' +
        '</div>';
      deck.appendChild(tile);
      /* its badge on the roster — every member named so far, in order */
      const badge = document.createElement('span');
      badge.className = 'vstage__badge';
      badge.setAttribute('data-product', p.id);
      badge.innerHTML = emblem(p.icon, 'vstage__emblem--badge') + '<span class="vstage__badgename">' + esc(p.name) + '</span>';
      roster.appendChild(badge);
      requestAnimationFrame(() => requestAnimationFrame(() => { tile.classList.add('is-in'); badge.classList.add('is-in'); }));
      return true;
    }

    /* "…and that's just six of them — more than ten in total": the rest of the
       family joins the roster as the words are said */
    let moreBadge = null;
    function revealMore() {
      if (phase === 'closed' || phase === 'closing' || moreBadge || !c.moreLabel) return false;
      moreBadge = document.createElement('span');
      moreBadge.className = 'vstage__badge vstage__badge--more';
      moreBadge.setAttribute('data-product', 'more');
      moreBadge.innerHTML = emblem('spark', 'vstage__emblem--badge') + '<span class="vstage__badgename">' + esc(c.moreLabel) + '</span>';
      roster.appendChild(moreBadge);
      el.classList.add('is-more');
      requestAnimationFrame(() => requestAnimationFrame(() => moreBadge.classList.add('is-in')));
      return true;
    }

    /* the pivot: the whole team, centre stage, for a beat */
    function assemble() {
      if (phase === 'closed' || phase === 'closing' || phase === 'team') return false;
      phase = 'team';
      /* NewVoices takes its place in the line-up — "one of the flagship AI products" */
      const self = c.self || {};
      const me = document.createElement('span');
      me.className = 'vstage__badge vstage__badge--self';
      me.setAttribute('data-product', 'newvoices');
      me.innerHTML = emblem(self.icon || 'waveform', 'vstage__emblem--badge') + '<span class="vstage__badgename">' + esc(self.name || 'NewVoices') + '</span>';
      roster.insertBefore(me, roster.children[1] || null);   /* after the label, before the first member */
      if (!moreBadge) revealMore();                           /* the family, if the words never got there */
      requestAnimationFrame(() => requestAnimationFrame(() => me.classList.add('is-in')));
      el.classList.add('is-team');
      return true;
    }

    function caption(text) {
      if (!captionEl) return;
      const t = String(text || '');
      /* the tail of what is being said: the last sentence or so */
      const tail = t.length > 140 ? '…' + t.slice(t.lastIndexOf(' ', t.length - 120) + 1) : t;
      captionEl.textContent = tail;
    }

    function close(why) {
      if (phase === 'closed' || phase === 'closing') return;
      phase = 'closing';
      clear();
      el.classList.add('is-closing');
      el.setAttribute('data-closed-by', why || '');
      const done = () => {
        if (thread) thread.removeAttribute('data-vstage-hidden');
        if (el && el.parentNode) el.parentNode.removeChild(el);
        el = null; phase = 'closed';
        if (thread) { try { thread.scrollTop = thread.scrollHeight; } catch (e) {} }
      };
      later(done, D ? 700 : 60);
    }

    function destroy() { clear(); if (el && el.parentNode) el.parentNode.removeChild(el); if (thread) thread.removeAttribute('data-vstage-hidden'); el = null; phase = 'closed'; }

    return { open, reveal, revealMore, caption, assemble, close, destroy, state: () => ({ phase, revealed: revealed.slice(), more: !!moreBadge }), _el: () => el };
  }

  /* ── THE TEAM CARD — the story's lasting trace in the conversation ──
     "Instead of having it disappear … have it be part of the chat history and
     have each of those icons be clickable to go to the product page. When you
     mouse over one of the brands, the relevant background image should appear
     and the name of the company should be displayed." (client, 2026-09-11)

     A picture with the member's name and line over it, and the roster of
     emblems beneath: hover or focus a badge to meet that member (the picture
     crossfades, the words change); a tap opens its page in a new tab, so the
     conversation is never lost. NewVoices leads the line-up; the last badge is
     the rest of the family. Every URL is the catalog's. */
  function teamCard(cfg, revealedIds, opts) {
    const c = cfg || {}, o = opts || {};
    const self = c.self || {};
    const members = list(c.products).filter(p => !revealedIds || revealedIds.indexOf(p.id) !== -1);
    const card = document.createElement('div');
    card.className = 'teamcard';
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', c.teamLabel || 'The Stagwell AI team');
    const read = name => String(c.readLabel || 'Read about {product}').replace('{product}', name);
    const badge = (id, key, name, href, cls) =>
      '<a class="teamcard__badge' + (cls ? ' ' + cls : '') + '" href="' + esc(href) + '" target="_blank" rel="noopener" data-id="' + esc(id) + '">' +
        emblem(key, 'vstage__emblem--badge') + '<span class="teamcard__badgename">' + esc(name) + '</span></a>';
    card.innerHTML =
      '<div class="teamcard__stage">' +
        '<img class="teamcard__img is-a is-on" alt="" decoding="async" src="' + esc(self.img || (members[0] || {}).img) + '">' +
        '<img class="teamcard__img is-b" alt="" decoding="async" src="">' +
        '<div class="teamcard__text">' +
          '<span class="teamcard__eyebrow">' + esc(c.teamLabel || 'The Stagwell AI team') + '</span>' +
          '<span class="teamcard__name">' + esc(self.name || 'NewVoices') + '</span>' +
          '<span class="teamcard__line">' + esc(c.peekHint || 'Hover a member to meet them — tap to read more.') + '</span>' +
          '<span class="teamcard__go" hidden></span>' +
        '</div>' +
      '</div>' +
      '<div class="teamcard__roster">' +
        badge('newvoices', self.icon || 'waveform', self.name || 'NewVoices', c.selfUrl || '/newvoices', 'teamcard__badge--self') +
        members.map(p => badge(p.id, p.icon, p.name, p.url || ('/s/' + encodeURIComponent(p.id)))).join('') +
        (c.moreLabel ? badge('more', 'spark', c.moreLabel, c.moreUrl || '/products', 'teamcard__badge--more') : '') +
      '</div>';
    const imgs = [card.querilySelector ? null : card.querySelector('.teamcard__img.is-a'), card.querySelector('.teamcard__img.is-b')];
    const nameEl = card.querySelector('.teamcard__name'), lineEl = card.querySelector('.teamcard__line'), goEl = card.querySelector('.teamcard__go');
    let shown = 0, current = 'newvoices';
    const show = (id) => {
      if (id === current) return;
      current = id;
      const p = id === 'newvoices' ? { name: self.name || 'NewVoices', line: self.sub || '', img: self.img }
        : id === 'more' ? { name: c.moreLabel || 'More', line: c.moreLine || 'Explore the whole family of Stagwell AI products.', img: (c.burst || [])[0] || self.img }
        : members.find(m => m.id === id);
      if (!p) return;
      const next = imgs[1 - shown], prev = imgs[shown];
      if (p.img && next) { next.src = p.img; next.classList.add('is-on'); prev.classList.remove('is-on'); shown = 1 - shown; }
      nameEl.textContent = p.name;
      lineEl.textContent = p.line || '';
      goEl.textContent = id === 'more' ? (c.moreGo || 'See all products →') : read(p.name) + ' →';
      goEl.hidden = false;
      card.querySelectorAll('.teamcard__badge').forEach(b => b.classList.toggle('is-current', b.getAttribute('data-id') === id));
      if (o.onPeek) o.onPeek(id);
    };
    card.querySelectorAll('.teamcard__badge').forEach(b => {
      const id = b.getAttribute('data-id');
      b.addEventListener('mouseenter', () => show(id));
      b.addEventListener('focus', () => show(id));
      b.addEventListener('click', () => { if (o.onOpen) o.onOpen(id, b.getAttribute('href')); });
    });
    return card;
  }

  return { create, teamCard, icons: Object.keys(ICONS) };
});
