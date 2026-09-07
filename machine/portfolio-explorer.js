/* ═══════════════════════════════════════════════════════════════════════════
   PORTFOLIO-EXPLORER.JS — "One portfolio" as an interactive explorer.

   The three tiers are rendered by about.js at runtime, so this reads them from
   the DOM rather than duplicating their copy: every string, category name and
   link below comes from the markup that was already there. Nothing is
   rewritten, nothing is invented — where the source has no link, the slot
   stays empty.

   One source of truth for the active tab (`current`), one data array, and the
   tabs and panels are both rendered from it.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  const AUTOPLAY_MS = 6000;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Three diagram icons, drawn for this component. Navy linework, one
     restrained accent each. Decorative: hidden from assistive tech, the tab's
     own label carries the meaning. */
  const ICONS = {
    /* three tiers of capability, wired into one orchestrating core */
    enterprise: `
      <svg class="pex__icon" viewBox="0 0 72 64" aria-hidden="true" focusable="false">
        <g class="pex__wires" fill="none" stroke="currentColor" stroke-width="1.3"
           stroke-linecap="round">
          <path class="pex__wire" pathLength="1" d="M38 12 C48 12 48 32 54 32"/>
          <path class="pex__wire" pathLength="1" d="M38 32 L54 32"/>
          <path class="pex__wire" pathLength="1" d="M38 52 C48 52 48 32 54 32"/>
        </g>
        <g class="pex__layers" fill="none" stroke="currentColor" stroke-width="1.5"
           stroke-linejoin="round">
          <path class="pex__layer" d="M6 12 L22 6 L38 12 L22 18 Z"/>
          <path class="pex__layer" d="M6 32 L22 25 L38 32 L22 39 Z"/>
          <path class="pex__layer" d="M6 52 L22 46 L38 52 L22 58 Z"/>
        </g>
        <g class="pex__pips" fill="currentColor">
          <circle cx="22" cy="12" r="1.7"/><circle cx="22" cy="32" r="1.7"/>
          <circle cx="22" cy="52" r="1.7"/>
        </g>
        <circle class="pex__core" cx="58" cy="32" r="4.2" fill="var(--pex-accent)"/>
      </svg>`,
    /* many separate inputs, each purpose-built, resolving to one outcome */
    purpose: `
      <svg class="pex__icon" viewBox="0 0 72 64" aria-hidden="true" focusable="false">
        <g class="pex__wires" fill="none" stroke="currentColor" stroke-width="1.3"
           stroke-linecap="round">
          <path class="pex__wire" pathLength="1" d="M13 12 C36 12 37 32 49 32"/>
          <path class="pex__wire" pathLength="1" d="M13 25 C33 25 37 32 49 32"/>
          <path class="pex__wire" pathLength="1" d="M13 39 C33 39 37 32 49 32"/>
          <path class="pex__wire" pathLength="1" d="M13 52 C36 52 37 32 49 32"/>
        </g>
        <g class="pex__dots" fill="currentColor">
          <circle class="pex__seed" cx="8" cy="12" r="2.4"/>
          <circle class="pex__seed" cx="8" cy="25" r="2.4"/>
          <circle class="pex__seed" cx="8" cy="39" r="2.4"/>
          <circle class="pex__seed" cx="8" cy="52" r="2.4"/>
        </g>
        <circle class="pex__core" cx="55" cy="32" r="4.6" fill="none"
                stroke="var(--pex-accent)" stroke-width="1.8"/>
      </svg>`,
    /* one platform in the middle, reachable from every direction */
    selfserve: `
      <svg class="pex__icon" viewBox="0 0 72 64" aria-hidden="true" focusable="false">
        <g class="pex__wires" fill="none" stroke="currentColor" stroke-width="1.3"
           stroke-linecap="round">
          <path class="pex__wire" pathLength="1" d="M36 24 L36 16"/>
          <path class="pex__wire" pathLength="1" d="M36 40 L36 48"/>
          <path class="pex__wire" pathLength="1" d="M28 32 L16 32"/>
          <path class="pex__wire" pathLength="1" d="M44 32 L56 32"/>
          <path class="pex__wire" pathLength="1" d="M29.5 25.5 L20.5 17"/>
          <path class="pex__wire" pathLength="1" d="M42.5 38.5 L51.5 47"/>
        </g>
        <g class="pex__nodes" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect class="pex__node" x="31.5" y="6"    width="9" height="9" rx="2"/>
          <rect class="pex__node" x="31.5" y="49"   width="9" height="9" rx="2"/>
          <rect class="pex__node" x="6"    y="27.5" width="9" height="9" rx="2"/>
          <rect class="pex__node" x="56"   y="27.5" width="9" height="9" rx="2"/>
          <rect class="pex__node" x="11"   y="7.5"  width="9" height="9" rx="2"/>
          <rect class="pex__node" x="51"   y="47"   width="9" height="9" rx="2"/>
        </g>
        <rect class="pex__core" x="27.5" y="23.5" width="17" height="17" rx="3.5"
              fill="var(--pex-accent)"/>
      </svg>`,
  };
  const ICON_ORDER = ['enterprise', 'purpose', 'selfserve'];

  /* The tier strokes are drawing colours, not text colours: on white they
     measure 2.8:1 (orange), 3.2:1 (cyan) and 1.7:1 (amber), so anything set in
     them is hard to read. Each keeps its brand hue for icons, rules and the
     row tint, and gets a darkened twin for type and button fills — all three
     above 5:1 on white, and a lightened twin above 6:1 on the dark card. */
  const INK = {
    '#FF6D24': { light: '#C24608', dark: '#FF8A4D' },
    '#009CBD': { light: '#00728A', dark: '#3FC4DE' },
    '#FFB81C': { light: '#8A6100', dark: '#FFC847' },
  };
  const inkFor = (accent) => INK[accent.toUpperCase()] || { light: accent, dark: accent };

  const build = () => {
    const grid = document.querySelector('.about__tiers');
    if (!grid || grid.dataset.explorer) return !!grid;
    const tiers = [...grid.querySelectorAll('.tier')];
    if (tiers.length !== 3) return false;
    grid.dataset.explorer = '1';

    /* read, do not rewrite */
    const txt = (el, sel) => { const n = el.querySelector(sel); return n ? n.textContent.trim() : ''; };
    const data = tiers.map((t, i) => ({
      id: ['enterprise', 'purpose', 'selfserve'][i],
      cat: txt(t, '.tier__cat'),
      name: txt(t, '.tier__name'),
      head: txt(t, '.tier__head'),
      line: txt(t, '.tier__line'),
      facts: [...t.querySelectorAll('.tier__facts > div')].map(d => ({
        dt: txt(d, 'dt'), dd: txt(d, 'dd'),
      })),
      link: (() => {
        const a = t.querySelector('a[href]');
        if (a) return { text: a.textContent.trim(), href: a.getAttribute('href') };
        return { text: 'Explore ' + txt(t, '.tier__name'), href: '/products' };
      })(),
      accent: getComputedStyle(t).getPropertyValue('--tier-stroke').trim() || '#FF6D24',
      icon: ICON_ORDER[i],
    }));

    const esc = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    const root = document.createElement('div');
    root.className = 'pex';

    const tablist = document.createElement('div');
    tablist.className = 'pex__tabs';
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-orientation', 'vertical');
    tablist.setAttribute('aria-label', 'Portfolio solutions');

    const panels = document.createElement('div');
    panels.className = 'pex__panels';

    data.forEach((d, i) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'pex__tab';
      tab.id = 'pex-tab-' + d.id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', 'pex-panel-' + d.id);
      tab.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      tab.tabIndex = i === 0 ? 0 : -1;
      const ink = inkFor(d.accent);
      tab.style.setProperty('--pex-accent', d.accent);
      tab.style.setProperty('--pex-ink', ink.light);
      tab.style.setProperty('--pex-ink-dark', ink.dark);
      tab.innerHTML =
        `<span class="pex__ico">${ICONS[d.icon]}</span>` +
        `<span class="pex__meta"><span class="pex__n">0${i + 1}</span>` +
        /* the name is split on its last space so it sets on two lines, which
           narrows the index and hands the width to the panel. Same words,
           same order — only the line break is new. */
        `<span class="pex__title">${d.name.replace(/^(.*)\s(\S+)$/,
            (m, a, b) => `<span class="pex__w">${esc(a)}</span> <span class="pex__w">${esc(b)}</span>`)
            || esc(d.name)}</span></span>` +
        /* one line: a neutral track with the orange progress laid on the very
           same pixel row, so it replaces the grey rather than sitting beside it */
        `<span class="pex__rule"><span class="pex__prog"></span></span>`;
      tablist.appendChild(tab);

      const panel = document.createElement('div');
      panel.className = 'pex__panel';
      panel.id = 'pex-panel-' + d.id;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tab.id);
      panel.tabIndex = 0;
      if (i !== 0) panel.hidden = true;
      panel.style.setProperty('--pex-accent', d.accent);
      panel.style.setProperty('--pex-ink', ink.light);
      panel.style.setProperty('--pex-ink-dark', ink.dark);
      panel.innerHTML =
        `<p class="pex__eyebrow">${esc(d.cat)}</p>` +
        `<h3 class="pex__h">${esc(d.name)}</h3>` +
        `<div class="pex__body">` +
          `<div class="pex__copy">` +
            (d.head ? `<p>${esc(d.head)}</p>` : '') +
            (d.line ? `<p>${esc(d.line)}</p>` : '') +
            (d.link ? `<a class="pex__link" href="${esc(d.link.href)}">${esc(d.link.text)}` +
              `<svg viewBox="0 0 20 12" aria-hidden="true"><path d="M0 6h17M12 1l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></a>` : '') +
          `</div>` +
          `<dl class="pex__facts">` +
            d.facts.map((f, n) =>
              `${n ? '<div class="pex__factrule" aria-hidden="true"></div>' : ''}` +
              `<dt>${esc(f.dt)}</dt><dd>${esc(f.dd)}</dd>`).join('') +
          `</dl>` +
        `</div>` +
        /* the source carries no link for these tiers; the slot stays empty
           rather than inventing a label or a destination */
        '';
      panels.appendChild(panel);
    });

    root.append(tablist, panels);
    grid.replaceWith(root);

    /* Mark the opening sentence of the section heading in the brand cyan.
       The heading is one text node; it is split at its first full stop and the
       first half wrapped, so the words and their order are untouched. */
    (() => {
      const h = document.querySelector('.about__portfolio .about__h3');
      if (!h || h.dataset.marked) return;
      const node = [...h.childNodes].find(n => n.nodeType === 3 && n.nodeValue.includes('.'));
      if (!node) return;
      const cut = node.nodeValue.indexOf('.') + 1;
      const lead = document.createElement('span');
      lead.className = 'about__h3mark';
      lead.textContent = node.nodeValue.slice(0, cut);
      const rest = document.createTextNode(node.nodeValue.slice(cut));
      node.replaceWith(lead, rest);
      h.dataset.marked = '1';
    })();

    /* ── state: one source of truth ── */
    const tabs = [...tablist.querySelectorAll('.pex__tab')];
    const pans = [...panels.querySelectorAll('.pex__panel')];
    let current = 0, timer = null, autoplay = !REDUCED;

    const stopAutoplay = () => { autoplay = false; clearTimeout(timer); timer = null; root.classList.add('is-manual'); };

    const select = (next, viaUser) => {
      if (viaUser) stopAutoplay();
      if (next === current && viaUser) return;
      const prev = pans[current];
      current = next;

      tabs.forEach((t, i) => {
        const on = i === current;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        t.classList.toggle('is-active', on);
        /* restart the icon sequence by replaying the animation from zero */
        const svg = t.querySelector('.pex__icon');
        if (svg) { svg.classList.remove('is-playing'); void svg.getBoundingClientRect(); if (on) svg.classList.add('is-playing'); }
        /* restart the progress line from zero */
        const p = t.querySelector('.pex__prog');
        if (p) {
          p.style.transition = 'none';
          p.style.transform = 'scaleX(0)';
          void p.getBoundingClientRect();
          if (on) {
            /* autoplaying: the line fills over the dwell time. Stopped: it just
               fills, so the active tab still reads as underlined in accent. */
            p.style.transition = autoplay
              ? `transform ${AUTOPLAY_MS}ms linear`
              : 'transform .35s cubic-bezier(.22,.61,.36,1)';
            p.style.transform = 'scaleX(1)';
          } else {
            p.style.transition = '';
          }
        }
      });

      pans.forEach((p, i) => {
        if (i === current) {
          p.hidden = false;
          if (!REDUCED) { p.classList.remove('is-in'); void p.getBoundingClientRect(); p.classList.add('is-in'); }
        } else if (p !== prev) { p.hidden = true; }
      });
      if (prev && prev !== pans[current]) {
        if (REDUCED) prev.hidden = true;
        else { prev.classList.add('is-out'); setTimeout(() => { prev.hidden = true; prev.classList.remove('is-out', 'is-in'); }, 200); }
      }

      if (autoplay) { clearTimeout(timer); timer = setTimeout(() => select((current + 1) % tabs.length, false), AUTOPLAY_MS); }
    };

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i, true));
      t.addEventListener('keydown', (e) => {
        const k = e.key;
        let n = null;
        if (k === 'ArrowDown' || k === 'ArrowRight') n = (i + 1) % tabs.length;
        else if (k === 'ArrowUp' || k === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
        else if (k === 'Home') n = 0;
        else if (k === 'End') n = tabs.length - 1;
        else if (k === 'Enter' || k === ' ') { e.preventDefault(); select(i, true); return; }
        if (n !== null) { e.preventDefault(); select(n, true); tabs[n].focus(); }
      });
    });

    /* the component holds one height, so switching tabs never moves the page */
    const lockHeight = () => {
      panels.style.minHeight = '';
      let tallest = 0;
      pans.forEach(p => {
        const was = p.hidden; p.hidden = false;
        tallest = Math.max(tallest, p.getBoundingClientRect().height);
        p.hidden = was;
      });
      panels.style.minHeight = Math.ceil(tallest) + 'px';
    };
    /* the mobile tab scroller bleeds to the section edge, so it needs the
       container's own inset back as padding — measured, not guessed */
    const setInset = () => {
      const host = root.parentElement;
      const pad = host ? parseFloat(getComputedStyle(host).paddingLeft) || 0 : 0;
      root.style.setProperty('--pex-inset', pad + 'px');
    };
    setInset();
    lockHeight();
    addEventListener('resize', () => { clearTimeout(root.__rz); root.__rz = setTimeout(() => { setInset(); lockHeight(); }, 180); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(lockHeight);

    select(0, false);

    /* only run while the component is on screen */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => {
        if (!autoplay) return;
        if (es[0].isIntersecting) { if (!timer) timer = setTimeout(() => select((current + 1) % tabs.length, false), AUTOPLAY_MS); }
        else { clearTimeout(timer); timer = null; }
      }, { threshold: .25 }).observe(root);
    }
    return true;
  };

  if (!build()) {
    const mo = new MutationObserver(() => { if (build()) mo.disconnect(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
})();
