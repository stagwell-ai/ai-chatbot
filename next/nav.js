/* ═══════════════════════════════════════════════════════════════════════════
   NAV.JS — the header's behaviour, for the pages that are not b.html.

   The nav markup is on every page, but the code that drives it lives in b.js,
   and b.js only loads on b.html. So on /products, /why, /solution and
   /campaign the header rendered and did nothing: it never picked up
   `is-stuck` when you scrolled, and the menu button toggled a class no one
   was listening for, so the drawer never opened.

   This is the same behaviour, lifted out so the four inner pages can share
   it. It refuses to run when b.js is present — binding both would toggle the
   drawer twice per click and it would never open.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.__navWired) return;
  window.__navWired = true;

  /* Who already owns the drawer. b.js does it on the homepage, and
     solution.js / campaign.js / ads.js each carry their own copy of the same
     toggle. Binding a second one is not additive — two toggles per click
     cancel out and the drawer never opens, which is the bug this file was
     written to fix, reintroduced. The bar's own scroll state has no such
     owner anywhere, so that part always runs. */
  const drawerOwned = ['/b.js', '/solution.js', '/campaign.js', '/ads.js']
    .some(f => document.querySelector('script[src*="' + f + '"]'));

  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  /* ── the bar's own state ──────────────────────────────────────────────── */
  /* transparent at rest, solid once you have moved. The header never hides:
     one that leaves while you are still reading is worse than one that stays. */
  const nav = $('#nav');
  if (nav) {
    /* the state is set IN the scroll handler, not deferred to the next frame.
       Deferring it is what put white type on a white band: on a jump — an
       anchor from the contents rail, Page Down, a trackpad fling — the page
       painted at the new offset while the bar was still wearing its
       over-the-picture treatment, and /products alternates dark and white
       bands, so that landed white on white. The toggle is one class; it does
       not need throttling. (products.css also scrims the transparent state,
       so even a frame that slips through stays readable.) */
    const onScroll = () => {
      nav.classList.toggle('is-stuck', Math.max(0, scrollY) > 8);
      nav.classList.remove('is-up');
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── the homepage's phone menu, where the page carries it ─────────────────
     The listing and the solution pages now have the homepage's bar and sheet
     (build-product-pages.py copies them). Same behaviour as home.js: the sheet
     under the bar, the button's word turning to "Close", Escape and a link
     closing it. The old drawer's wiring below does not apply to them. */
  const burger = $('#navBurger'), sheet = $('nav.menu#navMenu');
  if (burger && sheet) {
    const lbl = $('.nav__blbl', burger);
    const close = () => {
      if (sheet.hidden) return;
      sheet.classList.remove('is-in'); burger.setAttribute('aria-expanded', 'false');
      if (lbl) lbl.textContent = 'Menu';
      document.body.classList.remove('menu-open');
      setTimeout(() => { sheet.hidden = true; }, 300);
    };
    const open = () => {
      sheet.hidden = false; burger.setAttribute('aria-expanded', 'true');
      if (lbl) lbl.textContent = 'Close';
      document.body.classList.add('menu-open');
      requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add('is-in')));
    };
    burger.addEventListener('click', () => (sheet.hidden ? open() : close()));
    sheet.addEventListener('click', (e) => { if (e.target.closest('a,button')) close(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Esc') close(); });
    addEventListener('resize', () => { if (innerWidth > 1080) close(); });   /* these pages keep the burger to 1080 */
    return;
  }

  /* ── the drawer ───────────────────────────────────────────────────────── */
  if (drawerOwned) return;
  const closeNav = () => document.body.classList.remove('nav-open');
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  on($('#navMenu'), 'click', () => document.body.classList.toggle('nav-open'));
  on($('#navScrim'), 'click', closeNav);
  on($('#mnavClose'), 'click', closeNav);
  $$('.mnav__links a, .nav__links a').forEach(a => on(a, 'click', closeNav));
  $$('.mnav [data-cta], .mnav [data-new]').forEach(b => on(b, 'click', closeNav));

  /* escape closes it, and so does growing past the breakpoint with it open */
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') closeNav();
  });
  addEventListener('resize', () => { if (innerWidth > 980) closeNav(); });
})();
