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


  /* ── the bar: it floats over the first screen and turns solid once you have
        moved. It used to go white-on-dark over the old dark Ask block and over
        the open film; both are gone, and `#ask` is the hero's WHITE chat panel
        now — so that test was making the bar white on white, which is what
        "the navigation is broken" was. No dark state on this page. ───────── */
  const nav = $('#nav'), hero = $('.hero');
  let syncNav = () => {};
  if (nav) {
    let ticking = false, lastY = scrollY, down = 0;
    const onScroll = () => {
      ticking = false;
      const y = scrollY, d = y - lastY; lastY = y;
      /* hide after 14px of downward travel past the bar's own height; show on
         ANY upward movement, and always at the top. Only hiding accumulates —
         accumulating both ways is what strands a bar off-screen. */
      if (d > 0) { down += d; if (y > 72 && down > 14) nav.classList.add('is-hidden'); }
      else if (d < 0) { down = 0; nav.classList.remove('is-hidden'); }
      if (y <= 8) { down = 0; nav.classList.remove('is-hidden'); }
      /* the white only comes on for a bar that is actually there, and never
         while you are on your way down the first screen: turning it white and
         sliding it away in the same breath is the flash the client saw the
         moment he started scrolling. Past the hero a visible bar is always
         solid, so it can never go white-on-white further down the page. */
      const heroEnd = hero ? hero.offsetHeight - 80 : 0;
      const solid = y > 8 && !nav.classList.contains('is-hidden') && (y > heroEnd || d <= 0);
      nav.classList.toggle('is-stuck', solid);
    };
    syncNav = onScroll;
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  }

  /* ── reveals: once, when a thing enters the lower 88% of the viewport ──── */
  /* the hero's own reveals go on load — the observer ignores the bottom 12%
     of the screen, and on a shorter window the buttons sat in that strip and
     never appeared */
  $$('.hero .rv').forEach(el => el.classList.add('in'));
  const rv = $$('.rv:not(.hero .rv)');
  if (rv.length) {
    if (REDUCED || !('IntersectionObserver' in window)) rv.forEach(el => el.classList.add('in'));
    else {
      const io = new IntersectionObserver((es) => {
        es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -12% 0px', threshold: .08 });
      rv.forEach(el => io.observe(el));
    }
  }

  /* ── the field's turning hint: the website first, then the five starting
        points, every 2.8s — the last lifts out, the next rises in. Runs only
        while the field is empty and unfocused (the hint is hidden then). ── */
  const HINTS = ['Maybe just start with your site.', 'Want to improve sales?', 'Need to analyze your competitors?', 'Trying to reach Gen Z?', 'Building brand awareness?', 'Exploring new markets?'];
  if (!REDUCED) $$('.ask-mini__hint').forEach(hint => {
    const hintInput = $('.ask-mini__input', hint.parentElement); if (!hintInput) return;
    /* the AI nudging, not labels: questions, and a way in.
       One phrase is live at a time — `cur`. The old rAF-driven version
       queued its fades while the tab was hidden and the interval kept
       appending, so on return several phrases switched on at once and sat
       stacked in the field. Now: no ticks while hidden, a style flush instead
       of rAF to start the transition, and every tick (and every return to
       the tab) removes anything that is not the live phrase. */
    let i = 0, busy = false, cur = hint.querySelector('.ask-mini__hint-w');
    const heal = () => { $$('.ask-mini__hint-w', hint).forEach(s => { if (s !== cur) s.remove(); }); if (cur) { cur.classList.remove('is-off'); cur.classList.add('is-on'); } busy = false; };
    const tick = () => {
      if (document.hidden || busy) return;
      if (document.activeElement === hintInput || hintInput.value) return;
      heal();
      busy = true;
      i = (i + 1) % HINTS.length;
      const w = document.createElement('span'); w.className = 'ask-mini__hint-w'; w.textContent = HINTS[i];
      hint.appendChild(w);
      const old = cur; cur = w;
      void w.offsetWidth;                                   /* flush, so the rise-in transitions from the hidden state */
      if (old) old.classList.replace('is-on', 'is-off');
      w.classList.add('is-on');
      setTimeout(() => { if (old) old.remove(); busy = false; }, 800);
    };
    setInterval(tick, 2800);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) heal(); });
  });

  /* ── the trust banner: the frame stays; the picture inside zooms with the
        scroll — 1.45 as the banner enters at the bottom, 1 as it leaves at
        the top. One function of position, nothing per-frame beyond that. ── */
  const banner = $('#trustBanner'), bannerPic = $('.trust__pic', banner || document);
  if (banner && bannerPic && !REDUCED) {
    let t = false;
    const tick = () => {
      t = false;
      const r = banner.getBoundingClientRect(), vh = innerHeight;
      if (r.bottom < 0 || r.top > vh) return;
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));   /* 0 entering → 1 leaving */
      bannerPic.style.setProperty('--zoom', (1.45 - .45 * p).toFixed(4));   /* 1.45 → 1: a zoom you can see */
    };
    addEventListener('scroll', () => { if (!t) { t = true; requestAnimationFrame(tick); } }, { passive: true });
    addEventListener('resize', tick);
    tick();
  }

  /* ── the suite's ways in: on a desktop, hovering a name shows its picture
        and line in the panel; on a phone each row carries its own, so the
        choosing is decoration. A click books (lead.js reads data-cta) or
        goes to a page (data-href). ───────────────────────────────────── */
  const suite = $('#suite');
  if (suite) {
    const items = $$('.suite__item', suite), pic = $('#suitePic'), line = $('#suiteLine');
    const choose = (b) => {
      if (b.classList.contains('is-on')) return;
      items.forEach(o => { o.classList.toggle('is-on', o === b); o.setAttribute('aria-selected', o === b ? 'true' : 'false'); });
      if (!pic || !line) return;
      line.textContent = b.dataset.line;
      if (pic.getAttribute('src') !== b.dataset.pic) {
        pic.classList.add('is-fading');
        setTimeout(() => { pic.src = b.dataset.pic; pic.onload = () => pic.classList.remove('is-fading'); }, REDUCED ? 0 : 200);
      }
    };
    items.forEach(b => {
      b.addEventListener('mouseenter', () => choose(b));
      b.addEventListener('focus', () => choose(b));
      b.addEventListener('click', () => { choose(b); if (b.dataset.href) location.href = b.dataset.href; });
    });
  }

  /* ── the slider: the stills in the strip turn over with a cross-fade —
        the first hands over sooner (4.5s after landing), then every 9s;
        with one still there is nothing to turn ────────────────────────────── */
  const slides = $$('#heroSlides .hero__pic');
  if (slides.length > 1 && !REDUCED) {
    let cur = 0;
    const turn = () => {
      const next = (cur + 1) % slides.length, prev = slides[cur];
      slides[next].classList.add('is-on');
      prev.classList.add('is-off'); prev.classList.remove('is-on');      /* keeps its zoom while it fades */
      setTimeout(() => prev.classList.remove('is-off'), 2200);
      cur = next;
    };
    setTimeout(() => { turn(); setInterval(turn, 9000); }, 4500);
  }

  /* the film's panel lived here — a still that opened into the reel, with a
     play disc and pause/mute/close. The client's brief of 2026-09-09 takes the
     video off the homepage, so the strip is a picture and nothing more. The
     markup, the CSS and /assets/video/hero-reel.mp4 are still in the repo. */

  /* ── the conversation, in its own section under the hero. Your words join
        the thread above the field; the agent answers in the page's voice and
        works towards the solution that fits, then hands you to a person — a
        demo, a call, or an expert. No report: that is postponed past V1
        (client, 2026-09-09). The agent's lines are placeholders until the
        client writes them. */
  const agentSec = $('#ask'), thread = $('#agentThread'),
        mini = $('#agentForm'), miniInput = $('#agentInput');
  if (agentSec && thread && mini && miniInput) {
    const state = { site: null, company: null, problem: null, busy: false, done: false };
    const CHIPS = ['Increase brand awareness', 'Reach Gen Z', 'Improve sales', 'Analyze competitors', 'Explore new markets'];
    const domainOf = (v) => {
      const m = v.match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})(?:[\/?#].*)?$/i);
      return m && !/\s/.test(v) ? m[1].toLowerCase() : null;
    };
    /* the thread scrolls inside the panel; the newest turn sits at its foot */
    const settle = () => { thread.scrollTop = thread.scrollHeight; };
    const add = (el) => { thread.appendChild(el); requestAnimationFrame(settle); return el; };
    const me = (text) => { const t = document.createElement('div'); t.className = 'turnb turnb--me'; t.textContent = text; return add(t); };
    /* the thinking field: not particles — a fine lattice of dots that never
       move, whose brightness travels through the grid as slow coherent
       waves (a processor, not dust). At rest one faint wave passes; while a
       reply is on its way, rings spread from where the answer will land. */
    const think = (() => {
      const cv = $('#agentThink'); if (!cv || !cv.getContext || REDUCED) return { ambient() {}, on() {}, off() {}, at() {} };
      const ctx = cv.getContext('2d'); let pts = [], raf = 0, W = 0, H = 0, t0 = 0, last = 0;
      let lift = 0, liftTarget = 0, ox = 0, oy = 0;
      const GAP = 12;   /* 22 read as too separated, then 16 still did: the closer the dots, the more the wave through them reads as movement (client) */
      const size = () => {
        const d = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight;
        cv.width = Math.round(W * d); cv.height = Math.round(H * d); ctx.setTransform(d, 0, 0, d, 0, 0);
        pts = [];
        for (let y = GAP / 2; y < H; y += GAP) for (let x = GAP / 2; x < W; x += GAP) pts.push({ x, y });
        if (!ox) { ox = W * .3; oy = H * .6; }
        stopsCache = null;
      };
      /* the loop's stops: the title, Call me, the chat field, the tags — as
         they actually sit; fractions of the canvas if any is missing */
      let stopsCache = null, stopsAt = -9;
      const stops = () => {
        if (stopsCache) return stopsCache;
        const c = cv.getBoundingClientRect();
        const mid = (sel, fx, fy) => { const el = $(sel); if (!el) return { x: W * fx, y: H * fy }; const r = el.getBoundingClientRect(); return { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height / 2 }; };
        stopsCache = [mid('#agentForm', .5, .9), mid('#agentTags', .4, .72), mid('#agentThread', .5, .38), { x: W * .5, y: H * .12 }];
        return stopsCache;
      };
      const frame = (t) => {
        if (!t0) t0 = t; const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
        const s = (t - t0) / 1000;
        lift += (liftTarget - lift) * Math.min(1, dt * 3);
        ctx.clearRect(0, 0, W, H);
        const base = .02 + lift * .02, ringA = lift * .30;
        /* the resting motion is a SHAPE, not a line: a soft blob, stretched
           a little along its way, that travels a loop through the column —
           the title, Call me, the chat field, the tags, the title again —
           easing into each and pausing a beat there, like attention moving.
           A fainter blob follows a moment behind: a short trail. */
        /* the panel's contents move as the conversation opens — the thread
           grows, the tags arrive — so the loop re-reads its stops every so
           often instead of keeping the ones it measured on an empty panel,
           which is what made the first breaths look wrong */
        if (s - stopsAt > 1.2) { stopsCache = null; stopsAt = s; }
        const P = stops();                                  /* the loop's stops, from the real elements */
        const SEG = 3.2, DWELL = .9, L = P.length, cyc = (SEG + DWELL) * L;
        const at = (time) => {
          const tt = ((time % cyc) + cyc) % cyc, i = Math.floor(tt / (SEG + DWELL)), f = tt - i * (SEG + DWELL);
          const A = P[i], B = P[(i + 1) % L];
          const u0 = Math.min(1, f / SEG), u = u0 * u0 * (3 - 2 * u0);     /* eased travel, then a dwell */
          const wob = Math.sin(time * 1.3 + i) * 18;                       /* a little organic wander */
          return { x: A.x + (B.x - A.x) * u + wob, y: A.y + (B.y - A.y) * u - wob * .6, dx: B.x - A.x, dy: B.y - A.y, moving: u0 < 1 ? 1 : 0 };
        };
        const c = at(s), c2 = at(s - .55);                                 /* the head and the trail */
        const R = 92 + 10 * Math.sin(s * .9), stretch = 1 + .35 * c.moving;   /* smaller and rounder (client: 'too big') */
        const len = Math.hypot(c.dx, c.dy) || 1, ux = c.dx / len, uy = c.dy / len;   /* along the way */
        const blob = (p, cx, cy, r, st) => {
          const px = p.x - cx, py = p.y - cy;
          const u = px * ux + py * uy, v = -px * uy + py * ux;             /* rotate into the way's frame */
          const su = r * st, sv = r / Math.sqrt(st);
          return Math.exp(-(u * u / (2 * su * su) + v * v / (2 * sv * sv)));
        };
        for (const p of pts) {
          let a = base + (1 - lift * .5) * (.11 * blob(p, c.x, c.y, R, stretch) + .05 * blob(p, c2.x, c2.y, R * .85, stretch));
          if (lift > .01) {
            /* rings from the origin: two, a beat apart, widening and fading */
            const r = Math.hypot(p.x - ox, p.y - oy);
            for (let k = 0; k < 2; k++) {
              const ph = ((s * 140 + k * 260) % 520);
              const ring = Math.exp(-Math.pow((r - ph) / 26, 2)) * (1 - ph / 520);
              a += ringA * ring;
            }
          }
          if (a < .012) continue;
          ctx.fillStyle = 'rgba(11,18,32,' + Math.min(.5, a).toFixed(3) + ')';
          ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
        }
        raf = requestAnimationFrame(frame);
      };
      const start = () => { if (!pts.length) size(); cv.classList.add('is-on'); if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
      addEventListener('resize', () => { if (raf) size(); });
      if ('IntersectionObserver' in window) new IntersectionObserver(es => {
        if (es[0].isIntersecting) { if (!raf) start(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; }
      }, { threshold: 0 }).observe(cv);
      return {
        ambient() { liftTarget = 0; start(); },
        on() { liftTarget = 1; start(); },
        off() { liftTarget = 0; },
        /* where the rings come from: the spot the reply will land */
        at(el) { const r = el.getBoundingClientRect(), c = cv.getBoundingClientRect(); ox = r.left - c.left + 40; oy = r.top - c.top + r.height / 2; }
      };
    })();
    think.ambient();   /* on from landing: the column is quietly alive */
    const wait = () => { const t = document.createElement('div'); t.className = 'turnb turnb--ai turnb--wait'; t.innerHTML = '<i></i><i></i><i></i>'; add(t); think.at(t); think.on(); return t; };
    const ai = (html, chips, go) => {
      const t = document.createElement('div'); t.className = 'turnb turnb--ai';
      t.innerHTML = '<div class="turnb__text">' + html.replace(/\?/g, '<span class="q">?</span>') + '</div>';   /* Geist's question mark */
      if (go) {
        /* a link when it points somewhere, a lead button when it asks for a
           person — lead.js listens for [data-cta] on the document */
        let a;
        if (go.cta) { a = document.createElement('button'); a.type = 'button'; a.setAttribute('data-cta', go.cta); }
        else { a = document.createElement('a'); a.href = go.href; }
        a.className = 'btn btn--ink turnb__go'; a.textContent = go.label;
        a.addEventListener('click', () => { if (state.site) { try { sessionStorage.setItem('sai-lead-site', state.site); } catch (e) {} } });
        t.appendChild(a);
      }
      if (chips) {
        const row = document.createElement('div'); row.className = 'turnb__chips';
        chips.forEach(cp => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tag'; b.textContent = cp; b.addEventListener('click', () => send(cp)); row.appendChild(b); });
        t.appendChild(row);
      }
      return add(t);
    };
    const esc = (s) => s.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    const reply = (html, chips, go) => new Promise(res => {
      const w = wait();
      setTimeout(() => { w.remove(); think.off(); ai(html, chips, go); res(); }, REDUCED ? 0 : 1300);
    });
    const send = async (raw) => {
      const v = (raw || '').trim();
      if (state.busy || state.done) return;
      agentSec.classList.add('is-chat');
      state.busy = true; miniInput.value = '';
      if (v) me(v);
      const d = v ? domainOf(v) : null;
      if (d) state.site = d;
      else if (v && !state.problem) state.problem = v;
      else if (v) state.company = v;
      if (state.site && !state.problem) {
        miniInput.placeholder = 'What do you need help solving?';
        await reply('Got it — I’m reading <b>' + esc(state.site) + '</b> now. What do you need help solving today?', CHIPS);
      } else if (state.problem && !state.site && !state.company) {
        miniInput.placeholder = 'Your website (optional)';
        await reply('Got it. What’s your company? A website works — it helps me point you to the right solutions.');
      } else {
        const who = state.site || state.company;
        state.done = true;
        /* the end of the conversation is a person, not a document */
        /* the hero no longer carries buttons under the box, so the way to a
           person is offered here, in the conversation itself (client) */
        await reply('Perfect — I have what I need' + (who ? ' for <b>' + esc(who) + '</b>' : '') + '. Book a session and we’ll take it from here.',
          null, { cta: 'session', label: 'Book a demo' });
      }
      state.busy = false;
      miniInput.focus({ preventScroll: true });
    };
    /* the panel is alive when you arrive: the dots come up first, then the
       agent's line, then the starting points one after another — the chat
       opens the conversation rather than sitting there waiting (client). */
    const tagsBox = $('#agentTags');
    /* the panel no longer opens by thinking at you: the box asks its question
       in the placeholder and the starting points simply arrive (client). The
       dots still run while a real reply is on its way. */
    const intro = () => { if (tagsBox) tagsBox.classList.add('is-in'); };
    setTimeout(intro, REDUCED ? 0 : 420);

    mini.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = miniInput.value.trim();
      /* an empty send only means something at "your website (optional)": skip it */
      if (!v && !(state.problem && !state.site && !state.company)) { miniInput.focus(); return; }
      send(v);
    });
    /* a starting point is the problem, said for you */
    $$('#agentTags .tag').forEach(b => b.addEventListener('click', () => send(b.dataset.q || b.textContent.trim())));
  }

  /* ── Call me: the button becomes the phone pill in its own place. Its
        width eases from the button's to the pill's and back; the chat field
        beside it takes up the difference. Sent, the pill shows the call's
        status. The request resolves here after a beat — the real call API
        goes where `place()` is. ────────────────────────────────────────── */
  $$('.call').forEach(call => {
    const callBtn = $('.call__btn', call), callForm = $('.call__form', call), callDone = $('.call__done', call),
          callCode = $('.call__cc', call), callNum = $('.call__num', call), callLine = $('.call__line', call), callTo = $('.call__to', call);
    if (!(callBtn && callForm && callDone && callCode && callNum && callLine)) return;
    const PILL = () => Math.min(360, Math.round(call.parentElement.getBoundingClientRect().width) || 360);   /* never wider than the row it sits in (a phone) */
    const setW = (px) => call.style.setProperty('--call-w', px + 'px');
    /* the button's own width is the resting one; measured once it has fonts */
    let restW = 0;
    const rest = () => { restW = Math.round(callBtn.getBoundingClientRect().width) || restW; setW(restW); };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(rest);
    const openPill = () => {
      if (!restW) rest();
      call.dataset.state = 'phone'; call.classList.remove('is-bad', 'is-placed'); setW(PILL());
      setTimeout(() => callNum.focus({ preventScroll: true }), 200);
    };
    const closePill = () => {
      call.dataset.state = 'idle'; setW(restW);
      callBtn.focus({ preventScroll: true });
    };
    callBtn.addEventListener('click', openPill);
    $$('.call__x', call).forEach(x => x.addEventListener('click', closePill));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && call.dataset.state !== 'idle') closePill(); });
    /* a tap elsewhere with nothing typed puts the button back */
    addEventListener('pointerdown', (e) => { if (call.dataset.state === 'phone' && !call.contains(e.target) && !callNum.value.trim()) closePill(); });
    callNum.addEventListener('input', () => call.classList.remove('is-bad'));
    addEventListener('resize', () => { if (call.dataset.state === 'idle') { call.style.removeProperty('--call-w'); rest(); } });
    /* +1 415 555 0134: ten digits as 3-3-4; otherwise groups of three, and a
       lone last digit joins the group before it */
    const pretty = (code, digits) => {
      let g = digits.length === 10 ? [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)] : (digits.match(/\d{1,3}/g) || [digits]);
      if (g.length > 1 && g[g.length - 1].length === 1) { g[g.length - 2] += g.pop(); }
      return '+' + code + ' ' + g.join(' ');
    };
    const place = (code, digits) => new Promise(res => setTimeout(res, REDUCED ? 0 : 1800));   /* ← the call API */
    callForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const digits = callNum.value.replace(/\D/g, '');
      if (digits.length < 6 || digits.length > 14) { call.classList.add('is-bad'); callNum.focus(); return; }
      const code = callCode.value;
      callLine.textContent = 'Calling you now…';
      callTo.textContent = 'Stagwell AI will call ' + pretty(code, digits);
      call.dataset.state = 'done';
      $('.call__x', callDone).focus({ preventScroll: true });
      await place(code, digits);
      callLine.textContent = 'Your call is on the way.';
      call.classList.add('is-placed');
    });
  });

  /* ── the closing field hands what you typed to the hero's conversation:
        the page scrolls back up and the words are sent there ─────────── */
  const askEnd = $('#askEnd'), askEndInput = $('#askEndInput'), heroMini = $('#agentForm'), heroInput = $('#agentInput');
  if (askEnd && askEndInput && heroMini && heroInput) {
    askEnd.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = askEndInput.value.trim();
      scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
      setTimeout(() => {
        if (v) { heroInput.value = v; askEndInput.value = ''; heroMini.requestSubmit(); }
        else heroInput.focus({ preventScroll: true });
      }, REDUCED ? 0 : 650);
    });
  }

  /* ── the chat over the page: the magnifier opens the Ask block full screen,
        in light. Close, or Escape. ────────────────────────────────────────── */
  const over = $('#chatOver'), overClose = $('#chatOverClose'), searchBtn = $('#navSearch');
  if (over && overClose && searchBtn) {
    let lastFocus = null;
    /* where it spreads from: the centre of the thing that asked */
    const originAt = (el) => {
      const r = el.getBoundingClientRect();
      over.style.setProperty('--ox', Math.round(r.left + r.width / 2) + 'px');
      over.style.setProperty('--oy', Math.round(r.top + r.height / 2) + 'px');
    };
    const openChat = (from) => {
      if (!over.hidden) return;
      originAt(from || searchBtn);
      lastFocus = document.activeElement;
      over.hidden = false; document.body.classList.add('chat-open');
      searchBtn.setAttribute('aria-expanded', 'true');
      fitDisplays();                                   /* it had no width while hidden */
      requestAnimationFrame(() => requestAnimationFrame(() => over.classList.add('is-in')));
      const input = $('.ask__input', over);
      setTimeout(() => (input || overClose).focus({ preventScroll: true }), REDUCED ? 0 : 200);
    };
    const closeChat = () => {
      if (over.hidden) return;
      over.classList.remove('is-in');
      const done = () => { over.hidden = true; document.body.classList.remove('chat-open'); };
      REDUCED ? done() : setTimeout(done, 760);
      searchBtn.setAttribute('aria-expanded', 'false');
      (lastFocus || searchBtn).focus({ preventScroll: true });
    };
    searchBtn.addEventListener('click', () => openChat(searchBtn));
    /* the phone's magnifier, inside the menu: the sheet closes behind it */
    const menuSearch = $('#menuSearch');
    if (menuSearch) menuSearch.addEventListener('click', () => openChat(menuSearch));
    overClose.addEventListener('click', closeChat);
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !over.hidden) closeChat(); });
  }

  /* ── the phone's menu: the sheet under the bar. The button crosses, the
        page holds still, Escape closes, and any link inside closes it as it
        does its own work. ─────────────────────────────────────────────── */
  const burger = $('#navBurger'), menu = $('#navMenu');
  if (burger && menu) {
    const closeMenu = () => {
      if (menu.hidden) return;
      menu.classList.remove('is-in');
      burger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
      const done = () => { menu.hidden = true; };
      REDUCED ? done() : setTimeout(done, 300);
    };
    const openMenu = () => {
      menu.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
      requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-in')));
    };
    burger.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
    menu.addEventListener('click', (e) => { if (e.target.closest('a,button')) closeMenu(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) closeMenu(); });
    /* back on a desktop the sheet has no business being open */
    addEventListener('resize', () => { if (innerWidth > 820) closeMenu(); });
  }

  /* ── "Ask Stagwell" (the bar, the footer) goes to the hero's field: the
        conversation lives there now ──────────────────────────────────────── */
  $$('a[data-ask]').forEach(a => a.addEventListener('click', (e) => {
    const sec = $('#ask'); if (!sec) return;
    e.preventDefault();
    scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
    const input = $('#agentInput');
    if (input) setTimeout(() => input.focus({ preventScroll: true }), REDUCED ? 0 : 600);
  }));

  /* ── the overlay's field: a tag puts its words in it, and the arrow or
        Enter hands the question to the agent section on this page. ─────── */
  $$('.ask__form').forEach(form => {
    const input = $('.ask__input', form), tags = $$('.tag', form.closest('.ask__in') || form.parentElement);
    if (!input) return;
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
    /* the overlay hands its question to the agent ON THIS PAGE: the visitor
       is not sent to another one (client, 2026-09-09). */
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) { input.focus(); return; }
      const agentInput = $('#agentInput'), agentForm = $('#agentForm');
      const over = form.closest('.chat-over');
      if (over) { const c = $('#chatOverClose'); if (c) c.click(); }
      if (!agentInput || !agentForm) { location.href = '/next/agent?q=' + encodeURIComponent(v); return; }
      input.value = '';
      setTimeout(() => {
        scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
        agentInput.value = v; agentForm.requestSubmit();
      }, REDUCED ? 0 : 420);
    });
  });

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

    /* the row starts at its own left edge, so the first picture is whole */
    const toCard = (c, smooth) => {
      const r = c.getBoundingClientRect(), t = track.getBoundingClientRect();
      const target = track.scrollLeft + (r.left + r.width / 2) - (t.left + t.width / 2);
      track.scrollTo({ left: target, behavior: smooth && !REDUCED ? 'smooth' : 'auto' });
    };
    requestAnimationFrame(() => { track.scrollLeft = 0; centre(); });

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
    /* it holds still for a moment first, so what you land on is the row as it
       was composed — not a picture already half cut by the drift */
    const HOLD = 2600, t0 = performance.now();
    const step = (now) => {
      if (drift && !resting && !dragging && now - t0 > HOLD) {
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
