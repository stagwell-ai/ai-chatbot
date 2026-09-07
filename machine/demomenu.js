/* ═══════════════════════════════════════════════════════════════════════════
   DEMOMENU.JS — the demo chrome, collected (client, Sep 6)

   Three fixed pills — the HubSpot console, previous versions, demo control —
   sat over the page at all times, on every page, at every width. On a phone
   the lower two spanned 308px of a 375px screen. They are demo chrome: they
   should be reachable and never in the way.

   They move into one button in the header, which opens the same kind of sheet
   the products index uses. The elements themselves are MOVED, not copied, so
   whatever handlers they already carry keep working and no label is written
   twice.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const SELECTORS = ['.democorner', '.vercorner', '.sc-pill'];

  const build = () => {
    const found = SELECTORS
      .map(s => document.querySelector(s))
      .filter(el => el && !el.closest('.demomenu__sheet'));
    if (!found.length) return false;

    const acts = document.querySelector('.nav__acts');
    if (!acts) return false;
    if (document.querySelector('.demomenu')) return true;

    const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'demomenu__btn';
    btn.setAttribute('aria-label', 'Demo controls');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML =
      '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round">' +
      '<path d="M3 6h9M15 6h2M3 14h5M11 14h6"/>' +
      '<circle cx="13.5" cy="6" r="2"/><circle cx="9.5" cy="14" r="2"/></svg>';

    const panel = document.createElement('div');
    panel.className = 'demomenu';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Demo controls');

    const sheet = document.createElement('div');
    sheet.className = 'demomenu__sheet';
    const title = document.createElement('p');
    title.className = 'demomenu__title';
    title.textContent = 'Demo controls';
    sheet.appendChild(title);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'demomenu__close';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML =
      '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg>';

    /* the originals move in, so their own handlers come with them */
    found.forEach(el => { el.classList.add('demomenu__item'); sheet.appendChild(el); });

    /* And the versions themselves, so you can reach one directly instead of
       going to the index and choosing there. The index link above still works
       — this is a shortcut past it, not a replacement. Labels and routes are
       the ones versions.html already uses. */
    const VERSIONS = [
      ['The Agent',     '/e.html'],
      ['The Platform',  '/d.html'],
      ['The Catalogue', '/c.html'],
      ['The Dashboard', '/machine/b.html'],
      ['The Workspace', '/machine/'],
    ];
    const vHead = document.createElement('p');
    vHead.className = 'demomenu__title demomenu__title--sub';
    vHead.textContent = 'Versions';
    sheet.appendChild(vHead);
    VERSIONS.forEach(([name, href]) => {
      const a = document.createElement('a');
      a.className = 'demomenu__item demomenu__item--version';
      a.href = href;
      a.textContent = name;
      /* the one you are on is not a place to go */
      if (location.pathname.replace(/\/index\.html$/, '/') === href) {
        a.setAttribute('aria-current', 'page');
        a.classList.add('is-here');
      }
      sheet.appendChild(a);
    });

    panel.append(close, sheet);
    document.body.appendChild(panel);
    acts.insertBefore(btn, acts.firstChild);

    let lock = 0;
    const shut = () => {
      if (panel.hidden) return;
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      scrollTo(0, lock);
      btn.focus();
    };
    const show = () => {
      lock = scrollY;
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      document.body.style.top = -lock + 'px';
      document.body.style.width = '100%';
      document.body.style.position = 'fixed';
    };

    btn.addEventListener('click', e => {
      e.stopPropagation();
      panel.hidden ? show() : shut();
    });
    close.addEventListener('click', shut);
    panel.addEventListener('click', e => { if (e.target === panel) shut(); });
    /* choosing one closes the sheet; the control's own handler still runs */
    sheet.addEventListener('click', e => {
      if (e.target.closest('.demomenu__item')) setTimeout(shut, 0);
    });
    addEventListener('keydown', e => { if (e.key === 'Escape') shut(); });
    void REDUCED;
    return true;
  };

  if (!build()) {
    const mo = new MutationObserver(() => { if (build()) mo.disconnect(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
})();
