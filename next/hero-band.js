/* ═══════════════════════════════════════════════════════════════════════════
   HERO-BAND.JS — the light homepage hero (client, Sep 3)

   Three small things, all presentation:
   · a constellation inside the gradient band: a few soft nodes, drifting
     slowly, joined by faint lines when they come near each other
   · the headline reveals line by line from below, inside a clipping mask
   · every home-page button gets a pill shape with an arrow inside, unless
     its label already ends in one

   Loaded before b.js, which calls revealLines() on the hero title.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1 · the constellation ──────────────────────────────────────────── */
  /* A field of nodes drifting on their own, joined by lines when they come
     near each other, and reacting to the pointer: the cursor pushes the
     nodes it passes, brightens what is close, and draws its own links to
     the nearest few. Colours come from the theme, so it shows in light as
     a soft blue as well as on the dark gradient. */
  function constellation(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const box = canvas.parentElement;
    let W = 0, H = 0, dpr = 1, dots = [], raf = null, running = false, t0 = performance.now();
    const mouse = { x: -9999, y: -9999, on: false };
    let LINK = 168, PUSH = 130;

    const rnd = (a, b) => a + Math.random() * (b - a);
    const theme = () => document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    /* rgb triples per theme: node, link, and the pointer's own links */
    /* one colour, so the field reads as a single system */
    const palette = () => theme() === 'dark'
      ? { node: '119,227,246', link: '119,227,246', a: .9 }
      : { node: '14,95,142',   link: '14,95,142',   a: .7 };

    const seed = () => {
      /* about a third of the old count: the field should read as a few
         connected points, not a dust cloud */
      const n = Math.round(Math.min(26, Math.max(11, (W * H) / 52000)));
      dots = [];
      for (let i = 0; i < n; i++) {
        /* a real size range: mostly small, a few anchors */
        const big = Math.random();
        const r = big > .86 ? rnd(4.2, 5.6) : big > .62 ? rnd(2.6, 3.4) : rnd(1.1, 1.8);
        dots.push({
          x: rnd(0, W), y: rnd(0, H),
          hx: 0, hy: 0, vx: rnd(-.13, .13), vy: rnd(-.13, .13),
          r,
          ph: rnd(0, Math.PI * 2), sp: rnd(.0005, .0012),
        });
        const d = dots[i]; d.hx = d.x; d.hy = d.y;
      }
    };
    const fit = () => {
      const r = box.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      LINK = W < 700 ? 120 : 168; PUSH = W < 700 ? 90 : 130;
      seed();
      if (REDUCED) draw(performance.now());
    };

    const draw = (now) => {
      const t = now - t0, P = palette();
      ctx.clearRect(0, 0, W, H);

      for (const d of dots) {
        if (!REDUCED) {
          /* drift, and turn slowly so the field never looks like it is
             sliding in one direction */
          d.hx += d.vx; d.hy += d.vy;
          d.vx += Math.sin(t * d.sp + d.ph) * .006;
          d.vy += Math.cos(t * d.sp * .9 + d.ph) * .006;
          const sp = Math.hypot(d.vx, d.vy);
          if (sp > .34) { d.vx *= .34 / sp; d.vy *= .34 / sp; }
          if (d.hx < 0) d.hx = W; if (d.hx > W) d.hx = 0;
          if (d.hy < 0) d.hy = H; if (d.hy > H) d.hy = 0;
        }
        /* the pointer pushes what it passes; nodes ease home after */
        let tx = d.hx, ty = d.hy;
        if (mouse.on) {
          const dx = d.hx - mouse.x, dy = d.hy - mouse.y, dist = Math.hypot(dx, dy);
          if (dist < PUSH && dist > .01) {
            const k = (1 - dist / PUSH) ** 2 * 26;
            tx += (dx / dist) * k; ty += (dy / dist) * k;
          }
        }
        d.x += (tx - d.x) * .12; d.y += (ty - d.y) * .12;
      }

      /* links between neighbours, and from the pointer to what is near it */
      ctx.lineWidth = 1;
      for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j];
          const dx = a.x - b.x, dy = a.y - b.y, dist = Math.hypot(dx, dy);
          if (dist > LINK) continue;
          const k = 1 - dist / LINK;
          ctx.strokeStyle = `rgba(${P.link},${(.20 * k * k * P.a).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        if (mouse.on) {
          const dx = a.x - mouse.x, dy = a.y - mouse.y, dist = Math.hypot(dx, dy);
          if (dist < LINK * 1.15) {
            const k = 1 - dist / (LINK * 1.15);
            ctx.strokeStyle = `rgba(${P.link},${(.30 * k * k * P.a).toFixed(3)})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          }
        }
      }

      /* the nodes: a soft core plus a halo, brighter near the pointer */
      for (const d of dots) {
        const tw = .84 + .16 * Math.sin(t * d.sp * 2.4 + d.ph);
        let lift = 0;
        if (mouse.on) {
          const dist = Math.hypot(d.x - mouse.x, d.y - mouse.y);
          if (dist < LINK) lift = (1 - dist / LINK) ** 2;
        }
        const hue = P.node;
        const a = Math.min(1, (.34 + .40 * lift) * tw * P.a);
        const r = d.r * (1 + lift * .5);
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, r * 3.4);
        g.addColorStop(0, `rgba(${hue},${(a * .5).toFixed(3)})`);
        g.addColorStop(1, `rgba(${hue},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(d.x, d.y, r * 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(${hue},${Math.min(1, a * 1.15).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, Math.PI * 2); ctx.fill();
      }
    };

    const loop = (now) => { raf = null; if (!running) return; draw(now); raf = requestAnimationFrame(loop); };
    const start = () => { if (REDUCED || running) return; running = true; if (!raf) raf = requestAnimationFrame(loop); };
    const stop  = () => { running = false; if (raf) { cancelAnimationFrame(raf); raf = null; } };

    /* the pointer is tracked on the band, not the canvas: the canvas sits
       under the headline and the chat, which would swallow the events */
    box.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = box.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true;
    }, { passive: true });
    box.addEventListener('pointerleave', () => { mouse.on = false; mouse.x = mouse.y = -9999; }, { passive: true });

    fit();
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(box); else addEventListener('resize', fit);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? start() : stop()), { threshold: .02 }).observe(box);
    } else start();
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    /* the palette follows the theme toggle */
    new MutationObserver(() => { if (REDUCED) draw(performance.now()); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* ── 2 · the line reveal ─────────────────────────────────────────────── */
  /* Every word is wrapped in its own clipping box and rises from below;
     words on the same line share one delay, so a line lifts as one piece.
     Per-word boxes mean an inline .accent span that wraps across lines
     needs no restructuring. The original markup is restored afterwards so
     later reflows are clean. */
  function revealLines(el, base) {
    if (!el) return;
    const original = el.innerHTML;
    if (REDUCED) { el.innerHTML = original; return; }
    const wrapWords = (node) => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
            const ln = document.createElement('span'); ln.className = 'ln';
            const inn = document.createElement('span'); inn.className = 'ln__in'; inn.textContent = p;
            ln.appendChild(inn); frag.appendChild(ln);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) wrapWords(n);
      });
    };
    wrapWords(el);
    const words = [...el.querySelectorAll('.ln')];
    if (!words.length) { el.innerHTML = original; return; }
    const tops = []; const lineOf = new Map();
    words.forEach(w => {
      const top = Math.round(w.getBoundingClientRect().top / 4) * 4;
      let i = tops.indexOf(top); if (i === -1) { tops.push(top); i = tops.length - 1; }
      lineOf.set(w, i);
    });
    const start = base || 80, step = 120;
    words.forEach(w => w.querySelector('.ln__in').style.setProperty('--d', (start + lineOf.get(w) * step) + 'ms'));
    /* the accent's gradient runs across the WHOLE accent; each word takes
       the slice under it, measured on its own line */
    el.querySelectorAll('.accent').forEach(acc => {
      const rows = new Map();
      acc.querySelectorAll('.ln__in').forEach(w => {
        const r = w.getBoundingClientRect(); const key = Math.round(r.top / 4);
        if (!rows.has(key)) rows.set(key, { l: r.left, r: r.right, ws: [] });
        const row = rows.get(key); row.l = Math.min(row.l, r.left); row.r = Math.max(row.r, r.right); row.ws.push([w, r.left]);
      });
      rows.forEach(row => row.ws.forEach(([w, left]) => {
        w.style.setProperty('--acc-w', Math.round(row.r - row.l) + 'px');
        w.style.setProperty('--acc-x', Math.round(left - row.l) + 'px');
      }));
    });
    el.classList.add('is-revealing');
    const total = start + (tops.length - 1) * step + 950;
    setTimeout(() => { el.classList.remove('is-revealing'); el.innerHTML = original; }, total + 60);
  }
  window.revealLines = revealLines;

  /* ── 3 · arrows in the buttons ───────────────────────────────────────── */
  function arrowButtons(root) {
    (root || document).querySelectorAll('.btn, .pick__go, .nav__cta, .prompt__send').forEach(b => {
      if (b.classList.contains('btn--arrow') || b.classList.contains('nav__menu')) return;
      if (b.classList.contains('theme-toggle') || b.classList.contains('mnav__close')) return;
      const txt = (b.textContent || '').trim();
      if (!txt || /[→›]\s*$/.test(txt) || b.querySelector('svg')) return;
      b.classList.add('btn--arrow');
    });
  }

  /* ── 4 · the nav over the hero ───────────────────────────────────────── */
  /* transparent while the bar sits on the hero band; the regular bar
     returns once the band has scrolled past it. */
  (function () {
    const band = document.querySelector('.hero2--band');
    if (!band) return;
    const root = document.documentElement;
    const nav = document.querySelector('#nav');
    let raf = null;
    const check = () => {
      raf = null;
      const bottom = band.getBoundingClientRect().bottom;
      const navH = nav ? nav.getBoundingClientRect().height : 61;

      /* The hero is a full screen tall now, so "has the band gone past the
         bar" and "are we still at the top of the page" are no longer the same
         question. Scrolling 40px used to slam an opaque white bar across a
         hero that still filled the window. Two states instead of one:
         `over-hero` is the pristine top of the page, where the bar is
         completely transparent; `over-art` is anywhere else that still has
         artwork behind the bar, where it frosts rather than going solid, so
         the headline stays readable underneath without a hard white edge. */
      root.classList.toggle('over-hero', scrollY < 24 && bottom > navH);
      root.classList.toggle('over-art', bottom > navH);

      /* The bar is out of flow on this page, so nothing needs pulling up.
         Publish its height anyway — the drawer and the scroll-spy offsets
         both want it, and reading it here means one measurement per frame
         instead of one per consumer. */
      root.style.setProperty('--navH', Math.round(navH) + 'px');
    };
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(check); }, { passive: true });
    addEventListener('resize', check, { passive: true });
    check();
  })();

  /* ── 5 · the hero's Ask AI takes you to the chat ─────────────────────── */
  (function () {
    const cta = document.getElementById('heroAsk');
    if (!cta) return;
    cta.addEventListener('click', (e) => {
      const pick = document.querySelector('.pick');
      if (!pick) return;
      e.preventDefault();
      const top = pick.getBoundingClientRect().top + scrollY - 84;
      scrollTo({ top, behavior: REDUCED ? 'auto' : 'smooth' });
      const first = pick.querySelector('.pick__row');
      setTimeout(() => { if (first) first.focus({ preventScroll: true }); }, REDUCED ? 0 : 520);
    });
  })();

  /* ── 6 · the long line becomes the chat's header (client, Sep 3) ───── */
  /* "Pick what you're up against…" moves into the chooser's header bar in
     place of "Pick one and I'll show you what it covers." The mark stays;
     only which existing string sits there changes. hero.js renders the
     picker after load, so this waits for it. */
  (function () {
    const hoist = () => {
      const sub = document.querySelector('#hero2 .hero2__sub');
      const hint = document.querySelector('.pick__hint');
      if (!sub || !hint || hint.dataset.hoisted) return false;
      const mark = hint.querySelector('.pick__hinti');
      /* a title and a paragraph, as the reference does — split at the
         sentence's own first dash, so no word is written or dropped */
      const raw = sub.textContent.trim();
      const cut = raw.indexOf(' \u2014 ');
      const head = cut > 0 ? raw.slice(0, cut) : raw;
      const rest = cut > 0 ? raw.slice(cut + 3) : '';
      hint.textContent = '';
      if (mark) hint.appendChild(mark);
      const h = document.createElement('span');
      h.className = 'pick__hinth'; h.textContent = head;
      hint.appendChild(h);
      if (rest) {
        const text = document.createElement('span');
        text.className = 'pick__hinttext';
        text.textContent = rest;
        hint.appendChild(text);
      }
      hint.dataset.hoisted = '1';
      sub.hidden = true;
      /* The words sit ABOVE the card and centred, introducing the chooser the
         way a section header introduces a section — but the mark stays inside
         the card where it belongs (client, Sep 6). So only the two text nodes
         travel; moving them rather than copying keeps the strings
         single-sourced. */
      const card = document.querySelector('.pick');
      if (card && card.parentNode) {
        const lead = document.createElement('div');
        lead.className = 'pick__lead';
        lead.appendChild(h);
        if (rest) lead.appendChild(hint.querySelector('.pick__hinttext'));
        card.parentNode.insertBefore(lead, card);
      }
      return true;
    };
    if (!hoist()) {
      const mo = new MutationObserver(() => { if (hoist()) mo.disconnect(); });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  })();

  /* ── 6b · the partner names take turns (client, Sep 6) ───────────────── */
  /* "Palantir · Adobe · Google" sat as one static list. Same three words, same
     order, same string — only one is on screen at a time now, so the figure
     reads as a single value like the numbers beside it instead of a list that
     has to compete with them for width. */
  (function () {
   /* the stats are rendered after this file runs, so the first look usually
      finds nothing — wait for them the way the chat header does */
   const build = () => {
    const dt = [...document.querySelectorAll('.about__stats dt')]
      .find(el => /·/.test(el.textContent) && /Palantir/i.test(el.textContent));
    if (!dt || dt.dataset.cycling) return false;

    const words = dt.textContent.split('·').map(w => w.trim()).filter(Boolean);
    if (words.length < 2) return false;
    dt.dataset.cycling = '1';

    /* reduced motion gets the list it always had, unrotated */
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return true;

    /* the widest word sets the box, so nothing beside it shifts on each turn */
    dt.textContent = '';
    const slot = document.createElement('span');
    slot.className = 'cyc';
    const sizer = document.createElement('span');
    sizer.className = 'cyc__size';
    sizer.setAttribute('aria-hidden', 'true');
    sizer.textContent = words.reduce((a, b) => (b.length > a.length ? b : a));
    const live = document.createElement('span');
    live.className = 'cyc__now';
    live.textContent = words[0];
    slot.append(sizer, live);
    dt.appendChild(slot);
    /* the full list stays in the accessibility tree */
    const all = document.createElement('span');
    all.className = 'u-sr';
    all.textContent = words.join(' · ');
    dt.appendChild(all);

    let i = 0, timer = null;
    const turn = () => {
      live.classList.add('is-out');
      setTimeout(() => {
        i = (i + 1) % words.length;
        live.textContent = words[i];
        live.classList.remove('is-out');
      }, 260);
    };
    /* only while it is on screen — an off-screen timer is wasted work */
    const io = new IntersectionObserver(es => {
      const on = es[0].isIntersecting;
      if (on && !timer) timer = setInterval(turn, 2200);
      else if (!on && timer) { clearInterval(timer); timer = null; }
    }, { threshold: 0.2 });
    io.observe(dt);
    return true;
   };
   if (!build()) {
     const mo = new MutationObserver(() => { if (build()) mo.disconnect(); });
     mo.observe(document.body, { childList: true, subtree: true });
   }
  })();

  /* ── 6c · the portfolio gets a mark, and arrives softly (client, Sep 6) ── */
  /* Three columns of plain text with a hairline over each read as a table of
     contents rather than a section. A mark in the tier's own colour gives each
     column something to lead with, and the three arrive in sequence on scroll.
     No hover: that was removed on request and stays removed. */
  (function () {
    const ART = {
      /* stacked plates — capability layered on capability */
      orange: '<path d="M12 3 21 7.6 12 12.2 3 7.6z"/><path d="M3 12.2 12 16.8l9-4.6"/><path d="M3 16.6 12 21.2l9-4.6"/>',
      /* a target — built for one specific thing */
      cyan:   '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="3.6"/><circle cx="12" cy="12" r=".9" fill="currentColor" stroke="none"/>',
      /* a spark — pick it up and go */
      amber:  '<path d="M12 2.6c0 5 1.6 7.6 8 9.4-6.4 1.8-8 4.4-8 9.4 0-5-1.6-7.6-8-9.4 6.4-1.8 8-4.4 8-9.4z"/>',
    };

    const build = () => {
      const tiers = [...document.querySelectorAll('.tier')];
      if (!tiers.length) return false;
      let touched = false;

      tiers.forEach((t, i) => {
        if (!t.dataset.marked) {
          const key = ['orange', 'cyan', 'amber'].find(k => t.classList.contains('tier--' + k));
          const d = ART[key];
          if (d) {
            const wrap = document.createElement('span');
            wrap.className = 'tier__mark';
            wrap.setAttribute('aria-hidden', 'true');
            wrap.innerHTML =
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
              'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
            t.insertBefore(wrap, t.firstChild);
            t.dataset.marked = '1';
            touched = true;
          }
        }
        if (!t.dataset.revealed) {
          t.dataset.revealed = '1';
          t.style.setProperty('--i', i);
          if (!REDUCED) t.classList.add('will-reveal');
          touched = true;
        }
      });

      if (!touched) return false;
      if (REDUCED || !('IntersectionObserver' in window)) {
        tiers.forEach(t => t.classList.add('is-in'));
        return true;
      }
      const io = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) { io.unobserve(e.target); e.target.classList.add('is-in'); }
      }), { threshold: 0.16 });
      tiers.forEach(t => io.observe(t));
      return true;
    };

    if (!build()) {
      const mo = new MutationObserver(() => { if (build()) mo.disconnect(); });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  })();

  /* ── 6d · the hero splits in two (client, Sep 6) ─────────────────────── */
  /* Stacked, the headline and the chat could only share one screen by
     shrinking the headline until it stopped being a headline. Side by side
     they both fit at full size: the tagline and the headline hold the left,
     ranged left rather than centred, and the chat holds the right. The
     chooser's own title and paragraph go back inside the card, next to the
     mark, as a header across its full width. */
  (function () {
    const place = () => {
      const band = document.querySelector('#heroBand .hero2__band');
      const card = document.querySelector('.pick');
      if (!band || !card) return false;
      if (band.dataset.split) return true;

      const eyebrow = band.querySelector('.eyebrow, #heroEyebrow');
      const title = band.querySelector('#hero2Title, .display');
      if (!eyebrow || !title) return false;

      /* the lead goes home: into the card's header, beside the mark, and the
         header moves out of the two-pane grid so it spans the whole card */
      const hint = card.querySelector('.pick__hint');
      const lead = document.querySelector('.pick__lead');
      if (hint && lead) {
        while (lead.firstChild) hint.appendChild(lead.firstChild);
        lead.remove();
        if (hint.parentElement !== card) card.insertBefore(hint, card.firstChild);
      }

      const left = document.createElement('div');
      left.className = 'hero2__copy';
      left.append(eyebrow, title);

      /* Move #heroPick, not .pick. Every click in the chooser is delegated
         from #heroPick — selecting a tab, opening a detail, the composer —
         so lifting the card out of it leaves a chooser that renders perfectly
         and does nothing at all. */
      const right = document.createElement('div');
      right.className = 'hero2__chat';
      right.appendChild(document.getElementById('heroPick') || card);

      band.append(left, right);
      band.dataset.split = '1';
      return true;
    };

    if (!place()) {
      const mo = new MutationObserver(() => { if (place()) mo.disconnect(); });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  })();

  /* ── 6e · the eyebrow becomes the lede, under the headline (client) ──── */
  /* It used to sit above the H1 as small caps. The client asked for it below
     the title, reading as the headline's paragraph, in sentence case, with new
     copy. Same element and same id so nothing that references #heroEyebrow
     breaks — it is moved, re-typed and re-styled, not replaced.

     It has to be re-applied: the eyebrow is re-rendered from data after this
     file runs, which is what silently threw the old forced <br> away. */
  (function () {
    const LEDE = [
      'Agentic solutions built to transform marketing.',
      'Tell us what you\u2019re solving \u2014 we\u2019ll find your fit.',
    ];

    const eb = document.querySelector('#heroEyebrow, .hero2__band .eyebrow');
    if (!eb) return;

    let applying = false;
    const apply = () => {
      if (applying) return;
      applying = true;

      const h1 = (eb.closest('.hero2__copy') || eb.parentElement).querySelector('h1');
      if (h1 && h1.nextElementSibling !== eb) h1.after(eb);

      eb.classList.add('eyebrow--lede');

      /* the hero's own CTA, under the lede. data-cta="session" is the existing
         booking flow (CTA_COPY.session in b.js), and the delegated handler in
         b.js picks it up by closest('[data-cta]') — so this needs no wiring of
         its own and opens the same modal every other booking CTA opens. */
      let cta = document.getElementById('heroDemoCta');
      if (!cta) {
        cta = document.createElement('button');
        cta.type = 'button';
        cta.id = 'heroDemoCta';
        cta.className = 'btn btn--dark btn--arrow hero2__demo';
        cta.dataset.cta = 'session';
        cta.textContent = 'Book a demo';
      }
      if (eb.nextElementSibling !== cta) eb.after(cta);

      if (eb.textContent.trim() !== LEDE.join(' ')) {
        eb.textContent = '';
        eb.append(LEDE[0]);
        const br = document.createElement('br');
        br.className = 'eb-break';
        /* the space matters: the <br> is hidden on a phone, where the two
           sentences wrap as one block and would otherwise run together.
           A leading space after a <br> is collapsed at the start of a line,
           so the desktop break is unaffected. */
        eb.append(br, ' ' + LEDE[1]);
      }

      applying = false;
    };

    apply();
    new MutationObserver(apply)
      .observe(eb, { childList: true, subtree: true, characterData: true });
  })();

  /* ── 6f · keep the chosen tag in view on the rail (client, Sep 6) ────── */
  /* On a phone the chooser is one scrolling row. Picking a tag that is half
     off the edge should bring it fully into the rail, or you lose track of
     what you chose. Horizontal only — scrollIntoView would also drag the
     page vertically to the card. */
  (function () {
    document.addEventListener('click', (e) => {
      const row = e.target.closest('.pick__row');
      if (!row) return;
      const list = row.closest('.pick__list');
      if (!list || list.scrollWidth <= list.clientWidth + 2) return;
      const r = row.getBoundingClientRect(), l = list.getBoundingClientRect();
      const pad = 16;
      let delta = 0;
      if (r.left < l.left + pad) delta = r.left - l.left - pad;
      else if (r.right > l.right - pad) delta = r.right - l.right + pad;
      if (delta) list.scrollBy({
        left: delta,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    }, { passive: true });
  })();

  /* ── 7 · the tier facts as dropdowns (client, Sep 3) ─────────────────── */
  /* "Best for" / "Core value" open on click, FAQ-style. Markup untouched:
     the <dt> is the toggle, the <dd> the panel. */
  /* the tier facts are shown in full now, not as dropdowns (client, Sep 3) */

  /* ── 8 · only the first word of the film title takes the gradient ────── */
  (function () {
    const paint = () => {
      const b = document.getElementById('heroPlayLabel');
      if (!b || b.querySelector('.filmw')) return;
      const txt = (b.textContent || '').trim();
      const i = txt.indexOf(' ');
      if (i < 1) return;
      b.textContent = '';
      const w = document.createElement('span'); w.className = 'filmw'; w.textContent = txt.slice(0, i);
      b.append(w, document.createTextNode(txt.slice(i)));
    };
    paint();
    /* video.js rewrites the label from the data contract after load */
    setTimeout(paint, 600); setTimeout(paint, 1800);
  })();

  /* ── 9 · (the portfolio accordion was removed, client Sep 3 — the rows
        are three open columns now, so nothing to toggle) ──────────────── */

  /* ── 10 · the film gets a header row: title left, CTA right ──────────── */
  /* The play button already exists; the CTA is a second trigger for it, so
     the label is borrowed from the nav's own "Watch the film". */
  (function () {
    const build = () => {
      const film = document.querySelector('.film');
      const play = document.getElementById('heroPlay');
      if (!film || !play || film.querySelector('.film__head')) return;
      const label = play.querySelector('.hero2__playtext');
      if (!label) return;
      const head = document.createElement('div');
      head.className = 'film__head';
      head.appendChild(label);                       /* moved, not copied */
      /* no second button: the play control on the picture is the CTA
         (client, Sep 3) */
      film.insertBefore(head, play);
    };
    build(); setTimeout(build, 700);
  })();

  /* ── 11 · a slow parallax on the banner artwork (client, Sep 3) ──────── */
  /* The background sits slightly taller than its box and its vertical
     position tracks the scroll — a small, smooth drift, no jump. Off for
     reduced motion, and only while the banner is on screen. */
  (function () {
    if (REDUCED) return;
    const banners = () => [...document.querySelectorAll('.about__head, .about__proof')];
    let raf = null, live = [];
    const move = () => {
      raf = null;
      const vh = innerHeight;
      for (const el of live) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        /* -1 when the banner is entering, +1 when leaving */
        const p = 1 - ((r.top + r.height / 2) / vh) * 2;
        el.style.setProperty('--par', (p * 10).toFixed(2) + '%');   /* a touch more travel */
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(move); };
    const arm = () => {
      const list = banners();
      if (!list.length || list.every(b => live.includes(b))) return;
      live = list;
      list.forEach(b => b.classList.add('has-par'));
      move();
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    arm();
    new MutationObserver(arm).observe(document.documentElement, { childList: true, subtree: true });
  })();

  const boot = () => {
    /* the constellation is off (client, Sep 3). The function is kept
       above; re-enable by restoring this call and §120 in ribbon.css. */
    /* constellation(document.getElementById('heroDots')); */
    arrowButtons();
    new MutationObserver(() => arrowButtons()).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
