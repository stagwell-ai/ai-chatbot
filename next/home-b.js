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

  /* ── the big titles: their words light up as they pass up the screen, the words named
     in data-words in colour (orange; data-hl="blue" for the mark's blue) — the statement's
     treatment on every big title (client, 2026-09-10) */
  document.querySelectorAll('[data-words]').forEach((st) => {
    const key = (w) => w.toLowerCase().replace(/[^a-z]/g, '');
    const HL = new Set((st.dataset.words || '').split(/\s+/).map(key).filter(Boolean));
    st.setAttribute('aria-label', st.textContent.trim());
    st.innerHTML = st.textContent.trim().split(/\s+/).map((w) => `<span class="w${HL.has(key(w)) ? ' hl' : ''}" aria-hidden="true">${w}</span>`).join(' ');
    const ws = [...st.querySelectorAll('.w')];
    if (RM) { ws.forEach((w) => w.classList.add('on')); return; }
    let near = false, tk = false;
    const lit = () => {
      tk = false; if (!near) return;
      const r = st.getBoundingClientRect(), p = Math.max(0, Math.min(1, (innerHeight * 0.86 - r.top) / (r.height + innerHeight * 0.3)));
      const n = Math.round(p * ws.length);
      ws.forEach((w, i) => w.classList.toggle('on', i < n));
    };
    new IntersectionObserver((es) => { near = es[0].isIntersecting; lit(); }, { rootMargin: '10% 0px' }).observe(st);
    addEventListener('scroll', () => { if (near && !tk) { tk = true; requestAnimationFrame(lit); } }, { passive: true });
  });

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

  /* ── the starting points' chip: its label turns every 2.6s; it opens the six
        as a list — choosing one is the real starting point (hero-agent.js) ── */
  const pick = document.getElementById('hbPick');
  if (pick) {
    const btn = pick.querySelector('.hb-pick__btn'), lab = pick.querySelector('.hb-pick__label'), icb = pick.querySelector('.hb-pick__ic');
    const tags = [...pick.querySelectorAll('.tag')];
    let k = 0, cur = lab.querySelector('.hb-pick__w');
    const open = (on) => { pick.classList.toggle('is-open', on); btn.setAttribute('aria-expanded', String(on)); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); open(!pick.classList.contains('is-open')); if (pick.classList.contains('is-open') && tags[0]) setTimeout(() => tags[0].focus({ preventScroll: true }), 60); });
    document.addEventListener('click', (e) => { if (!pick.contains(e.target)) open(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && pick.classList.contains('is-open')) { open(false); btn.focus(); } });
    tags.forEach((t) => t.addEventListener('click', () => open(false)));
    if (!RM && tags.length > 1) setInterval(() => {
      if (document.hidden || pick.classList.contains('is-open') || pick.matches(':hover')) return;
      k = (k + 1) % tags.length;
      const w = document.createElement('span'); w.className = 'hb-pick__w is-under'; w.textContent = tags[k].textContent.trim();
      lab.appendChild(w); void w.offsetWidth; w.classList.remove('is-under');
      const old = cur; cur = w; old.classList.add('is-out'); setTimeout(() => old.remove(), 500);
      const ic = tags[k].querySelector('svg'); if (ic && icb) icb.innerHTML = ic.outerHTML.replace('class="tag__ic"', 'class="hb-pick__svg"');
    }, 2600);
  }

  /* ── the product cards stack: as the next one comes up, the one it covers
        eases back a little (scale 1 → .94) ── */
  const stackCards = [...document.querySelectorAll('.hb-stack__card')];
  if (stackCards.length && !RM) {
    const inners = stackCards.map((c) => c.querySelector('.hb-stack__inner'));
    let near = false, tk = false;
    const upd = () => {
      tk = false; if (!near) return;
      const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72;
      /* depth: every card that has arrived on top of a card pushes it a step back — a little smaller,
         a little darker — so the stack reads in depth; the last card stays as it is (client) */
      const arrived = stackCards.map((c, i) => {
        if (!i) return 0;
        const stick = navH + 20 + i * 18, r = c.getBoundingClientRect();
        return Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight - stick)));
      });
      stackCards.forEach((c, i) => {
        let depth = 0; for (let k = i + 1; k < stackCards.length; k++) depth += arrived[k];
        inners[i].style.transform = depth ? `scale(${(1 - 0.045 * depth).toFixed(4)})` : '';
        inners[i].style.filter = depth ? `brightness(${Math.max(.72, 1 - 0.09 * depth).toFixed(3)})` : '';
      });
    };
    new IntersectionObserver((es) => { near = es[0].isIntersecting; upd(); }, { rootMargin: '20% 0px' }).observe(document.querySelector('.hb-stack'));
    addEventListener('scroll', () => { if (near && !tk) { tk = true; requestAnimationFrame(upd); } }, { passive: true });
  }

  /* ── the bar follows the scroll: it leaves after 14px of travel down and is
        back on any way up; always there at the top, with the menu open, and
        when the keyboard reaches it. Only hiding accumulates distance. ── */
  const bar = document.getElementById('nav');
  if (bar) {
    let lastY = scrollY, down = 0;
    addEventListener('scroll', () => {
      const y = scrollY, d = y - lastY; lastY = y;
      if (y <= 80 || document.body.classList.contains('menu-open')) { down = 0; bar.classList.remove('hb-hide'); return; }
      if (d > 0) { down += d; if (down > 14) bar.classList.add('hb-hide'); }
      else if (d < 0) { down = 0; bar.classList.remove('hb-hide'); }
    }, { passive: true });
    bar.addEventListener('focusin', () => bar.classList.remove('hb-hide'));
  }

})();

/* option B's thinking field, behind the hero and behind the close: the homepage's effect — a soft
   light travelling slowly with a short trail — only the dots it lights show (client: "just the
   dots, more visible, not all the pattern"); rings while a reply is on its way. */
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const field = (cv, busySel, STOPS, pic, GAIN = 1) => {
  if (!cv || !cv.getContext) return;
  /* over a picture, each dot reads how bright the picture is under it: on the white the blended
     dot turns near-black, so there it is drawn softer; on the colour it stays full (client) */
  let lum = null, LW = 0, LH = 0, geo = null, geoAt = -9;
  const readPic = () => {
    try {
      LW = 160; LH = Math.max(1, Math.round(LW * pic.naturalHeight / pic.naturalWidth));
      const oc = document.createElement('canvas'); oc.width = LW; oc.height = LH;
      const ox = oc.getContext('2d'); ox.drawImage(pic, 0, 0, LW, LH);
      const px = ox.getImageData(0, 0, LW, LH).data; lum = new Float32Array(LW * LH);
      for (let i = 0; i < LW * LH; i++) lum[i] = (.2126 * px[i * 4] + .7152 * px[i * 4 + 1] + .0722 * px[i * 4 + 2]) / 255;
    } catch (e) { lum = null; }
  };
  if (pic) { if (pic.complete && pic.naturalWidth) readPic(); else pic.addEventListener('load', readPic, { once: true }); }
  const place = () => {                                  /* where the picture's pixels land on the canvas (object-fit: cover) */
    const r = pic.getBoundingClientRect(), c = cv.getBoundingClientRect(), nw = pic.naturalWidth, nh = pic.naturalHeight;
    const k = Math.max(r.width / nw, r.height / nh), dw = nw * k, dh = nh * k;
    const op = getComputedStyle(pic).objectPosition.split(' ').map(v => parseFloat(v) / 100);
    geo = { x: r.left - c.left + (r.width - dw) * (isNaN(op[0]) ? .5 : op[0]), y: r.top - c.top + (r.height - dh) * (isNaN(op[1]) ? .5 : op[1]), w: dw, h: dh };
  };
  const soft = (x, y) => {                               /* 1 on the colour, .45 on the white */
    const u = Math.floor((x - geo.x) / geo.w * LW), v = Math.floor((y - geo.y) / geo.h * LH);
    if (u < 0 || v < 0 || u >= LW || v >= LH) return .45;
    return .45 + .55 * Math.max(0, Math.min(1, (.86 - lum[v * LW + u]) / .2));
  };
  /* the light travels between the page's key things (client: Book a demo → the chat → the
     Stagwell AI logo), easing into each and pausing a beat; their places are re-read every second */
  let P = null, pAt = -9;
  const stops = () => {
    const c = cv.getBoundingClientRect();
    return STOPS.map(([sel, fx, fy]) => {
      const el = sel && document.querySelector(sel), r = el && el.getBoundingClientRect();
      return (!r || !r.width) ? { x: W * fx, y: H * fy } : { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height / 2 };
    });
  };
  const ctx = cv.getContext('2d'), GAP = 12, TAU = Math.PI * 2;
  let W = 0, H = 0, pts = [], raf = 0, t0 = 0, last = 0, lift = 0, RGB = '11,18,32';
  const size = () => {
    const d = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d); ctx.setTransform(d, 0, 0, d, 0, 0);
    pts = []; for (let y = GAP / 2; y < H; y += GAP) for (let x = GAP / 2; x < W; x += GAP) pts.push(x, y);
    RGB = (getComputedStyle(cv).color.match(/\d+/g) || [11, 18, 32]).slice(0, 3).join(',');   /* the dots' colour comes from the CSS */
  };
  const frame = (t) => {
    if (!t0) t0 = t; const dt = Math.min(.05, (t - (last || t)) / 1000); last = t; const s = (t - t0) / 1000;
    lift += ((busySel && document.querySelector(busySel) ? 1 : 0) - lift) * Math.min(1, dt * 3);
    ctx.clearRect(0, 0, W, H);
    /* the light's way, stop to stop; the trail is the same way, a moment behind */
    if (s - pAt > 1) { P = stops(); pAt = s; }
    const over = !!(lum && pic);
    if (over && s - geoAt > .4) { place(); geoAt = s; }
    const SEG = 2.2, DWELL = .75, L = P.length, cyc = (SEG + DWELL) * L;
    const way = (tt) => {
      const t2 = ((tt % cyc) + cyc) % cyc, i = Math.floor(t2 / (SEG + DWELL)), f = t2 - i * (SEG + DWELL);
      const u0 = Math.min(1, f / SEG), u = u0 * u0 * (3 - 2 * u0), A = P[i], B = P[(i + 1) % L];
      const wob = Math.sin(tt * 1.3 + i) * 14;                              /* a little organic wander */
      return { x: A.x + (B.x - A.x) * u + wob, y: A.y + (B.y - A.y) * u - wob * .6 };
    };
    const R = Math.max(90, Math.min(W, H) * .16) * (1 + .1 * Math.sin(s * .9)), K = 1 / (2 * R * R), K2 = 1 / (2 * R * R * .72);
    const c = way(s), c2 = way(s - .9);
    const ox = W * .5, oy = H * .56, ringA = lift * .4;
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i], y = pts[i + 1];
      let dx = x - c.x, dy = y - c.y, a = .46 * Math.exp(-(dx * dx + dy * dy) * K);
      dx = x - c2.x; dy = y - c2.y; a += .2 * Math.exp(-(dx * dx + dy * dy) * K2);
      if (lift > .01) {
        const r = Math.hypot(x - ox, y - oy);
        for (let k = 0; k < 2; k++) { const ph = (s * 160 + k * 320) % 640; a += ringA * Math.exp(-Math.pow((r - ph) / 28, 2)) * (1 - ph / 640); }
      }
      if (over) a *= soft(x, y);
      a *= GAIN;
      if (a < .03) continue;   /* nothing where the light is not: no lattice */
      ctx.fillStyle = 'rgba(' + RGB + ',' + Math.min(.62, a).toFixed(3) + ')';
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!pts.length) size(); cv.classList.add('is-on'); if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
  addEventListener('resize', () => { if (raf) size(); });
  if ('IntersectionObserver' in window) new IntersectionObserver(es => {
    if (es[0].isIntersecting) start(); else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }, { threshold: 0 }).observe(cv);
  else start();
  };
  field(document.getElementById('hbThink'), '#agentThread .turnb--wait', [['.nav .btn--ink', .85, .05], ['#hbAsk', .5, .6], ['.nav__brand', .1, .05]], document.querySelector('.hero .hero__pic'));
  field(document.getElementById('hbEndThink'), null, [['#start .display--end', .5, .25], ['#askEnd', .5, .55], ['#start .ask-end__ways .btn', .4, .8], ['#callEnd', .6, .8]], null, .45);   /* subtle on the white (client) */   /* the close: B's field, not the homepage's */
})();

/* the scroll cue leaves as soon as the page moves, and comes back at the top */
(function () {
  const cue = document.querySelector('.hb-scrollcue');
  if (!cue) return;
  const upd = () => cue.classList.toggle('is-gone', scrollY > 40);
  addEventListener('scroll', upd, { passive: true }); upd();
})();
