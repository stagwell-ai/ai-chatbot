/* ═══════════════════════════════════════════════════════════════════════════
   PRODTOC.JS — the products index as a menu (client, Sep 6)

   Fourteen jump links, each carrying a whole section heading, are a wall as a
   list and a long sideways scroll as a strip. Neither is something you read.

   Built after the pattern the client pointed at (pentagram.com): a line of
   type with the choice set into it, and the whole index revealed as a cluster
   of tags above it rather than a column you scroll. One control at rest, every
   option at a glance when you want it, closed again the moment you choose.

   It is built FROM the existing links, so the copy is whatever the markup
   already said, and if this file never runs the original list is still there
   and still works.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
 /* products.js renders the index after this file runs, so the first look finds
    nothing at all — wait for it rather than giving up. */
 const build = () => {
  const toc = document.querySelector('.prodtoc');
  if (!toc || toc.dataset.menu) return !!toc;

  const links = [...toc.querySelectorAll('a')];
  if (links.length < 4) return false;         // a short list is fine as a list
  toc.dataset.menu = '1';

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const wrap = document.createElement('div');
  wrap.className = 'ptoc';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ptoc__btn';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-haspopup', 'listbox');
  const label = document.createElement('span');
  label.className = 'ptoc__label';
  label.textContent = 'everything';
  btn.append(label);
  btn.insertAdjacentHTML('beforeend',
    '<svg class="ptoc__chev" viewBox="0 0 16 16" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
    'stroke-linejoin="round"><path d="M4 6.5 8 10.5 12 6.5"/></svg>');

  /* the panel is an overlay, not a block in the flow: opening it must not
     move the page underneath */
  const panel = document.createElement('div');
  panel.className = 'ptoc__panel';
  panel.setAttribute('role', 'listbox');
  panel.setAttribute('aria-label', 'Jump to a section');
  panel.hidden = true;
  const sheet = document.createElement('div');
  sheet.className = 'ptoc__sheet';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'ptoc__close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML =
    '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg>';

  /* Two registers, and they are not interchangeable.

     The sheet shows each section's own heading in full — that is the thing you
     are choosing, and once you have opened a menu you want the real sentence,
     not an abbreviation of it.

     The word in the line is the opposite job: it has to be readable at a
     glance while it changes, so it is two or three words naming the subject.
     De-slugging the id gets close but not close enough — "Influencer" is not
     what that section is about, "Influencer marketing" is — so the short forms
     are named here. Anything unmapped falls back to the de-slugged id, which
     means a new section still works without being added to this list. */
  const SHORT = {
    'p-brand_health':       'Brand health',
    'p-research':           'Consumer research',
    'p-business_impact':    'Business impact',
    'p-audiences':          'Audience building',
    'p-leads':              'Inbound leads',
    'p-influencer':         'Influencer marketing',
    'p-reputation':         'Reputation risk',
    'p-media_monitoring':   'Media monitoring',
    'p-ai_visibility':      'AI visibility',
    'p-real_world_behavior':'Real-world behavior',
    'p-marketing_ops':      'Marketing ops',
    'p-ai_workspace':       'AI workspace',
    'p-sample_quality':     'Research sample',
    'p-competitive':        'Competitive benchmarking',
    'p-newly_added':        'Newly added',
  };
  const shortFor = (href) => {
    const id = (href || '').replace(/^#/, '');
    if (SHORT[id]) return SHORT[id];
    return id.replace(/^p-/, '').split(/[_-]/).join(' ')
             .replace(/\bai\b/gi, 'AI')
             .replace(/^./, c => c.toUpperCase());
  };

  const shorts = [];
  /* the listing (pl-c) opens a dropdown under the button, not a full-screen sheet */
  const DROP = document.body.classList.contains('pl-c');
  links.forEach((a, n) => {
    const href = a.getAttribute('href');
    const item = document.createElement('a');
    item.className = 'ptoc__item';
    item.href = href;
    item.setAttribute('role', 'option');
    item.textContent = a.textContent.trim();      /* the full heading */
    if (DROP) {
      const num = document.createElement('span');
      num.className = 'ptoc__num';
      num.textContent = String(n + 1).padStart(2, '0');
      item.prepend(num);
    }
    item.dataset.short = shortFor(href);          /* what the line will say */
    sheet.appendChild(item);
    shorts.push(item.dataset.short);
  });

  /* the line the control sits in. "Show me" is a control label, not copy:
     every word of the index itself still comes from the markup. */
  const line = document.createElement('p');
  line.className = 'ptoc__line';
  const lead = document.createElement('span');
  lead.className = 'ptoc__lead';
  lead.textContent = 'Show me';
  line.append(lead, btn);

  panel.append(closeBtn, sheet);
  wrap.append(line);
  toc.parentNode.insertBefore(wrap, toc);
  document.body.appendChild(panel);   /* out of the flow entirely */
  toc.hidden = true;                 /* the original list stays in the markup */

  /* the word changes in place, straight up and out and back in from below.
     The button's width used to be animated along with it; the client asked
     for the movement to be vertical only, and with the control on a line of
     its own there is nothing beside it for a width change to shove. */
  const setLabel = (text) => {
    if (REDUCED) { label.textContent = text; return; }
    label.classList.add('is-out');
    setTimeout(() => {
      label.textContent = text;
      label.classList.add('is-under');
      label.classList.remove('is-out');
      requestAnimationFrame(() => { label.classList.remove('is-under'); });
    }, 220);
  };

  let scrollLock = 0;
  const place = () => {
    const r = btn.getBoundingClientRect();
    const w = Math.min(440, innerWidth - 32);
    panel.style.width = w + 'px';
    panel.style.left = Math.max(16, Math.min(innerWidth - w - 16, r.left + r.width / 2 - w / 2)) + 'px';
    panel.style.top = (r.bottom + 8) + 'px';
    panel.style.maxHeight = Math.max(200, innerHeight - r.bottom - 24) + 'px';
  };
  const close = () => {
    if (panel.hidden) return;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    wrap.classList.remove('is-open');
    if (DROP) return;
    /* give the page its scroll position back, exactly */
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    scrollTo(0, scrollLock);
    btn.focus();
  };
  const open = () => {
    scrollLock = scrollY;
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    wrap.classList.add('is-open');
    if (DROP) { place(); return; }
    /* the page behind must not scroll while a full-screen sheet is up */
    document.body.style.top = -scrollLock + 'px';
    document.body.style.width = '100%';
    document.body.style.position = 'fixed';
    const first = sheet.querySelector('.ptoc__item');
    if (first) first.focus();
  };
  closeBtn.addEventListener('click', close);
  panel.addEventListener('click', e => { if (e.target === panel) close(); });

  btn.addEventListener('click', e => {
    e.stopPropagation();
    panel.hidden ? open() : close();
  });

  panel.addEventListener('click', e => {
    const item = e.target.closest('.ptoc__item');
    if (!item) return;
    e.preventDefault();
    const target = document.querySelector(item.getAttribute('href'));
    close();
    if (!target) return;
    /* the header is sticky, so the section has to stop below it */
    const nav = document.querySelector('#nav,.nav');
    const off = (nav ? nav.getBoundingClientRect().height : 0) + 24;
    const y = target.getBoundingClientRect().top + scrollY - off;
    scrollTo({ top: y, behavior: REDUCED ? 'auto' : 'smooth' });
    cycling = false; stopCycle();
    setLabel(item.dataset.short || item.textContent.trim());
  });

  /* Until you choose, the word cycles through the index on its own — the
     control says what it is for by demonstrating it. It stops for good the
     moment you pick something, and never runs while the sheet is open or the
     section is off screen. */
  const words = shorts.slice();
  let cycling = !REDUCED, turn = 0, timer = null;
  const tick = () => {
    if (!cycling || !panel.hidden) return;
    turn = (turn + 1) % words.length;
    setLabel(words[turn]);
  };
  /* 1500ms read as a flicker to the client — it now holds each word long
     enough to be read before the next one arrives */
  const startCycle = () => { if (cycling && !timer) timer = setInterval(tick, 3400); };
  const stopCycle  = () => { if (timer) { clearInterval(timer); timer = null; } };
  if (cycling) {
    label.textContent = words[0];
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es[0].isIntersecting ? startCycle() : stopCycle(),
        { threshold: 0.2 }).observe(wrap);
    } else startCycle();
    btn.addEventListener('pointerenter', stopCycle);
    btn.addEventListener('pointerleave', () => { if (panel.hidden) startCycle(); });
  }

  addEventListener('click', e => {
    if (!wrap.contains(e.target) && !panel.contains(e.target)) close();
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  if (DROP) {
    panel.classList.add('ptoc__panel--drop');
    addEventListener('scroll', () => { if (!panel.hidden) close(); }, { passive: true });
    addEventListener('resize', () => { if (!panel.hidden) place(); });
  }
  return true;
 };

 if (!build()) {
   const mo = new MutationObserver(() => { if (build()) mo.disconnect(); });
   mo.observe(document.body, { childList: true, subtree: true });
 }
})();
