/* ═══════════════════════════════════════════════════════════════════════════
   HOME-B.JS — homepage option B (/home-b) only. Loaded after home.js; option A
   never loads it. Plain JS on transforms and opacity, no library (the site has
   none and needs none for this).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');

  /* ── the hero's mouse parallax: the picture and its drifting copy move a few
        pixels apart as the pointer crosses the hero; eased, and asleep when
        nothing moves. Desktop pointers only; never the words or the chat. ── */
  const hero = document.getElementById('hero');
  const bg = hero && hero.querySelector('.hero__bg');
  const field = hero && hero.querySelector('.hb-field');
  if (hero && bg && !RM) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const loop = () => {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      bg.style.transform = `translate3d(${(cx * -12).toFixed(2)}px, ${(cy * -10).toFixed(2)}px, 0)`;
      if (field) field.style.translate = `${(cx * 22).toFixed(2)}px ${(cy * 18).toFixed(2)}px`;
      raf = (Math.abs(tx - cx) > 0.0015 || Math.abs(ty - cy) > 0.0015) ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    hero.addEventListener('pointermove', (e) => {
      if (!fine.matches || innerWidth <= 820) return;
      const r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5; kick();
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  }
  /* ── the film: scroll grows the frame; it plays once it is nearly full ─────
        Progress p runs 0→1 over the pin. 0–.5: the frame scales .46→1 (eased)
        and its corner 28→10px; .5–.8: it holds, playing; .8–1: the ground
        turns from the hero's navy to the next section's white, then the pin
        lets go and the page scrolls on. Playback starts muted when the frame
        is open, is never restarted by small scrolls, pauses when the section
        is out of sight, and a pause the visitor chose is respected. Phones
        and reduced motion get no pin (home-b.css); on a phone the frame
        eases in and plays muted while mostly on screen. */
  const film = document.getElementById('film');
  if (film) {
    const frame = film.querySelector('.hb-film__frame'), video = film.querySelector('video');
    const bPlay = film.querySelector('[data-act="play"]'), bMute = film.querySelector('[data-act="mute"]');
    const small = () => innerWidth <= 820 || RM;
    let loaded = false, userPaused = false, auto = false;
    const load = () => { if (loaded) return; loaded = true; video.preload = 'auto'; video.src = innerWidth <= 820 && video.dataset.srcSmall ? video.dataset.srcSmall : video.dataset.src; };   /* a phone gets the 720p cut */
    const play = () => { load(); const pr = video.play(); if (pr && pr.catch) pr.catch(() => {}); };
    const ui = () => { const on = !video.paused; bPlay.setAttribute('aria-pressed', String(on)); bPlay.setAttribute('aria-label', on ? 'Pause the film' : 'Play the film'); };
    video.addEventListener('play', ui); video.addEventListener('pause', ui);
    const toggle = () => { if (video.paused) { userPaused = false; auto = false; play(); } else { userPaused = true; video.pause(); } };
    bPlay.addEventListener('click', toggle);
    video.addEventListener('click', toggle);
    bMute.addEventListener('click', () => {
      video.muted = !video.muted;
      bMute.setAttribute('aria-pressed', String(!video.muted));
      bMute.setAttribute('aria-label', video.muted ? 'Unmute the film' : 'Mute the film');
      if (!video.muted && video.paused) { userPaused = false; play(); }
    });
    /* the file loads on the first scroll that brings the section into view —
       not with the page, where 36 MB would compete with the hero — and still
       a screen of scrolling before the frame is open */
    if ('IntersectionObserver' in window) new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { load(); io.disconnect(); } }, { rootMargin: '0px' }).observe(film);
    else load();

    const clamp = (v) => Math.max(0, Math.min(1, v)), lerp = (a, b, t) => a + (b - a) * t;
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    let ticking = false;
    const update = () => {
      ticking = false;
      if (small()) { frame.style.removeProperty('--hb-s'); frame.style.removeProperty('--hb-r'); film.style.removeProperty('background-color'); return; }
      const r = film.getBoundingClientRect(), total = r.height - innerHeight;
      if (total <= 0) return;
      const p = clamp(-r.top / total), e = ease(clamp(p / 0.5)), s = lerp(0.46, 1, e);
      frame.style.setProperty('--hb-s', s.toFixed(4));
      frame.style.setProperty('--hb-r', (lerp(28, 10, e) / s).toFixed(2) + 'px');
      const open = e > 0.92;
      film.classList.toggle('is-open', open);
      if (open && !userPaused && video.paused) { auto = true; play(); }
      if (p < 0.12 && auto && !video.paused) { video.pause(); auto = false; }
      const c = clamp((p - 0.8) / 0.2);
      film.style.backgroundColor = `rgb(${Math.round(lerp(7, 255, c))},${Math.round(lerp(20, 255, c))},${Math.round(lerp(29, 255, c))})`;
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    update();
    /* out of sight, it rests; on a phone, it plays muted while mostly visible */
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => {
      const en = es[0];
      if (small()) film.classList.toggle('is-seen', en.isIntersecting || film.classList.contains('is-seen'));
      if (!en.isIntersecting) { if (!video.paused) { video.pause(); auto = true; } return; }
      if (small() && !RM && en.intersectionRatio > 0.6 && !userPaused && video.paused) { auto = true; play(); }
    }, { threshold: [0, 0.2, 0.6] }).observe(frame);
  }

  /* ── "Introducing Stagwell AI": the picture opens (mask) as the section
        arrives, then drifts a little against the scroll (±36px). Desktop only;
        asleep when the section is out of view; none with reduced motion. ── */
  const mask = document.querySelector('.hb-mask');
  if (mask) {
    const pic = mask.querySelector('.intro__pic');
    if (RM || !('IntersectionObserver' in window)) mask.classList.add('in');
    else {
      new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { mask.classList.add('in'); io.disconnect(); } }, { threshold: 0.25 }).observe(mask);
      let near = false, tk = false;
      const drift = () => {
        tk = false;
        if (!near || innerWidth <= 1100) { pic.style.removeProperty('--hb-py'); return; }
        const r = mask.getBoundingClientRect(), mid = r.top + r.height / 2 - innerHeight / 2;
        pic.style.setProperty('--hb-py', (Math.max(-1, Math.min(1, mid / innerHeight)) * -36).toFixed(1) + 'px');
      };
      new IntersectionObserver((es) => { near = es[0].isIntersecting; if (near) drift(); }, { rootMargin: '20% 0px' }).observe(mask);
      addEventListener('scroll', () => { if (near && !tk) { tk = true; requestAnimationFrame(drift); } }, { passive: true });
    }
  }

  /* ── the statement: its words light up as it passes the middle of the screen */
  const st = document.querySelector('[data-words]');
  if (st) {
    const HL = new Set(['agentic', 'solutions']);
    st.innerHTML = st.textContent.trim().split(/\s+/).map((w) => `<span class="w${HL.has(w.toLowerCase().replace(/[^a-z]/g, '')) ? ' hl' : ''}">${w}</span>`).join(' ');
    const ws = [...st.querySelectorAll('.w')];
    if (RM) ws.forEach((w) => w.classList.add('on'));
    else {
      let near = false, tk = false;
      const lit = () => {
        tk = false; if (!near) return;
        const r = st.getBoundingClientRect(), p = Math.max(0, Math.min(1, (innerHeight * 0.82 - r.top) / (r.height + innerHeight * 0.35)));
        const n = Math.round(p * ws.length);
        ws.forEach((w, i) => w.classList.toggle('on', i < n));
      };
      new IntersectionObserver((es) => { near = es[0].isIntersecting; lit(); }, { rootMargin: '10% 0px' }).observe(st);
      addEventListener('scroll', () => { if (near && !tk) { tk = true; requestAnimationFrame(lit); } }, { passive: true });
    }
  }

  /* ── the flagships: pointing at a name, or scrolling to it, makes it the one */
  const flag = document.querySelector('.hb-flag');
  if (flag) {
    const items = [...flag.querySelectorAll('.hb-flag__item')], imgs = [...flag.querySelectorAll('.hb-flag__media img')];
    const set = (i) => {
      items.forEach((it, k) => it.classList.toggle('is-active', k === i));
      imgs.forEach((im, k) => im.classList.toggle('is-on', k === i));
    };
    items.forEach((it, k) => {
      it.addEventListener('pointerenter', () => { if (fine.matches) set(k); });
      it.addEventListener('focusin', () => set(k));
    });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => {
        es.forEach((e) => { if (e.isIntersecting && (!fine.matches || innerWidth <= 900)) set(items.indexOf(e.target)); });
      }, { rootMargin: '-45% 0px -45% 0px' });
      items.forEach((it) => io.observe(it));
    }
  }

  /* ── the suite rail: the arrows move it by a card */
  const rail = document.querySelector('.hb-rail');
  if (rail) document.querySelectorAll('[data-rail]').forEach((b) => b.addEventListener('click', () => {
    const card = rail.querySelector('li'); const step = card ? card.getBoundingClientRect().width + 24 : 400;
    rail.scrollBy({ left: step * Number(b.dataset.rail), behavior: RM ? 'auto' : 'smooth' });
  }));

})();
