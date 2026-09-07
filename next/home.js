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
      const box = h.parentElement.getBoundingClientRect().width;
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

  /* ── the bar: solid once you have moved; white-on-dark over the AI section ─ */
  const nav = $('#nav'), ask = $('#ask');
  if (nav) {
    let ticking = false;
    const onScroll = () => {
      ticking = false;
      nav.classList.toggle('is-stuck', scrollY > 8);
      if (ask) {
        const r = ask.getBoundingClientRect();
        nav.classList.toggle('on-dark', r.top <= 72 && r.bottom >= 72);
      }
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
