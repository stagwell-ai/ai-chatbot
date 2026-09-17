/* ── OPTION C ────────────────────────────────────────────────────────────────
   Option C's own script, loaded only by next/home-c.html, after the homepage's
   own scripts. The homepage (option A) never loads it.
   ─────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
})();

/* the first block's pictures: one fades into the next every three seconds, and only while the frame
   is on screen. With reduced motion the first one simply stays. Videos can replace them later. */
(function () {
  'use strict';
  const frame = document.querySelector('.hc-page .intro__media');
  if (!frame) return;
  const pics = [...frame.querySelectorAll('.intro__pic')];
  if (pics.length < 2) return;
  if (!pics.some(p => p.classList.contains('is-on'))) pics[0].classList.add('is-on');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let i = pics.findIndex(p => p.classList.contains('is-on')), timer = 0;
  const turn = () => { pics[i].classList.remove('is-on'); i = (i + 1) % pics.length; pics[i].classList.add('is-on'); };
  let held = false;
  const start = () => { if (!timer && !held) timer = setInterval(turn, 2800); };
  const stop = () => { if (timer) { clearInterval(timer); timer = 0; } };
  window.__hcFilm = {                      /* the film's button talks to the cycle through this */
    get paused() { return held; },
    toggle() { held = !held; if (held) stop(); else start(); return held; }
  };
  if ('IntersectionObserver' in window) new IntersectionObserver(es => es[0].isIntersecting ? start() : stop(), { threshold: .15 }).observe(frame);
  else start();
})();

/* the hero's dot field is drawn to the size its canvas reports, so it re-measures once the wider
   size above has been applied */
(function () {
  'use strict';
  if (!document.querySelector('.hc-page .hero .hero__think')) return;
  const nudge = () => dispatchEvent(new Event('resize'));
  if (document.readyState === 'complete') setTimeout(nudge, 60);
  else addEventListener('load', () => setTimeout(nudge, 60), { once: true });
})();

/* the film's scroll: from the card's shape to the whole screen, then it holds and scrolls away.
   Desktop only; reduced motion and phones keep the still card. */
(function () {
  'use strict';
  const stage = document.querySelector('.hc-page .intro__stage');
  if (!stage || document.body.classList.contains('hc-b')) return;   /* version B: the film is a still-sized card */
  const media = stage.querySelector('.intro__media');
  const nav = document.getElementById('nav') || document.querySelector('.nav');
  const wide = matchMedia('(min-width: 901px)');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const CARD_W = 900, CARD_H = 506, CARD_R = 22;
  let on = false, tick = 0;

  const paint = () => {
    tick = 0;
    const vh = innerHeight, vw = innerWidth;
    const top = stage.getBoundingClientRect().top;
    let p = -top / (vh * 0.35);                         /* it arrives card-sized, then grows once pinned */
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    const e = p * p * (3 - 2 * p);                      /* eased */
    const x = Math.max(0, (vw - CARD_W) / 2) * (1 - e);
    const y = Math.max(0, (vh - CARD_H) / 2) * (1 - e);
    media.style.clipPath = 'inset(' + y.toFixed(1) + 'px ' + x.toFixed(1) + 'px ' + y.toFixed(1) + 'px ' + x.toFixed(1) + 'px round ' + (CARD_R * (1 - e)).toFixed(1) + 'px)';
    /* the bar only borrows the film's colours while the film actually covers the screen */
    const b = media.getBoundingClientRect();
    const covering = e > .5 && b.top <= 1 && b.bottom >= vh - 1;
    if (nav) nav.classList.toggle('on-film', covering);
    stage.classList.toggle('is-full', covering);
  };
  const onScroll = () => { if (!tick) tick = requestAnimationFrame(paint); };

  const enable = () => {
    if (on) return; on = true;
    stage.classList.add('is-cine');
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    paint();
  };
  const disable = () => {
    if (!on) return; on = false;
    stage.classList.remove('is-cine');
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', onScroll);
    media.style.clipPath = '';
    if (nav) nav.classList.remove('on-film');
  };
  const decide = () => (wide.matches && !still.matches) ? enable() : disable();
  decide();
  wide.addEventListener('change', decide); still.addEventListener('change', decide);
})();

/* the film plays only while it is on screen */
(function () {
  'use strict';
  const film = document.querySelector('.hc-page video.intro__pic');
  if (!film) return;
  const play = () => { if (film.dataset.held === '1') return; const p = film.play(); if (p && p.catch) p.catch(() => {}); };
  /* a phone simply runs it from the moment the page opens; a desktop waits for the film to be seen */
  if (matchMedia('(max-width: 760px)').matches || document.body.classList.contains('hc-b')) {
    film.autoplay = true;                     /* a muted inline film may start on its own */
    film.preload = 'auto';
    play();
    ['loadedmetadata', 'loadeddata', 'canplay'].forEach(e => film.addEventListener(e, play));
    addEventListener('pageshow', play);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) play(); });
    return;
  }
  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver(es => (es[0].isIntersecting && film.dataset.held !== '1') ? play() : film.pause(), { threshold: .35 }).observe(film);
})();

/* Products: the tabs and the two arrows move one still at a time */
(function () {
  'use strict';
  const sec = document.querySelector('.hc-page .hc-port');
  if (!sec) return;
  const tabs = [...sec.querySelectorAll('.hc-port__tab')];
  const slides = [...sec.querySelectorAll('.hc-port__slide')];
  if (!tabs.length || tabs.length !== slides.length) return;
  let at = Math.max(0, slides.findIndex(s => s.classList.contains('is-on')));
  /* the stage keeps one shape for all four, so the section never changes height as the tabs turn */
  const stage = sec.querySelector('.hc-port__stage');
  const fitStage = () => { if (stage) stage.style.aspectRatio = ''; };
  const show = i => {
    at = (i + slides.length) % slides.length;
    tabs.forEach((t, n) => t.classList.toggle('is-on', n === at));
    slides.forEach((s, n) => s.classList.toggle('is-on', n === at));
    fitStage();
  };
  fitStage();
  /* it moves on by itself, the ink filling the live tab as its turn runs down; a hover, a touch
     or a click hands control back to the reader */
  const DWELL = 5500;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let timer = 0, held = false, seen = false;
  const arm = () => {
    const t = tabs[at];
    t.classList.remove('is-timing'); void t.offsetWidth;
    if (!still.matches) t.classList.add('is-timing');
  };
  let taken = false;                       /* once the reader picks a tab, the run is theirs */
  const start = () => { if (timer || held || taken || !seen || still.matches) return; arm(); timer = setInterval(() => { show(at + 1); arm(); }, DWELL); };
  const stop = () => { if (timer) { clearInterval(timer); timer = 0; } tabs.forEach(t => t.classList.remove('is-timing')); };
  const takeOver = () => { taken = true; stop(); };
  tabs.forEach((t, n) => t.addEventListener('click', () => { show(n); takeOver(); }));
  /* only the tab strip itself holds the turn — hovering the picture used to freeze it, and a
     pointer that left by scrolling never reported leaving, so it never started again */
  const strip = sec.querySelector('.hc-port__tabs');
  if (strip) {
    strip.addEventListener('pointerenter', () => { held = true; stop(); });
    strip.addEventListener('pointerleave', () => { held = false; start(); });
  }
  if ('IntersectionObserver' in window)
    new IntersectionObserver(es => {
      seen = es[0].isIntersecting;
      /* coming back into view must not restart a turn that is already running, nor one the
         reader has taken over — that is what made the live tab appear to begin again */
      if (seen) { held = false; start(); } else stop();
    }, { threshold: .25 }).observe(sec);
  else { seen = true; start(); }
  const prev = sec.querySelector('.hc-port__nav--prev');
  const next = sec.querySelector('.hc-port__nav--next');
  if (prev) prev.addEventListener('click', () => { show(at - 1); takeOver(); });
  if (next) next.addEventListener('click', () => { show(at + 1); takeOver(); });
  sec.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { show(at + 1); takeOver(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { show(at - 1); takeOver(); e.preventDefault(); }
  });
})();

/* the suite rail: the two round buttons step it, and each panel is fitted and cycled the way
   option B does it, with the same reduced-motion guard */
(function () {
  'use strict';
  const rail = document.querySelector('.hc-page .hcs__rail');
  if (!rail) return;
  document.querySelectorAll('.hc-page .hcs__round[data-rail]').forEach(b =>
    b.addEventListener('click', () => {
      const step = (rail.querySelector('li')?.getBoundingClientRect().width || 280) + 16;
      rail.scrollBy({ left: step * (+b.dataset.rail), behavior: 'smooth' });
    }));

  const panels = [...document.querySelectorAll('.hc-page .hcs__media .mk')];
  if (!panels.length) return;
  const fit = p => {        /* drawn at its natural size, then scaled and set in the picture's middle */
    const m = p.parentElement, w = m.clientWidth, h = m.clientHeight;
    if (!w || !h) return;
    const inset = Math.round(Math.max(6, w * .03));
    const s = Math.min(1, (w - 2 * inset) / p.offsetWidth);   /* width decides; the band lets a taller panel breathe upward */
    /* the panels sit on the band's floor, so the distance from panel to name is the same in every
       card however tall the panel happens to be */
    p.style.left = '50%';
    p.style.top = 'auto';
    p.style.bottom = '0';
    p.style.transformOrigin = 'bottom center';
    p.style.transform = 'translateX(-50%) scale(' + s.toFixed(4) + ')';
  };
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(es => es.forEach(e => {
      const p = e.target.classList.contains('mk') ? e.target : e.target.querySelector('.mk');
      if (p) fit(p);
    }));
    panels.forEach(p => { ro.observe(p.parentElement); ro.observe(p); });
  }
  panels.forEach(fit);
  addEventListener('resize', () => panels.forEach(fit));
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: .2 });
    panels.forEach(p => { p.classList.add('mk-arm'); io.observe(p); });
  }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.hc-page .hcs__media .mk[data-states]').forEach(p => {
    const total = +p.dataset.states || 1;
    if (total < 2) return;
    let at = 0, first = true;
    const paint = () => {
      p.querySelectorAll('[data-in]').forEach(e => {
        const on = e.dataset.in.split(' ').includes(String(at));
        const was = !e.hasAttribute('hidden');
        e.hidden = !on;
        if (on && !was && !first) { e.classList.remove('mk-pop'); void e.offsetWidth; e.classList.add('mk-pop'); }
      });
      first = false;
    };
    paint();
    let timer = 0;
    const start = () => { if (!timer) timer = setInterval(() => { at = (at + 1) % total; paint(); }, 2600); };
    const stop = () => { if (timer) { clearInterval(timer); timer = 0; } };
    if ('IntersectionObserver' in window)
      new IntersectionObserver(es => es[0].isIntersecting ? start() : stop(), { threshold: .2 }).observe(p);
    else start();
  });
})();

/* the voice chip reads as what it is: speaking, not typing. voice.js owns the label and rewrites it
   on every state change, so the wording is mapped here rather than in the shared script. */
(function () {
  'use strict';
  const btn = document.getElementById('voiceStart');
  if (!btn) return;
  const say = { 'Chat with me': 'Use your voice', 'Chat is live': 'Listening…' };
  const fix = () => {
    const label = btn.querySelector('span') || btn;
    const now = (label.textContent || '').trim();
    if (say[now]) label.textContent = say[now];
    const aria = btn.getAttribute('aria-label') || '';
    Object.keys(say).forEach(k => {
      if (aria.includes(k)) btn.setAttribute('aria-label', aria.replace(k, say[k]));
    });
  };
  fix();
  new MutationObserver(fix).observe(btn, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label'] });
})();

/* the film's own two controls, live only while it holds the screen */
(function () {
  'use strict';
  const film = document.querySelector('.hc-page video.intro__pic');
  const play = document.getElementById('filmPlay');
  const sound = document.getElementById('filmSound');
  if (!play || !sound) return;
  if (!film) {
    /* stills for now, videos later: the button holds the run, and there is no sound to offer */
    sound.hidden = true;
    const paintRun = () => {
      const paused = window.__hcFilm && window.__hcFilm.paused;
      play.setAttribute('aria-label', paused ? 'Play the film' : 'Pause the film');
      play.innerHTML = paused
        ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.6 18.5 12 8 18.4z" fill="currentColor"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="7" y="5.5" width="3.4" height="13" rx="1.2" fill="currentColor"/><rect x="13.6" y="5.5" width="3.4" height="13" rx="1.2" fill="currentColor"/></svg>';
    };
    play.addEventListener('click', () => { if (window.__hcFilm) window.__hcFilm.toggle(); paintRun(); });
    paintRun();
    return;
  }
  const paintPlay = () => {
    const on = !film.paused;
    play.setAttribute('aria-label', on ? 'Pause the film' : 'Play the film');
    play.innerHTML = on
      ? '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="7" y="5.5" width="3.4" height="13" rx="1.2" fill="currentColor"/><rect x="13.6" y="5.5" width="3.4" height="13" rx="1.2" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.6 18.5 12 8 18.4z" fill="currentColor"/></svg>';
  };
  play.addEventListener('click', () => {
    if (film.paused) { const p = film.play(); if (p && p.catch) p.catch(() => {}); film.dataset.held = ''; }
    else { film.pause(); film.dataset.held = '1'; }   /* a hand-paused film stays paused on scroll */
    paintPlay();
  });
  film.addEventListener('play', paintPlay);
  film.addEventListener('pause', paintPlay);
  paintPlay();
  sound.addEventListener('click', () => {
    film.muted = !film.muted;
    sound.setAttribute('aria-pressed', String(!film.muted));
    sound.setAttribute('aria-label', film.muted ? 'Turn the sound on' : 'Turn the sound off');
  });
})();

/* the chat's way back: once the hero's chat has scrolled away, the launcher arrives; it opens the
   same overlay the header's chat button used to open, which is why that button only goes dark. */
(function () {
  'use strict';
  /* the launcher's markup sits at the end of the page, after this script is parsed */
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  function init() {
  const box = document.getElementById('hcLaunch');
  const btn = document.getElementById('hcLaunchBtn');
  const chat = document.querySelector('.hc-page .hero .chat') || document.getElementById('ask');
  const opener = document.getElementById('navSearch');
  if (!box || !btn || !chat || !opener) return;

  const show = on => {
    if (on) { box.hidden = false; requestAnimationFrame(() => { box.classList.add('is-on'); chime(); armRetire(); }); }
    else { box.classList.remove('is-on'); setTimeout(() => { if (!box.classList.contains('is-on')) box.hidden = true; }, 420); }
  };
  if ('IntersectionObserver' in window)
    new IntersectionObserver(es => show(!es[0].isIntersecting), { threshold: 0 }).observe(chat);
  else show(true);

  btn.addEventListener('click', () => opener.click());

  /* it stays in front over the film too — the film's own controls sit in the other corner */

  /* the bubble says its piece, then leaves the pill on its own */
  const say = box.querySelector('.hc-launch__say');
  /* the message stays with the pill — it only goes if the reader closes it */
  const armRetire = () => { if (say && !box.dataset.hushed) say.classList.remove('is-gone'); };
  const shut = box.querySelector('.hc-launch__x');
  if (shut) shut.addEventListener('click', e => {
    e.stopPropagation();
    box.dataset.hushed = '1';
    if (say) say.classList.add('is-gone');
  });

  /* a soft two-note chime as it lands. Browsers only let sound play after a real gesture — and a
     trackpad scroll is not one — so the context is opened and kept warm on the first click or key.
     The chime belongs to the moment the helper arrives: if the sound cannot start then, it is
     dropped rather than saved up, so it never arrives out of nowhere a minute later. */
  let ctx = null, chimed = false;
  const wake = () => {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      try { ctx = new Ctx(); } catch (e) { return; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach(t =>
    addEventListener(t, wake, { passive: true }));

  const notes = () => {
    const at = ctx.currentTime;
    [[784, 0], [1175, .11]].forEach(([hz, when]) => {          /* G5 then D6, short and soft */
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = hz;
      g.gain.setValueAtTime(0, at + when);
      g.gain.linearRampToValueAtTime(.09, at + when + .02);
      g.gain.exponentialRampToValueAtTime(.0001, at + when + .4);
      o.connect(g).connect(ctx.destination);
      o.start(at + when); o.stop(at + when + .44);
    });
  };
  const ring = () => {
    if (!ctx) return;                                          /* never opened: stay silent */
    if (ctx.state === 'running') { notes(); return; }
    const asked = performance.now();                           /* a short grace, never a long wait */
    ctx.resume().then(() => {
      if (ctx.state === 'running' && performance.now() - asked < 400) notes();
    }).catch(() => {});
  };
  const chime = () => {
    if (chimed || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    chimed = true;
    ring();
  };
  /* while the overlay is open the launcher steps out of the way */
  const over = document.getElementById('chatOver');
  if (over) new MutationObserver(() => { box.style.display = over.hidden ? '' : 'none'; })
    .observe(over, { attributes: true, attributeFilter: ['hidden'] });
  }
})();

/* the rail no longer greets the reader: any movement of its own read as the carousel drifting
   while the page scrolled past. It sits still until the reader takes it. */


/* the full-screen chat takes the hero's voice control: the same teal round, icon only, beside the
   field — and the hero's own invitation as its placeholder */
(function () {
  'use strict';
  const init = () => {
    const field = document.querySelector('.hc-page .chat-over .ask__field');
    const input = document.getElementById('askInputOver');
    const hero = document.getElementById('agentInput');
    const voice = document.getElementById('voiceStart');
    if (!field || !input || !voice) return;
    if (hero && hero.placeholder) input.placeholder = hero.placeholder;

    if (field.querySelector('.chat-over__voice')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chat-over__voice';
    b.setAttribute('aria-label', voice.getAttribute('aria-label') || 'Use your voice');
    b.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">'
      + '<rect x="7.2" y="2.4" width="5.6" height="9.4" rx="2.8" fill="none" stroke="currentColor" stroke-width="1.6"/>'
      + '<path d="M4.6 9.4a5.4 5.4 0 0 0 10.8 0M10 14.8v2.6M7.6 17.4h4.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    b.addEventListener('click', () => voice.click());
    field.insertBefore(b, field.querySelector('.ask__go'));
    /* it shows the live state the hero's chip shows */
    new MutationObserver(() => b.classList.toggle('is-live', voice.classList.contains('is-live')))
      .observe(voice, { attributes: true, attributeFilter: ['class'] });
    if (voice.hidden) b.hidden = true;          /* browsers that cannot do voice hide both */
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

/* the overlay's starting points break three and three, as the hero's do */
(function () {
  'use strict';
  const init = () => {
    const list = document.querySelector('.hc-page .chat-over .ask__tags');
    if (!list || list.querySelector('.tag__br')) return;
    const items = [...list.children];
    if (items.length < 5) return;
    const br = document.createElement('li');
    br.className = 'tag__br';
    br.setAttribute('aria-hidden', 'true');
    list.insertBefore(br, items[3]);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

/* the country list reads as a flag, a short name and the dial code, so the field needs less room
   and still says where the call comes from. Values are untouched, so the form behaves as before. */
(function () {
  'use strict';
  const say = {
    '1': '🇺🇸 US / CA +1', '44': '🇬🇧 UK +44', '972': '🇮🇱 IL +972', '49': '🇩🇪 DE +49',
    '33': '🇫🇷 FR +33', '34': '🇪🇸 ES +34', '39': '🇮🇹 IT +39', '31': '🇳🇱 NL +31',
    '61': '🇦🇺 AU +61', '55': '🇧🇷 BR +55', '52': '🇲🇽 MX +52', '91': '🇮🇳 IN +91',
    '81': '🇯🇵 JP +81', '65': '🇸🇬 SG +65', '971': '🇦🇪 AE +971'
  };
  const init = () => document.querySelectorAll('.hc-page .call__cc option').forEach(o => {
    const t = say[o.value];
    if (t) { o.dataset.long = o.textContent; o.textContent = t; }
  });
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

/* ═══ C's own thinking field ═══════════════════════════════════════════════════════════════════
   The shared script's loop walks the chat's own parts; the client wants the light to travel
   chat → top right (the bar's calls) → chat → top left (the mark) → chat → …, leading the eye in.
   Rather than change the stop list option A runs on, C paints its own field and hides that one. */
(function () {
  'use strict';
  const hero = document.querySelector('.hc-page .hero');
  const chat = document.querySelector('.hc-page .hero .chat');
  if (!hero || !chat) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const old = document.getElementById('agentThink');
  if (old) old.style.display = 'none';          /* the shared field steps aside on this page */

  const cv = document.createElement('canvas');
  cv.className = 'hc-think';
  cv.setAttribute('aria-hidden', 'true');
  hero.insertBefore(cv, hero.firstChild);
  const ctx = cv.getContext('2d');

  const GAP = 12, R = 190;                       /* the grid, and how far the light reaches */
  let pts = [], W = 0, H = 0, raf = 0, t0 = 0, seen = true;

  const size = () => {
    const d = Math.min(2, devicePixelRatio || 1);
    const r = hero.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    pts = [];
    for (let y = GAP / 2; y < H; y += GAP) for (let x = GAP / 2; x < W; x += GAP) pts.push({ x, y });
  };

  /* the stops, in the hero's own coordinates: the chat, then a corner, then the chat again */
  const stops = () => {
    const h = hero.getBoundingClientRect();
    const c = chat.getBoundingClientRect();
    const mid = { x: c.left - h.left + c.width / 2, y: c.top - h.top + c.height / 2 };
    const nav = document.getElementById('nav');
    const brand = document.querySelector('.hc-page .nav__brand');
    const call = document.querySelector('.hc-page .nav__acts .btn--ink');
    const pin = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width) return null;
      return { x: r.left - h.left + r.width / 2, y: r.top - h.top + r.height / 2 };
    };
    const TR = pin(call) || { x: W - 90, y: 40 };
    const TL = pin(brand) || { x: 90, y: 40 };
    return [mid, TR, TL];              /* a triangle: the chat, the bar's call, the mark */
  };

  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const LEG = 4.4, DWELL = .9;                   /* seconds travelling, seconds resting */

  const frame = now => {
    raf = 0;
    if (!t0) t0 = now;
    const s = (now - t0) / 1000;
    const S = stops(), span = LEG + DWELL;
    const i = Math.floor(s / span) % S.length;
    const a = S[i], b = S[(i + 1) % S.length];
    const u = Math.min(1, (s % span) / LEG);
    const x = a.x + (b.x - a.x) * ease(u), y = a.y + (b.y - a.y) * ease(u);

    ctx.clearRect(0, 0, W, H);
    for (const p of pts) {
      const dx = p.x - x, dy = p.y - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > R) continue;
      const k = 1 - d / R;
      ctx.globalAlpha = .34 * k * k;
      ctx.fillStyle = '#0B1220';
      const s = 1.6 + k * .8;                    /* small squares, not dots */
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.round(s), Math.round(s));
    }
    ctx.globalAlpha = 1;
    if (seen) raf = requestAnimationFrame(frame);
  };

  const start = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

  size();
  addEventListener('resize', () => { size(); });
  if ('IntersectionObserver' in window)
    new IntersectionObserver(es => { seen = es[0].isIntersecting; seen ? start() : stop(); },
      { threshold: 0 }).observe(hero);
  start();
})();

/* the suite runs as a marquee: the cards are doubled so the loop never shows a seam, and the run
   stops under the pointer. The round buttons still nudge it. */
(function () {
  'use strict';
  const rail = document.querySelector('.hc-page .hcs__rail');
  if (!rail) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const items = [...rail.children];
  if (!items.length || rail.dataset.doubled) return;
  items.forEach(li => {
    const copy = li.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    copy.querySelectorAll('a,button').forEach(el => el.setAttribute('tabindex', '-1'));
    rail.appendChild(copy);
  });
  rail.dataset.doubled = '1';

  const SPEED = 26;                      /* pixels a second: a drift, not a slide */
  let last = 0, raf = 0, held = false, seen = true;
  const half = () => rail.scrollWidth / 2;
  const step = now => {
    raf = 0;
    const dt = last ? Math.min(.05, (now - last) / 1000) : 0;
    last = now;
    if (!held && seen) {
      rail.scrollLeft += SPEED * dt;
      if (rail.scrollLeft >= half()) rail.scrollLeft -= half();
    }
    raf = requestAnimationFrame(step);
  };
  const start = () => { if (!raf) { last = 0; raf = requestAnimationFrame(step); } };
  const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

  rail.addEventListener('pointerenter', () => { held = true; });
  rail.addEventListener('pointerleave', () => { held = false; });
  rail.addEventListener('pointerdown', () => { held = true; });
  addEventListener('pointerup', () => { held = false; });
  if ('IntersectionObserver' in window)
    new IntersectionObserver(es => { seen = es[0].isIntersecting; seen ? start() : stop(); },
      { threshold: 0 }).observe(rail);
  start();
})();

/* on a phone the suite's "See every product" joins the arrows, on the far side of the same row */
(function () {
  'use strict';
  const sec = document.querySelector('.hc-page .hcs');
  if (!sec) return;
  const acts = sec.querySelector('.hcs__acts');
  const head = sec.querySelector('.hcs__head');
  const nav = sec.querySelector('.hcs__nav');
  if (!acts || !head || !nav) return;
  const phone = matchMedia('(max-width: 760px)');
  const place = () => {
    const home = phone.matches ? nav : head;
    if (acts.parentElement !== home) home.appendChild(acts);
  };
  place();
  phone.addEventListener('change', place);
})();

/* each suite card keeps a picture in its panel; it becomes the card's own ground on hover */
(function () {
  'use strict';
  document.querySelectorAll('.hc-page .hcs__card').forEach(card => {
    const img = card.querySelector('.hcs__media img');
    if (!img) return;
    const src = img.getAttribute('src');
    if (src) card.style.setProperty('--hcs-bg', 'url("' + src + '")');
  });
})();

/* the products menu reads as a clean list: a drawn mark, the name, the line under it */
(function () {
  'use strict';
  const MARK = {
    '/the-machine':
      '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/>' +
      '<rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><path d="M17 14v6M14 17h6"/>',
    '/targeting-machine':
      '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>',
    '/newvoices':
      '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/>',
    '/agent-cloud':
      '<path d="M7 18.5h9.5a4 4 0 0 0 .5-7.97A6 6 0 0 0 5.6 9.6 4.2 4.2 0 0 0 7 18.5z"/>'
  };
  document.querySelectorAll('.hc-page .nav__pitem').forEach(a => {
    const path = (a.getAttribute('href') || '').replace(/[?#].*$/, '');
    const d = MARK[path];
    const thumb = a.querySelector('.nav__pthumb');
    if (!d || !thumb || a.dataset.hcMark) return;
    a.dataset.hcMark = '1';
    const mark = document.createElement('span');
    mark.className = 'nav__pmark';
    mark.setAttribute('aria-hidden', 'true');
    mark.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
    thumb.replaceWith(mark);
  });
})();

/* title highlights: the hero's paints in once its lines have risen; every other one
   is filled by the scroll on the way down, and stays filled */
(() => {
  const hls = [...document.querySelectorAll('.hc-page .hl')];
  if (!hls.length) return;
  const arm = el => {
    el.style.setProperty('--hl-base', getComputedStyle(el).color);
    el.classList.add('hl--armed');
  };
  hls.forEach(arm);
  const timed = hls.filter(el => el.closest('.display--hero, .pp-title'));
  const scrub = hls.filter(el => !el.closest('.display--hero, .pp-title'));

  /* the transition switches on only after the words have settled blank, or they would first
     un-paint (from the default position) and then paint again */
  void document.body.offsetWidth;
  timed.forEach(el => el.classList.add('hl--timed'));
  const root = document.documentElement;
  const go = () => setTimeout(() => timed.forEach(el => el.classList.add('is-in')), document.querySelector('.display--hero') ? 1150 : 500);
  if (root.classList.contains('is-ready')) go();
  else new MutationObserver((m, o) => {
    if (root.classList.contains('is-ready')) { o.disconnect(); go(); }
  }).observe(root, { attributes: true, attributeFilter: ['class'] });

  /* 0 when the title's top is at 88% of the viewport, 1 by 52% */
  let raf = 0;
  const paint = () => {
    raf = 0;
    const vh = innerHeight;
    scrub.forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.height) return;
      const p = Math.min(1, Math.max(0, (vh * 0.88 - r.top) / (vh * 0.36)));
      /* it only ever fills: scrolling back up leaves the colour where it got to */
      if (p > (el._hlp || 0)) { el._hlp = p; el.style.setProperty('--hl-p', p.toFixed(3)); }
    });
  };
  const ask = () => { if (!raf) raf = requestAnimationFrame(paint); };
  /* titles drawn later (the products listing) join the scroll-driven set */
  window.hcHighlight = el => { if (!el || el.classList.contains('hl--armed')) return; arm(el); scrub.push(el); ask(); };
  addEventListener('scroll', ask, { passive: true });
  addEventListener('resize', ask);
  paint();
})();

/* Extensible: a dot grid with one drifting hub, white on dark, after Julian's reference.
   Dots near the hub swell and wire to it; the grid fades with distance. */
(() => {
  const cv = document.querySelector('.hc-page .why__dots');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DOT = '255,255,255';
  let W = 0, H = 0, S = 20, dots = [], raf = 0, on = false;
  const hub = { x: 0, y: 0, tx: 0, ty: 0, next: 0 };
  const hash = (a, b) => ((a * 73856093) ^ (b * 19349663)) >>> 0;

  const size = () => {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    if (!W || !H) return;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.max(22, Math.min(40, W / 9));
    dots = [];
    const ox = (W % S) / 2 + S / 2, oy = (H % S) / 2 + S / 2;
    for (let j = 0; j * S + oy < H; j++)
      for (let i = 0; i * S + ox < W; i++) dots.push({ x: ox + i * S, y: oy + j * S, h: hash(i, j) });
    hub.x = hub.tx = W / 2; hub.y = hub.ty = H / 2;
  };

  const retarget = t => {
    hub.tx = W * (0.3 + Math.random() * 0.4);
    hub.ty = H * (0.3 + Math.random() * 0.4);
    hub.next = t + 900 + Math.random() * 700;
  };

  const draw = t => {
    ctx.clearRect(0, 0, W, H);
    const R = S * 4, LINK = S * 2.9;
    if (t > hub.next) retarget(t);
    hub.x += (hub.tx - hub.x) * 0.06; hub.y += (hub.ty - hub.y) * 0.06;
    ctx.lineWidth = 1;
    for (const d of dots) {
      const dist = Math.hypot(d.x - hub.x, d.y - hub.y);
      if (dist < S * 0.9 || dist > LINK || d.h % 3 === 0) continue;
      ctx.strokeStyle = `rgba(${DOT},${(0.6 * (1 - dist / LINK) + 0.15).toFixed(3)})`;
      ctx.beginPath(); ctx.moveTo(hub.x, hub.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }
    for (const d of dots) {
      const near = 1 - Math.hypot(d.x - hub.x, d.y - hub.y) / R;
      if (near <= -0.3) continue;
      const a = Math.max(0.04, Math.min(0.6, near * 0.9 + 0.1));
      const r = 0.8 + Math.max(0, near) * 3;
      ctx.fillStyle = `rgba(${DOT},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 6.2832); ctx.fill();
    }
    ctx.fillStyle = `rgb(${DOT})`;
    ctx.beginPath(); ctx.arc(hub.x, hub.y, 6, 0, 6.2832); ctx.fill();
  };

  const loop = t => { raf = 0; draw(t); if (on && !still) raf = requestAnimationFrame(loop); };
  const start = () => { if (!raf && !still) raf = requestAnimationFrame(loop); };
  size(); draw(0);
  new ResizeObserver(() => { size(); draw(performance.now()); }).observe(cv);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => {
      on = es[0].isIntersecting;
      if (on) start(); else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }).observe(cv);
  } else { on = true; start(); }
})();

/* closing "Call my phone": a voice made of small squares, talking. Columns of tiles rise
   above and below a centre line; the envelope is loud in the middle and quiet at the ends,
   and the loudness comes in syllable-like bursts. call.js builds the button, so wait for it. */
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TINTS = ['0,156,189', '119,227,246', '255,109,36', '255,184,28'];

  /* o.center: the voice sits in the middle of a picture's place (New Voices, wherever its
     picture would be); o.bg paints the ground so it can stand in for that picture */
  const mount = (btn, o = {}) => {
    if (btn.querySelector(':scope > .call__voice')) return;
    const cv = document.createElement('canvas');
    cv.className = 'call__voice' + (o.center ? ' call__voice--pic' : '');
    cv.setAttribute('aria-hidden', 'true');
    if (o.after) o.after.insertAdjacentElement('afterend', cv); else btn.prepend(cv);
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, T = 6, G = 2, cols = [], raf = 0, on = false, lastPick = 0;

    const size = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height;
      if (!W || !H) return;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      T = o.center ? (H > 420 ? 5 : H > 260 ? 4 : 3) : (H > 140 ? 3 : 2.5); G = o.center ? T * 0.5 : 1.5;
      const n = Math.floor((W * (o.center ? 0.78 : 0.6)) / (T + G));
      cols = Array.from({ length: n }, (_, i) => {
        const u = i / (n - 1);
        /* loud in the middle, a thin tail at each end */
        const env = Math.pow(Math.sin(Math.PI * u), 1.6) * (0.75 + 0.25 * Math.sin(u * 17));
        return { env, up: 0, dn: 0, tu: 0, td: 0, seed: (i * 2654435761) >>> 0 };
      });
    };

    const pick = t => {
      /* syllables: a loudness that swells and breaks off, never quite silent */
      const s = t / 1000;
      const amp = 0.25 + 0.75 * Math.abs(Math.sin(s * 5.3) * Math.sin(s * 1.7 + 1.1));
      for (const c of cols) {
        c.tu = c.env * amp * (0.35 + Math.random() * 0.65);
        c.td = c.env * amp * (0.25 + Math.random() * 0.6);
      }
    };

    const draw = t => {
      if (t - lastPick > 95) { pick(t); lastPick = t; }
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (o.bg) {
        /* paint (and clip to) the host's own rounded shape, so the corners never square off */
        const rad = parseFloat(getComputedStyle(btn).borderBottomLeftRadius) || 0;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, 0, W, H, rad) : ctx.rect(0, 0, W, H); ctx.clip();
        ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, H);
      }
      const mid = Math.round(H * (o.mid || (o.center ? 0.5 : 0.6)) - T / 2);
      const rows = Math.floor((H * (o.center ? 0.36 : 0.33) - 8) / (T + G));
      const x0 = o.center ? (W - cols.length * (T + G)) / 2 : W - 24 - cols.length * (T + G);
      cols.forEach((c, i) => {
        c.up += (c.tu - c.up) * 0.28; c.dn += (c.td - c.dn) * 0.28;
        const x = x0 + i * (T + G);
        const nu = Math.round(c.up * rows), nd = Math.round(c.dn * rows);
        for (let k = -nd; k <= nu; k++) {
          const y = mid - k * (T + G);
          const h = (c.seed ^ (k * 40503)) >>> 0;
          const far = Math.abs(k) / (rows + 1);
          const tint = h % 9 === 0 ? TINTS[h % TINTS.length] : '255,255,255';
          const a = (k === 0 ? 0.75 : 0.35 + 0.5 * (1 - far)) * (0.6 + (h % 5) * 0.1);
          ctx.fillStyle = `rgba(${tint},${Math.min(1, a).toFixed(3)})`;
          ctx.fillRect(x, y, T, T);
        }
      });
      ctx.restore();
    };

    const loop = t => { raf = 0; draw(t); if (on && !still) raf = requestAnimationFrame(loop); };
    size(); pick(1200); cols.forEach(c => { c.up = c.tu; c.dn = c.td; }); draw(1200);
    new ResizeObserver(() => { size(); pick(performance.now()); draw(performance.now()); }).observe(cv);
    new IntersectionObserver(es => {
      on = es[0].isIntersecting;
      if (on && !still && !raf) raf = requestAnimationFrame(loop);
      else if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
    }).observe(cv);
  };

  window.hcVoice = (host, o) => mount(host, Object.assign({ center: true, bg: '#0B1220' }, o || {}));
  const find = () => {
    const btns = document.querySelectorAll('.hc-page .ask-end .call__btn');
    btns.forEach(mount);
    return btns.length;
  };
  if (!find()) {
    const mo = new MutationObserver(() => { if (find()) mo.disconnect(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
})();
