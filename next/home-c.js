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
  const start = () => { if (!timer) timer = setInterval(turn, 3000); };
  const stop = () => { if (timer) { clearInterval(timer); timer = 0; } };
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
  if (!stage) return;
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
    let p = -top / (vh * 0.5);                          /* it arrives card-sized, then grows once pinned */
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
  if (!film || !('IntersectionObserver' in window)) return;
  const play = () => { const p = film.play(); if (p && p.catch) p.catch(() => {}); };
  new IntersectionObserver(es => (es[0].isIntersecting && film.dataset.held !== '1') ? play() : film.pause(), { threshold: .1 }).observe(film);
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
  const show = i => {
    at = (i + slides.length) % slides.length;
    tabs.forEach((t, n) => t.classList.toggle('is-on', n === at));
    slides.forEach((s, n) => s.classList.toggle('is-on', n === at));
  };
  /* it moves on by itself, the ink filling the live tab as its turn runs down; a hover, a touch
     or a click hands control back to the reader */
  const DWELL = 6000;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let timer = 0, held = false, seen = false;
  const arm = () => {
    const t = tabs[at];
    t.classList.remove('is-timing'); void t.offsetWidth;
    if (!still.matches) t.classList.add('is-timing');
  };
  const start = () => { if (timer || held || !seen || still.matches) return; arm(); timer = setInterval(() => { show(at + 1); arm(); }, DWELL); };
  const stop = () => { if (timer) { clearInterval(timer); timer = 0; } tabs.forEach(t => t.classList.remove('is-timing')); };
  const again = () => { stop(); start(); };
  tabs.forEach((t, n) => t.addEventListener('click', () => { show(n); again(); }));
  sec.addEventListener('pointerenter', () => { held = true; stop(); });
  sec.addEventListener('pointerleave', () => { held = false; start(); });
  if ('IntersectionObserver' in window)
    new IntersectionObserver(es => { seen = es[0].isIntersecting; seen ? start() : stop(); }, { threshold: .25 }).observe(sec);
  else { seen = true; start(); }
  const prev = sec.querySelector('.hc-port__nav--prev');
  const next = sec.querySelector('.hc-port__nav--next');
  if (prev) prev.addEventListener('click', () => { show(at - 1); again(); });
  if (next) next.addEventListener('click', () => { show(at + 1); again(); });
  sec.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { show(at + 1); again(); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { show(at - 1); again(); e.preventDefault(); }
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
  const fit = p => {                    /* drawn at its natural size, then scaled into the picture */
    const m = p.parentElement, w = m.clientWidth, h = m.clientHeight;
    if (!w || !h) return;
    const inset = Math.round(Math.max(10, w * .04));
    const s = Math.min(1, (w - 2 * inset) / p.offsetWidth, (h * .46) / p.offsetHeight);
    p.style.transform = 'scale(' + s.toFixed(4) + ')';
    p.style.left = inset + 'px';
    p.style.bottom = inset + 'px';
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
  if (!film || !play || !sound) return;
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
    if (on) { box.hidden = false; requestAnimationFrame(() => box.classList.add('is-on')); }
    else { box.classList.remove('is-on'); setTimeout(() => { if (!box.classList.contains('is-on')) box.hidden = true; }, 420); }
  };
  if ('IntersectionObserver' in window)
    new IntersectionObserver(es => show(!es[0].isIntersecting), { threshold: 0 }).observe(chat);
  else show(true);

  btn.addEventListener('click', () => opener.click());
  /* while the overlay is open the launcher steps out of the way */
  const over = document.getElementById('chatOver');
  if (over) new MutationObserver(() => { box.style.display = over.hidden ? '' : 'none'; })
    .observe(over, { attributes: true, attributeFilter: ['hidden'] });
  }
})();

/* the rail greets the reader: a short drift left, then back, so it reads as something that moves */
(function () {
  'use strict';
  const rail = document.querySelector('.hc-page .hcs__rail');
  if (!rail || !('IntersectionObserver' in window)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let done = false;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const drift = () => {
    if (done) return; done = true;
    const reach = Math.min(180, Math.max(0, rail.scrollWidth - rail.clientWidth));
    if (!reach) return;
    rail.style.scrollSnapType = 'none';          /* mandatory snap would jump the drift */
    const out = 900, back = 700, hold = 260, t0 = performance.now();
    const step = now => {
      const t = now - t0;
      if (t < out) rail.scrollLeft = reach * ease(t / out);
      else if (t < out + hold) rail.scrollLeft = reach;
      else if (t < out + hold + back) rail.scrollLeft = reach * (1 - ease((t - out - hold) / back));
      else { rail.scrollLeft = 0; rail.style.scrollSnapType = ''; return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  new IntersectionObserver(es => { if (es[0].isIntersecting) drift(); }, { threshold: .35 }).observe(rail);
})();
