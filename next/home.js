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
  /* a mouse, not a finger — the one place we may take focus unasked */
  const FINE_POINTER = matchMedia('(hover: hover) and (pointer: fine)').matches;

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
      /* the bar never hides any more (client, 2026-09-10: "they will say the
         navigation doesn't appear when you're scrolling… accessibility"). It
         is transparent over the very top of the hero only; from the first
         scroll it is the solid white bar, and it stays — down or up. */
      nav.classList.remove('is-hidden');
      nav.classList.toggle('is-stuck', y > 8);
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

  /* the "Global scale. Local expertise." band and its zooming banner came off
     the page on the client's word (2026-09-09); the parallax that drove the
     picture went with it. */

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

  /* the hero's stills used to turn over on a timer. The client asked for one
     picture and no cycling (2026-09-09), so the markup carries a single still
     and the cross-fade that turned them is gone with it. The other stills are
     still in /assets/img if the rotation is ever wanted back. */

  /* the film's panel lived here — a still that opened into the reel, with a
     play disc and pause/mute/close. The client's brief of 2026-09-09 takes the
     video off the homepage, so the strip is a picture and nothing more. The
     markup, the CSS and /assets/video/hero-reel.mp4 are still in the repo. */

  /* ── the conversation, in the hero's box. Your words join the thread above
        the field; the agent asks about your business and works towards the
        product that fits, then asks for your details so a specialist can
        call. The real exchange lives in hero-agent.js on top of engine.js /
        flow.js (client, 2026-09-09); what is left below is the drawing — the
        bubbles, the dots, the thinking lattice — and a placeholder exchange
        that only runs on a page without the flow. */
  const agentSec = $('#ask'), thread = $('#agentThread'),
        mini = $('#agentForm'), miniInput = $('#agentInput');
  if (agentSec && thread && mini && miniInput) {
    const state = { site: null, company: null, problem: null, busy: false, done: false };
    const CHIPS = ['Increase brand awareness', 'Reach Gen Z', 'Improve sales', 'Analyze competitors', 'Explore new markets'];
    const domainOf = (v) => {
      const m = v.match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})(?:[\/?#].*)?$/i);
      return m && !/\s/.test(v) ? m[1].toLowerCase() : null;
    };
    /* the thread scrolls inside the panel. A short turn sits at its foot; an
       answer taller than the window opens at its FIRST line — the ack and the
       first product — not its last, which left the reader on the question
       with no idea there was anything above it ("try it out and you will see
       how it jumps", client, 2026-09-10). A fade at the foot says there is more. */
    const more = () => thread.classList.toggle('is-more', thread.scrollTop + thread.clientHeight < thread.scrollHeight - 4);
    const settle = (el) => {
      const tall = el && el.classList.contains('turnb--ai') && !el.classList.contains('turnb--wait') && el.offsetHeight > thread.clientHeight - 8;
      /* offsetTop, not a client rect: a bubble still sliding in reports a rect
         that is mid-animation, and the thread would settle 16px off */
      if (tall) thread.scrollTop = el.offsetTop;
      else thread.scrollTop = thread.scrollHeight;
      more();
    };
    const add = (el) => { thread.appendChild(el); requestAnimationFrame(() => settle(el)); return el; };
    thread.addEventListener('scroll', more, { passive: true });
    const me = (text) => { const t = document.createElement('div'); t.className = 'turnb turnb--me'; t.textContent = text; return add(t); };
    /* the thinking field: not particles — a fine lattice of dots that never
       move, whose brightness travels through the grid as slow coherent
       waves (a processor, not dust). At rest one faint wave passes; while a
       reply is on its way, rings spread from where the answer will land. */
    /* one field per canvas: the hero chat's, and (homepage) the close's own —
       SEL lists the loop's stops as [selector, fallback x, fallback y] */
    const makeThink = (cv, SEL) => {
      if (!cv || !cv.getContext || REDUCED) return { ambient() {}, on() {}, off() {}, at() {} };
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
        /* a hidden element counts as missing: its rect is all zeros, and a stop
           there sent the blob off the canvas (the product pages keep the chat
           hidden until someone types, with the field under the whole section) */
        const mid = (sel, fx, fy) => { const el = sel && $(sel); const r = el && el.getBoundingClientRect(); if (!r || !r.width) return { x: W * fx, y: H * fy }; return { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height / 2 }; };
        stopsCache = SEL.map(([sel, fx, fy]) => mid(sel, fx, fy));
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
    };
    const think = makeThink($('#agentThink'), [['#agentForm', .5, .9], ['#agentTags', .4, .72], ['#agentThread', .5, .38], [null, .5, .12]]);
    think.ambient();   /* on from landing: the column is quietly alive */
    /* the homepage's "How can we help?" gets the same field behind it, resting
       (client, 2026-09-10: movement at the foot of the page too). Its loop
       walks the title, the field, Book a demo and Call me. */
    makeThink($('#endThink'), [['#start .display--end', .5, .25], ['#askEnd', .5, .55], ['#start .ask-end__ways .btn', .4, .8], ['#callEnd', .6, .8]]).ambient();
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const wait = (label) => { const t = document.createElement('div'); t.className = 'turnb turnb--ai turnb--wait'; t.innerHTML = '<i></i><i></i><i></i>' + (label ? '<span class="turnb__waitlabel">' + esc(String(label)) + '</span>' : ''); add(t); think.at(t); think.on(); return t; };
    const ai = (html, chips, go, onChip) => {
      const t = document.createElement('div'); t.className = 'turnb turnb--ai';
      if (html != null) t.innerHTML = '<div class="turnb__text">' + String(html).replace(/\?/g, '<span class="q">?</span>') + '</div>';
      if (go) {
        /* a link when it points somewhere, a lead button when it asks for a
           person — lead.js listens for [data-cta] on the document */
        let a;
        if (go.cta) { a = document.createElement('button'); a.type = 'button'; a.setAttribute('data-cta', go.cta); }
        else { a = document.createElement('a'); a.href = go.href; a.target = '_blank'; a.rel = 'noopener'; }   /* the conversation stays put */
        a.className = 'btn btn--ink turnb__go'; a.textContent = go.label;
        a.addEventListener('click', () => { if (state.site) { try { sessionStorage.setItem('sai-lead-site', state.site); } catch (e) {} } });
        t.appendChild(a);
      }
      if (chips) {
        const row = document.createElement('div'); row.className = 'turnb__chips';
        /* a chip is a label, or {label, value} from the flow; the click goes to
           onChip when there is one, else to the placeholder conversation */
        chips.forEach(cp => {
          const c = typeof cp === 'string' ? { label: cp, value: cp } : cp;
          const b = document.createElement('button'); b.type = 'button'; b.className = 'tag'; b.textContent = c.label;
          b.addEventListener('click', () => {
            if (b.disabled) return;
            row.querySelectorAll('.tag').forEach(o => { o.disabled = true; o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
            if (onChip) onChip(c); else send(c.value);
          });
          row.appendChild(b);
        });
        t.appendChild(row);
      }
      return add(t);
    };
    const reply = (html, chips, go) => new Promise(res => {
      const w = wait();
      setTimeout(() => { w.remove(); think.off(); ai(html, chips, go); res(); }, REDUCED ? 0 : 1300);
    });
    const send = async (raw) => {
      const v = (raw || '').trim();
      if (state.busy || state.done) return;
      agentSec.classList.add('is-chat');
      state.busy = true; miniInput.value = ''; grow();
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
    /* ── the drawing helpers, for hero-agent.js: the REAL conversation. When
          engine.js / flow.js are on the page, hero-agent.js drives this box
          with the six-question flow and the contact form; the placeholder
          exchange below only runs when they are not (client, 2026-09-09:
          "the AI chatbot needs to actually work"). ─────────────────────── */
    const goBtn = $('.askbox__go', mini);

    /* ── THE WHOLE CARD IS THE FIELD ──
       The box is one white card, but the line you type on is 25px of its
       148px: a click on the empty space below it landed on the form and the
       caret never appeared (client, 2026-09-10: "if i click the bottom half
       of this text area, i cannot type, because its technically below the
       area of the text box"). So the card focuses the field, wherever it is
       clicked — except on the things that are their own targets (the send
       disc, a chip, a link, the contact form's own inputs), and except when
       the click ends a text selection, which is someone copying a line the
       agent wrote, not asking for the caret. */
    mini.addEventListener('click', (e) => {
      if (miniInput.disabled) return;
      if (e.target.closest('button, a, input, textarea, select, label, [data-cta]')) return;
      try { if (String(getSelection() || '').trim()) return; } catch (err) { /* no selection API, carry on */ }
      miniInput.focus({ preventScroll: true });
    });

    /* ── THE DRAWN CARET HAS TO BE TRUE ──
       The empty box draws its own blinking caret (.askbox__caret) so it reads
       as ready to type in. On a fresh load it was the only caret there: the
       field was not focused, so the visitor saw it blinking, typed, and lost
       every keystroke (client, 2026-09-10: "there is a cursor blinking on the
       text, but when i type nothing happens because im not really focused on
       that … refresh the page and then try and type").

       Two ways to make the drawing true, rather than removing it:
         1. on a pointer device the field really does take the caret on
            arrival — the drawn one hides itself the moment the real one is
            there (:focus-within, home.css);
         2. whatever else has focus, the first letter typed goes INTO the
            field. That is what covers a touch keyboard, a visitor who clicked
            elsewhere first, and anything that steals focus later.
       Nothing is auto-focused on a touch screen: a keyboard sliding up over
       the page uninvited is worse than the caret it would explain. */
    /* ── THE LINE GROWS WITH THE WORDS ──
       "Spill-over text should create multiple lines on the text input, not
       bleed off the frame of the window" (client, 2026-09-10). The field is a
       one-row textarea; each keystroke sizes it to its text, up to six lines
       (home.css max-height), after which it scrolls inside itself. Enter sends,
       Shift+Enter breaks a line, as in every chat people already use. */
    const grow = () => {
      miniInput.style.height = 'auto';
      const max = parseFloat(getComputedStyle(miniInput).maxHeight) || Infinity;
      const h = miniInput.scrollHeight;
      miniInput.style.height = Math.min(h, max) + 'px';
      miniInput.classList.toggle('is-tall', h > max);
    };
    miniInput.addEventListener('input', grow);
    miniInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      e.preventDefault();
      if (!miniInput.disabled) mini.requestSubmit();
    });
    requestAnimationFrame(grow);

    if (FINE_POINTER) {
      const arrive = () => setTimeout(() => {
        const el = document.activeElement;
        if (miniInput.disabled || (el && el !== document.body)) return;
        try { miniInput.focus({ preventScroll: true }); } catch (e) {}
      }, 160);
      if (document.readyState === 'complete') arrive();
      else addEventListener('load', arrive, { once: true });
    }

    addEventListener('keydown', (e) => {
      if (miniInput.disabled || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!e.key || e.key.length !== 1) return;       /* a letter, not Tab / Escape / an arrow */
      const el = document.activeElement;
      /* somewhere real already has it — a field, the overlay, something the
         visitor chose. Leave it alone. */
      if (el && el !== document.body &&
          (el.isContentEditable || el.closest('input, textarea, select, [contenteditable], .chat-over'))) return;
      miniInput.focus({ preventScroll: true });
    });

    window.SAIHERO = {
      me, ai, wait, esc, think,
      open() { agentSec.classList.add('is-chat'); },
      placeholder(t) { miniInput.placeholder = t || ''; grow(); },
      /* the field is sized to its words again — after a send has emptied it */
      grow,
      /* the chips of every earlier question stop taking taps */
      settleChips() { $$('.turnb__chips .tag', thread).forEach(o => { o.disabled = true; }); },
      /* the composer closes: the conversation ended on the form */
      close(t) { miniInput.value = ''; miniInput.placeholder = t || ''; miniInput.disabled = true; miniInput.setAttribute('aria-disabled', 'true'); if (goBtn) goBtn.hidden = true; mini.classList.add('is-closed'); grow(); },
      focus() { miniInput.focus({ preventScroll: true }); },
      /* back to an empty box: the thread is emptied and the composer, which
         close() disabled when the conversation ended, takes typing again */
      clear(placeholder) {
        thread.classList.remove('is-more');
        thread.innerHTML = '';
        miniInput.value = '';
        miniInput.disabled = false;
        miniInput.removeAttribute('aria-disabled');
        miniInput.placeholder = placeholder || 'What do you need help solving?';
        grow();
        if (goBtn) goBtn.hidden = false;
        mini.classList.remove('is-closed');
        agentSec.classList.remove('is-chat');
      }
    };
    const REAL = !!window.SAIFLOW;

    /* the panel is alive when you arrive: the dots come up first, then the
       agent's line, then the starting points one after another — the chat
       opens the conversation rather than sitting there waiting (client). */
    const tagsBox = $('#agentTags');
    /* the panel no longer opens by thinking at you: the box asks its question
       in the placeholder and the starting points simply arrive (client). The
       dots still run while a real reply is on its way. */
    const intro = () => { if (tagsBox) tagsBox.classList.add('is-in'); };
    setTimeout(intro, REDUCED ? 0 : 420);

    if (!REAL) {
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
        heroInput.focus({ preventScroll: true });   /* the caret follows the question up the page */
        if (v) { heroInput.value = v; askEndInput.value = ''; heroMini.requestSubmit(); }
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
  const burger = $('#navBurger'), menu = $('#navMenu'), lbl = $('#navBurger .nav__blbl');
  if (burger && menu) {
    const closeMenu = () => {
      if (menu.hidden) return;
      menu.classList.remove('is-in');
      burger.setAttribute('aria-expanded', 'false');
      if (lbl) lbl.textContent = 'Menu';
      document.body.classList.remove('menu-open');
      const done = () => { menu.hidden = true; };
      REDUCED ? done() : setTimeout(done, 300);
    };
    const openMenu = () => {
      menu.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      if (lbl) lbl.textContent = 'Close';   /* the visible word is the button's name: it says what a tap does */
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
      if (!agentInput || !agentForm) { location.href = '/agent?q=' + encodeURIComponent(v); return; }
      input.value = '';
      /* on a page whose chat sits at the foot — the product pages, the listing,
         /s/{id} — the conversation opens there, in place of its field, and the
         page goes to it; on the homepage it is the hero's, at the top */
      const foot = agentForm.closest('#start');
      setTimeout(() => {
        if (foot) {
          const pp = $('#ppAsk'), box = $('#ask');
          if (pp) pp.hidden = true;
          if (box) box.hidden = false;
          foot.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
        } else scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
        /* the caret travels with the question: closeChat() has just handed
           focus back to the bar's bubble, and a visitor who carries on typing
           would otherwise type into nothing (client, 2026-09-10) */
        agentInput.focus({ preventScroll: true });
        agentInput.value = v; agentForm.requestSubmit();
      }, REDUCED ? 0 : 420);
    });
  });

  /* the companies field — a horizontal row of company cards under "One
     network. Endless expertise." — came off the page with its section
     (client, 2026-09-09), and the centre detection, drag-to-scroll, position
     line and card flip that drove it went with it. */

})();
