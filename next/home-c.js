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
