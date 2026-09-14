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
  new IntersectionObserver(es => es[0].isIntersecting ? play() : film.pause(), { threshold: .1 }).observe(film);
})();
