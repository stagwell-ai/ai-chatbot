/* ═══════════════════════════════════════════════════════════════════════════
   HOME.JS — the homepage's behaviour. No dependencies.

   Five things, each guarded so a missing element does nothing rather than
   throwing: the bar's state; the reveals; the film settling under the hero;
   the AI input handing off to the real agent; and the companies field.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── the headline comes in once the fonts are ready, not before ────────── */
  const ready = () => document.documentElement.classList.add('is-ready');
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
    .then(() => requestAnimationFrame(ready));
  setTimeout(ready, 1200);                          /* never wait forever on fonts */

  /* ── headlines are sized to the width, not to a guess ───────────────────
        Each .display starts at its CSS size (the ceiling) and comes down until
        its widest line fits the wrap. Lines never break inside themselves; the
        line structure IS the design. Re-run on resize and once fonts land. */
  const fitDisplays = () => {
    $$('.display').forEach(h => {
      h.style.fontSize = '';
      /* the title's OWN box — a capped column, not its parent's full width.
         Measuring the parent let a 170px line overflow a 760px column and the
         clipping wrapper cut "Ask Stagwell." to "Ask Stagw". */
      const box = h.getBoundingClientRect().width;
      const lines = $$('.ln__in', h);
      if (!box || !lines.length) return;
      const widest = Math.max(...lines.map(l => l.scrollWidth));
      if (widest > box) {
        const base = parseFloat(getComputedStyle(h).fontSize);
        h.style.fontSize = Math.floor(base * (box / widest) * 0.985) + 'px';
      }
    });
  };
  fitDisplays();
  addEventListener('resize', () => { clearTimeout(fitDisplays._t); fitDisplays._t = setTimeout(fitDisplays, 120); });
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(fitDisplays);

  /* ── the turning line above the title: every 2.6s the phrase lifts out and
        the next rises in. Reduced motion holds the first phrase. ───────── */
  const turn = $('#turn');
  if (turn && !REDUCED) {
    const ws = $$('.turn__w', turn); let i = 0;
    setInterval(() => {
      const prev = ws[i]; i = (i + 1) % ws.length; const next = ws[i];
      prev.classList.remove('is-on'); prev.classList.add('is-off');
      next.classList.remove('is-off'); next.classList.add('is-on');
      setTimeout(() => prev.classList.remove('is-off'), 750);
    }, 2600);
  }

  /* ── the light field behind the hero ──────────────────────────────────────
        Thin vertical bars across the width; three bands ride slow sine waves
        through them, each in a brand colour, and glow where they cross. Drawn
        additively on a 2D canvas at device resolution, at most 60fps, and only
        while the hero is on screen. Reduced motion draws one frame and stops. */
  const bg = $('#heroBg');
  if (bg && bg.getContext) {
    const ctx = bg.getContext('2d');
    /* the billboard's graphic: a band of upright light bars standing at the
       right of the screen, its colour turning through the brand along its
       length — blue where it begins, amber through the middle, orange at the
       edge — fading in from its inner end so it sits beside the words rather
       than crowding them. The band rides a slow wave and each bar breathes. */
    /* warm beside the words, cool at the edge — the billboard's run */
    const STOPS = [[255, 109, 36], [255, 184, 28], [255, 184, 28], [0, 156, 189], [0, 156, 189]];
    const mix = (u) => {
      const n = STOPS.length - 1, p = Math.min(n - 1e-6, Math.max(0, u * n)), i = Math.floor(p), f = p - i;
      const a = STOPS[i], b = STOPS[i + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    };
    /* full-height strokes: a long bar the height of the screen with soft ends,
       and a shorter brighter core that rides a slow wave inside it */
    const BANDS = [
      { base: .50, amp: .02,  freq: .6,  speed: .00009, phase: 0.0, len: .92, alpha: .55 },
      { base: .50, amp: .07,  freq: .9,  speed: .00013, phase: 1.4, len: .46, alpha: .70 },
    ];
    let W = 0, H = 0, dpr = 1, bars = 0, gap = 0, bw = 0, raf = 0, visible = true;
    const size = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      W = bg.clientWidth; H = bg.clientHeight;
      bg.width = Math.round(W * dpr); bg.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bars = Math.max(48, Math.round(W / 9));
      gap = W / bars; bw = Math.max(2, gap * .36);
    };
    const draw = (t) => {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < bars; i++) {
        const x = i * gap + gap / 2, u = i / bars;
        /* fade in from the inner edge: nothing at u=0, full by u≈.4 */
        const fade = Math.min(1, u / .42);
        const [r, gg, bl] = mix(((u + t * .000015) % 1 + 1) % 1);
        for (const b of BANDS) {
          const y = H * (b.base + b.amp * Math.sin(u * Math.PI * 2 * b.freq + t * b.speed + b.phase));
          const breathe = 0.72 + 0.28 * Math.sin(u * 6 + t * b.speed * 2.2 + b.phase);
          const len = H * b.len * (0.86 + 0.14 * breathe);
          const a = b.alpha * fade * breathe;
          const g = ctx.createLinearGradient(0, y - len / 2, 0, y + len / 2);
          g.addColorStop(0,   `rgba(${r|0},${gg|0},${bl|0},0)`);
          g.addColorStop(.12, `rgba(${r|0},${gg|0},${bl|0},${a})`);
          g.addColorStop(.88, `rgba(${r|0},${gg|0},${bl|0},${a})`);
          g.addColorStop(1,   `rgba(${r|0},${gg|0},${bl|0},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(x - bw / 2, y - len / 2, bw, len);
        }
      }
    };
    const loop = (t) => { raf = 0; if (!visible) return; draw(t); raf = requestAnimationFrame(loop); };
    size(); addEventListener('resize', () => { size(); if (REDUCED) draw(0); });
    if (REDUCED) draw(0);
    else {
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }, { threshold: 0 }).observe(bg);
      }
      raf = requestAnimationFrame(loop);
    }
  }

  /* ── the bar: solid once you have moved; white-on-dark over the AI section ─ */
  const nav = $('#nav'), ask = $('#ask');
  if (nav) {
    let ticking = false;
    const onScroll = () => {
      ticking = false;
      nav.classList.toggle('is-stuck', scrollY > 8);
      const dark = [$('#reel'), ask].filter(Boolean).some(el => {
        const r = el.getBoundingClientRect(); return r.top <= 72 && r.bottom >= 72;
      });
      nav.classList.toggle('on-dark', dark);
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  }

  /* ── reveals: once, when a thing enters the lower 88% of the viewport ──── */
  const rv = $$('.rv');
  if (rv.length) {
    if (REDUCED || !('IntersectionObserver' in window)) rv.forEach(el => el.classList.add('in'));
    else {
      const io = new IntersectionObserver((es) => {
        es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -12% 0px', threshold: .08 });
      rv.forEach(el => io.observe(el));
    }
  }

  /* ── the reel: inset on arrival, full-bleed by the time it has been scrolled
        through, and alive only once it is full. Progress is the sticky runner's
        travel; width, height and radius follow it; is-live flips at 92%. ─── */
  const reel = $('#reel'), stage = $('#reelStage');
  if (reel && stage) {
    let t = false;
    const tick = () => {
      t = false;
      const r = reel.getBoundingClientRect();
      const travel = r.height - innerHeight;
      const p = travel > 0 ? Math.min(1, Math.max(0, -r.top / travel)) : 1;
      const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   /* ease in-out */
      stage.style.setProperty('--reel-w', (58 + 42 * e).toFixed(2) + '%');
      stage.style.setProperty('--reel-h', (64 + 36 * e).toFixed(2) + 'vh');
      stage.style.setProperty('--reel-r', (10 - 10 * e).toFixed(1) + 'px');
      const live = p >= .92 || REDUCED;
      stage.classList.toggle('is-live', live);
      /* the film runs only while the stage is full; it rests otherwise */
      const v = $('#reelV');
      if (v) { if (live) { if (v.paused) v.play().catch(() => {}); } else if (!v.paused) v.pause(); }
    };
    addEventListener('scroll', () => { if (!t) { t = true; requestAnimationFrame(tick); } }, { passive: true });
    addEventListener('resize', tick);
    tick();
  }

  /* ── "Ask Stagwell" scrolls to the experience, then lands in the field ──── */
  $$('a[href="#ask"]').forEach(a => a.addEventListener('click', (e) => {
    if (!ask) return;
    e.preventDefault();
    ask.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    const input = $('#askInput');
    if (input) setTimeout(() => input.focus({ preventScroll: true }), REDUCED ? 0 : 700);
  }));

  /* ── the input: a tag puts its words in the field and nothing more. The
        arrow, or Enter, is what sends — to the real agent, by the form's own
        GET carrying q and autostart=1 to /next/agent. ───────────────────── */
  const form = $('#askForm'), input = $('#askInput'), tags = $$('.tag');
  if (form && input) {
    tags.forEach(b => b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      tags.forEach(o => o.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      input.value = on ? (b.dataset.q || b.textContent.trim()) : '';
      input.focus();
    }));
    /* typing something else un-picks the tag */
    input.addEventListener('input', () => {
      tags.forEach(o => { if (o.getAttribute('aria-pressed') === 'true' && input.value !== o.dataset.q) o.setAttribute('aria-pressed', 'false'); });
    });
    form.addEventListener('submit', (e) => {
      if (!input.value.trim()) { e.preventDefault(); input.focus(); }
    });
  }

  /* ── the companies field ─────────────────────────────────────────────────
        centre detection, drag to scroll, the position line, and the flip. ── */
  const field = $('#field'), track = $('#fieldTrack'), pos = $('#fieldPos');
  const cards = $$('.co', track);
  if (track && cards.length) {

    /* which card is nearest the middle of the viewport */
    let raf = false;
    const centre = () => {
      raf = false;
      const mid = innerWidth / 2;
      let best = null, bd = Infinity;
      cards.forEach(c => {
        const r = c.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - mid);
        if (d < bd) { bd = d; best = c; }
      });
      cards.forEach(c => c.classList.toggle('is-centre', c === best));
      if (pos) {
        const max = track.scrollWidth - track.clientWidth;
        const w = Math.max(.12, track.clientWidth / track.scrollWidth);
        pos.style.width = (w * 100).toFixed(2) + '%';
        pos.style.left = (max > 0 ? (track.scrollLeft / max) * (1 - w) * 100 : 0).toFixed(2) + '%';
      }
    };
    track.addEventListener('scroll', () => { if (!raf) { raf = true; requestAnimationFrame(centre); } }, { passive: true });
    addEventListener('resize', centre);

    /* start on the first card, centred */
    const toCard = (c, smooth) => {
      const r = c.getBoundingClientRect(), t = track.getBoundingClientRect();
      const target = track.scrollLeft + (r.left + r.width / 2) - (t.left + t.width / 2);
      track.scrollTo({ left: target, behavior: smooth && !REDUCED ? 'smooth' : 'auto' });
    };
    requestAnimationFrame(() => { toCard(cards[0], false); centre(); });

    /* drag with the mouse; the wheel already scrolls sideways on a trackpad,
       and a vertical wheel over the field is turned sideways too */
    let dragging = false, startX = 0, startL = 0, moved = 0;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      dragging = true; moved = 0; startX = e.clientX; startL = track.scrollLeft;
      track.classList.add('is-dragging'); track.setPointerCapture(e.pointerId);
    });
    track.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX; moved = Math.max(moved, Math.abs(dx));
      track.scrollLeft = startL - dx;
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false; track.classList.remove('is-dragging');
      /* settle on the nearest card */
      const mid = innerWidth / 2; let best = cards[0], bd = Infinity;
      cards.forEach(c => { const r = c.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - mid); if (d < bd) { bd = d; best = c; } });
      toCard(best, true);
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    /* No wheel capture. Turning a vertical wheel sideways is what made the
       page "scroll in place" over the field and stop dead at its last card.
       A trackpad still scrolls it sideways natively; a mouse drags it. */

    /* a slow drift of its own, so the field is never a still row. It rests
       while you are over it, dragging it, or in it with the keyboard, and it
       turns around at either end. */
    let drift = !REDUCED, dir = 1, resting = false, last = 0;
    const step = (now) => {
      if (drift && !resting && !dragging) {
        const dt = Math.min(48, now - (last || now)); last = now;
        const max = track.scrollWidth - track.clientWidth;
        let next = track.scrollLeft + dir * 0.022 * dt;
        if (next >= max) { next = max; dir = -1; } else if (next <= 0) { next = 0; dir = 1; }
        track.scrollLeft = next;
      } else last = now;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    track.addEventListener('pointerenter', () => { resting = true; });
    track.addEventListener('pointerleave', () => { resting = false; });
    track.addEventListener('focusin',  () => { resting = true; });
    track.addEventListener('focusout', () => { resting = false; });

    /* click: a card off-centre comes to the centre; the centred card flips.
       A drag is not a click. */
    cards.forEach(c => {
      const flip = () => {
        if (!c.classList.contains('is-centre')) { toCard(c, true); return; }
        const open = !c.classList.contains('is-open');
        cards.forEach(o => o.classList.remove('is-open'));
        c.classList.toggle('is-open', open);
      };
      c.addEventListener('click', (e) => {
        if (moved > 6) return;                         /* that was a drag */
        if (e.target.closest('.co__go')) return;       /* the link is the link */
        flip();
      });
      c.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
        if (e.key === 'ArrowRight' && c.nextElementSibling) { e.preventDefault(); c.nextElementSibling.focus(); toCard(c.nextElementSibling, true); }
        if (e.key === 'ArrowLeft' && c.previousElementSibling) { e.preventDefault(); c.previousElementSibling.focus(); toCard(c.previousElementSibling, true); }
        if (e.key === 'Escape') c.classList.remove('is-open');
      });
    });
  }
})();
