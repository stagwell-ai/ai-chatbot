/* ═══════════════════════════════════════════════════════════════════════════
   NAVDROP.JS — the "Products" dropdown in the bar (2026-09-10).

   A temporary way to reach the product pages while they are being built. The
   whole feature is this file, the <li class="nav__drop"> in the bar, the
   .menu__sub list in the phone menu and one block at the end of home.css —
   take those out and the bar is exactly what it was.

   Opens on hover with a mouse, on click or tap, and from the keyboard (the
   trigger is a real button). Closes on leaving, Escape, a click elsewhere,
   focus moving out, or a scroll.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const drop = document.querySelector('.nav__drop');
  if (!drop) return;
  const trig = drop.querySelector('.nav__droptrig');
  if (!trig) return;

  let t = 0, y0 = scrollY;
  const isOpen = () => drop.classList.contains('is-open');
  const set = (open) => {
    clearTimeout(t);
    drop.classList.toggle('is-open', open);
    trig.setAttribute('aria-expanded', String(open));
    if (open) y0 = scrollY;
  };

  /* a mouse opens it by hovering; a click then must not close what the hover
     just opened. A finger or the keyboard toggles it. */
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  drop.addEventListener('pointerenter', () => { if (fine.matches) set(true); });
  drop.addEventListener('pointerleave', () => {
    if (!fine.matches) return;
    clearTimeout(t); t = setTimeout(() => set(false), 140);
  });
  trig.addEventListener('click', (e) => {
    e.stopPropagation();
    set(fine.matches && e.detail > 0 ? true : !isOpen());   /* detail 0 = keyboard */
  });

  document.addEventListener('click', (e) => { if (!drop.contains(e.target)) set(false); });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) { set(false); trig.focus(); }
  });
  drop.addEventListener('focusout', (e) => { if (!drop.contains(e.relatedTarget)) set(false); });
  addEventListener('scroll', () => { if (isOpen() && Math.abs(scrollY - y0) > 40) set(false); }, { passive: true });
})();
