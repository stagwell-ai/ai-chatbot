/* ═══════════════════════════════════════════════════════════════════════════
   VOICE STAGE — the opening of a voice session, as pictures (client,
   2026-09-11: "a banger, awesome opening statement … very visual, with
   something flying out and another thing coming in, then something goes away
   … list another product, explain what it does … use a bunch of images you
   have and details about the products").

   The stage sits over the thread inside the chat card while the agent speaks
   its opening script. It is DRIVEN BY THE TRANSCRIPT, not a clock: voice.js
   calls reveal(id) the moment the agent's words name a product, so the
   picture can never run ahead of, or behind, the voice.

     create(host, cfg) → { open, reveal, caption, close, destroy, state }
       cfg.burst   [url]      the brand pictures that flash and fly out
       cfg.self    {name, sub, img}   the card that comes in — NewVoices
       cfg.products [{id, name, line, img}]   the showcase, in speaking order
       cfg.closeOn string    the words after which the stage goes away

   Beats:  burst (stop-motion) → fly out / fly in (NewVoices) → each product
   tile flies in as it is named, the last one large, the rest as a row →
   close: everything lifts away and the thread is there underneath.

   Reduced motion: no flight, fades only, no burst. Everything is CSS
   transitions on classes; this file only adds and removes them.
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

  function create(host, cfg) {
    const c = cfg || {};
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const D = reduced ? 0 : 1;                       /* motion multiplier */
    let el = null, thread = null, timers = [], phase = 'closed', revealed = [], captionEl = null, deck = null, heroCard = null;

    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
    const clear = () => { timers.forEach(clearTimeout); timers = []; };

    function build() {
      el = document.createElement('div');
      el.className = 'vstage' + (reduced ? ' vstage--still' : '');
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML =
        '<div class="vstage__burst"></div>' +
        '<div class="vstage__hero">' +
          '<img class="vstage__heroimg" alt="" decoding="async" src="' + esc(c.self && c.self.img) + '">' +
          (c.self && c.self.logo ? '<img class="vstage__herologo" alt="" decoding="async" src="' + esc(c.self.logo) + '">' : '') +
          '<div class="vstage__herotext"><span class="vstage__heroname">' + esc(c.self && c.self.name || 'NewVoices') + '</span><span class="vstage__herosub">' + esc(c.self && c.self.sub || '') + '</span></div>' +
        '</div>' +
        '<div class="vstage__deck"></div>' +
        '<p class="vstage__caption"></p>';
      deck = el.querySelector('.vstage__deck');
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
      list(c.products).forEach(p => { const im = new Image(); im.src = p.img; });
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

    function reveal(id) {
      if (phase === 'closed' || phase === 'closing') return false;
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
      /* the product's own mark on a plate in the corner, when the catalog has
         one ("when you mention company names, show their icons") */
      tile.innerHTML = '<img alt="" decoding="async" src="' + esc(p.img) + '">' +
        (p.lockup ? '<span class="vstage__tilelogo"><img alt="" decoding="async" src="' + esc(p.lockup) + '"></span>' : '') +
        '<div class="vstage__tiletext"><span class="vstage__tilename">' + esc(p.name) + '</span><span class="vstage__tileline">' + esc(p.line) + '</span></div>';
      deck.appendChild(tile);
      requestAnimationFrame(() => requestAnimationFrame(() => tile.classList.add('is-in')));
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

    return { open, reveal, caption, close, destroy, state: () => ({ phase, revealed: revealed.slice() }), _el: () => el };
  }

  return { create };
});
