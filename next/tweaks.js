/* ═══════════════════════════════════════════════════════════════════════════
   TWEAKS — type controls for the site you are looking at.

   A panel down the side of the running site: for every type role, sliders
   for size, weight, leading and tracking, and the page changing under your
   hand. Not a section in a page and not part of any design — an instrument
   for the person building the site. "In every website development... after
   this, we do tweaks."

   THREE RULES IT KEEPS:
   1. OFF UNTIL TOUCHED. Every control opens on the value the site already
      has and emits nothing until moved. Opening the panel must not change
      the page.
   2. LOCAL UNTIL COPIED. Overrides live in this browser. COPY hands over
      the CSS; pasting it into ribbon.css is what makes a change real.
   3. INVISIBLE UNLESS ASKED. `?tweak=1` mounts it and is remembered, so it
      survives navigation; `?tweak=0` clears it. A visitor never sees it.

   The only site-specific thing in this file is the ROLES table: which
   selectors count as "the H1", "the card titles", and so on.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  const KEY = 'sw-tweaks', VALS = 'sw-tweaks-vals', OPEN = 'sw-tweaks-open', SHUT = 'sw-tweaks-shut', STYLE_ID = 'sw-tweaks-style';

  /* ── which text is which ─────────────────────────────────────────────── */
  const ROLES = [
    { id: 'h1',     label: 'Hero H1',        sel: '.hero2--band .display, #hero2Title',
      size: [20, 160, 1], lead: [.8, 1.8], track: [-.08, .08] },
    { id: 'h2',     label: 'Section titles', sel: 'h2, .about__title, .about__h3, .proof__h, .bcta__h, .crail__h',
      size: [16, 110, 1], lead: [.85, 1.7], track: [-.08, .08] },
    { id: 'h3',     label: 'Card titles',    sel: '.tier__name, .tier__h, .scard__t b, .fcard__t b, .callback__t b, h4',
      size: [12, 72, 1],  lead: [.9, 1.7],  track: [-.06, .08] },
    { id: 'stat',   label: 'Stat figures',   sel: '.about__stats dt, .stat dt, .stat__v',
      size: [16, 96, 1],  lead: [.8, 1.6],  track: [-.08, .06] },
    { id: 'chat',   label: 'Chat title',     sel: '.hero2__sub',
      size: [12, 40, .5], lead: [1, 1.8],   track: [-.05, .08] },
    { id: 'hint',   label: 'Chat hint',      sel: '.pick__hint',
      size: [10, 24, .5], lead: [1, 1.8],   track: [-.04, .08] },
    { id: 'eyebrow',label: 'Eyebrows',       sel: '.eyebrow, .fcard__k, .crail__k, .scard__k',
      size: [8, 18, .5],  lead: [1, 2],     track: [0, .3] },
    { id: 'body',   label: 'Body',           sel: 'p:not(.eyebrow):not(.hero2__sub):not(.pick__hint), .tier__facts dd, .scard__t i',
      size: [11, 28, .5], lead: [1, 2.2],   track: [-.04, .12] },
    { id: 'nav',    label: 'Nav links',      sel: '.nav__links a',
      size: [10, 20, .5], lead: [1, 2],     track: [-.04, .16] },
    { id: 'btn',    label: 'Buttons',        sel: '.btn, .pick__go, .nav__cta, .ctacard::before',
      size: [10, 20, .5], lead: [1, 2],     track: [-.04, .16] },
    { id: 'foot',   label: 'Footer links',   sel: '.bfoot__links a',
      size: [10, 20, .5], lead: [1, 2],     track: [-.04, .16] },
  ];
  const PROPS = [
    { key: 'size',  label: 'size',     prop: 'font-size',      unit: 'px' },
    { key: 'weight',label: 'weight',   prop: 'font-weight',    unit: '',   range: [100, 900, 100] },
    { key: 'lead',  label: 'leading',  prop: 'line-height',    unit: '',   step: .01 },
    { key: 'track', label: 'tracking', prop: 'letter-spacing', unit: 'em', step: .002 },
  ];
  const px = v => parseFloat(v) || 0;

  /* read the site's own value, in the control's unit */
  const read = (cs, p) => {
    if (p.key === 'size')   return Math.round(px(cs.fontSize) * 10) / 10;
    if (p.key === 'weight') return px(cs.fontWeight) || 400;
    const size = px(cs.fontSize) || 16;
    if (p.key === 'lead')   { const lh = cs.lineHeight; return (!lh || lh === 'normal') ? 1.2 : Math.round((px(lh) / size) * 100) / 100; }
    if (p.key === 'track')  { const ls = cs.letterSpacing; return (!ls || ls === 'normal') ? 0 : Math.round((px(ls) / size) * 1000) / 1000; }
    return 0;
  };
  const fmt = (p, n) => p.unit === 'em' ? `${n > 0 ? '+' : ''}${n.toFixed(3)}em`
                    : p.unit === 'px' ? `${Math.round(n * 10) / 10}px`
                    : `${Math.round(n * 100) / 100}`;
  const cssVal = (p, n) => p.unit === 'em' ? `${n.toFixed(3)}em`
                       : p.unit === 'px' ? `${Math.round(n * 10) / 10}px`
                       : `${Math.round(n * 100) / 100}`;
  /* the element a role reads its opening values from: the first thing on
     the page that matches (pseudo-elements can't be sampled; skip them) */
  const sample = sel => {
    for (const s of sel.split(',')) {
      const one = s.trim(); if (!one || one.includes('::')) continue;
      const el = document.querySelector(one); if (el) return el;
    }
    return null;
  };

  /* ── should it exist at all ──────────────────────────────────────────── */
  let want = false;
  try {
    const q = new URLSearchParams(location.search).get('tweak');
    const saved = localStorage.getItem(KEY) === '1';
    want = q === null ? saved : q === '1';
    if (q !== null) localStorage.setItem(KEY, q === '1' ? '1' : '0');
  } catch (e) { want = false; }
  if (!want) return;

  /* ── state ───────────────────────────────────────────────────────────── */
  const base = {};          /* the site's own values — what RESET returns to */
  const vals = {};          /* current slider values */
  let touched = {};         /* which controls were moved; only these are written */
  try { touched = JSON.parse(localStorage.getItem(VALS) || '{}') || {}; } catch (e) { touched = {}; }
  const idOf = (r, p) => `${r.id}-${p.key}`;
  /* remembered from an earlier visit: seed the values and write the sheet
     NOW, so a refresh shows the tweaked type from the first paint */
  Object.keys(touched).forEach(k => { if (typeof touched[k] === 'number') vals[k] = touched[k]; });

  /* `.a, .b::before` → `.a:not(#tw_), .b:not(#tw_)::before` */
  const boost = sel => sel.split(',').map(s => {
    s = s.trim(); if (!s) return s;
    const i = s.indexOf('::');
    return i === -1 ? s + ':not(#tw_)' : s.slice(0, i) + ':not(#tw_)' + s.slice(i);
  }).join(', ');
  const css = () => {
    const bySel = new Map();
    ROLES.forEach(r => PROPS.forEach(p => {
      const id = idOf(r, p); if (!(id in touched)) return;
      const v = vals[id]; if (v == null) return;
      /* !important in the output itself: the site's rules carry it, so a
         paste without it would lose exactly where the live panel won */
      const list = bySel.get(r.sel) || []; list.push(`  ${p.prop}: ${cssVal(p, v)} !important;`); bySel.set(r.sel, list);
    }));
    return [...bySel.entries()].map(([sel, d]) => `${boost(sel)} {\n${d.join('\n')}\n}`).join('\n\n');
  };
  /* one stylesheet, replaced wholesale, appended last; !important because the
     site's own rules use it everywhere */
  const write = () => {
    let tag = document.getElementById(STYLE_ID);
    const body = css();
    if (!body) { if (tag) tag.remove(); return; }
    if (!tag) { tag = document.createElement('style'); tag.id = STYLE_ID; document.head.appendChild(tag); }
    tag.textContent = body;
    try { localStorage.setItem(VALS, JSON.stringify(Object.fromEntries(Object.keys(touched).map(k => [k, vals[k]])))); } catch (e) {}
  };
  if (Object.keys(vals).length) {
    /* the tag is written from the remembered numbers straight away; the
       bookkeeping (touched → true) happens at mount */
    const early = document.createElement('style'); early.id = STYLE_ID;
    early.textContent = css();
    (document.head || document.documentElement).appendChild(early);
  }

  /* ── the panel ───────────────────────────────────────────────────────── */
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const panel = el('aside', 'tw'); panel.setAttribute('aria-label', 'Tweaks');
  const head = el('header', 'tw-head');
  const toggle = el('button', 'tw-toggle'); toggle.type = 'button'; toggle.title = 'Tweaks';
  toggle.append(el('span', 'tw-toggle__word', 'Tweaks'), el('span', 'tw-toggle__mark', 'T'));
  const acts = el('span', 'tw-acts');
  const resetBtn = el('button', 'tw-btn', 'Reset'); resetBtn.type = 'button';
  const copyBtn = el('button', 'tw-btn', 'Copy'); copyBtn.type = 'button';
  acts.append(resetBtn, copyBtn); head.append(toggle, acts);
  const body = el('div', 'tw-body');
  const out = el('pre', 'tw-out');
  const hint = el('p', 'tw-hint', 'Move a slider. Nothing is written until you do, and nothing leaves this browser until you copy it. Paste the CSS at the end of ribbon.css.');
  panel.append(head, body);

  const rows = {};
  ROLES.forEach(r => {
    const role = el('div', 'tw-role');   /* a div, not a section: the site pads every <section> */
    const h = el('button', 'tw-role__h'); h.type = 'button';
    h.append(el('span', null, r.label), el('small', null, r.sel.split(',')[0].trim()));
    let shut = []; try { shut = JSON.parse(localStorage.getItem(SHUT) || '[]') || []; } catch (e) {}
    if (shut.includes(r.id)) role.setAttribute('data-shut', '');
    h.addEventListener('click', () => {
      role.toggleAttribute('data-shut');
      try {
        let cur = JSON.parse(localStorage.getItem(SHUT) || '[]') || [];
        cur = role.hasAttribute('data-shut') ? [...new Set([...cur, r.id])] : cur.filter(x => x !== r.id);
        localStorage.setItem(SHUT, JSON.stringify(cur));
      } catch (e) {}
    });
    const list = el('div', 'tw-rows');
    PROPS.forEach(p => {
      const id = idOf(r, p);
      const row = el('p', 'tw-row');
      const label = el('label', 'tw-label'); label.htmlFor = 'tw-' + id;
      const name = el('span', null, p.label);
      const val = el('span', 'tw-val', '—');
      label.append(name, val);
      const input = el('input', 'tw-slider'); input.type = 'range'; input.id = 'tw-' + id;
      const rng = p.range || (p.key === 'size' ? r.size : p.key === 'lead' ? r.lead : r.track);
      input.min = rng[0]; input.max = rng[1]; input.step = p.range ? p.range[2] : (p.key === 'size' ? (r.size[2] || 1) : p.step);
      input.addEventListener('input', () => {
        vals[id] = Number(input.value); touched[id] = true;
        val.textContent = fmt(p, vals[id]); dot(val, true);
        write(); refresh();
      });
      row.append(label, input); list.append(row);
      rows[id] = { row, input, val, p };
    });
    role.append(h, list); body.append(role);
  });
  body.append(hint, out);

  const dot = (val, on) => { let d = val.querySelector('.tw-dot'); if (on && !d) val.append(el('i', 'tw-dot')); if (!on && d) d.remove(); };
  const refresh = () => {
    const dirty = Object.keys(touched).length > 0;
    resetBtn.disabled = !dirty; copyBtn.disabled = !dirty;
    out.textContent = css(); out.hidden = !dirty; hint.hidden = dirty;
  };
  resetBtn.addEventListener('click', () => {
    touched = {};
    ROLES.forEach(r => PROPS.forEach(p => { const id = idOf(r, p); const s = rows[id]; if (!(id in base)) return;
      vals[id] = base[id]; s.input.value = base[id]; s.val.textContent = fmt(p, base[id]); dot(s.val, false); }));
    try { localStorage.removeItem(VALS); } catch (e) {}
    write(); refresh();
  });
  copyBtn.addEventListener('click', async () => {
    const text = css(); if (!text) return;
    try { await navigator.clipboard.writeText(text); copyBtn.textContent = 'Copied'; setTimeout(() => copyBtn.textContent = 'Copy', 1400); }
    catch (e) { /* the <pre> below is the fallback that always works */ }
  });
  const setOpen = (open) => {
    panel.classList.toggle('tw-shut', !open);
    body.hidden = !open; acts.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    try { localStorage.setItem(OPEN, open ? '1' : '0'); } catch (e) {}
  };
  toggle.addEventListener('click', () => setOpen(panel.classList.contains('tw-shut')));
  let openAtStart = true; try { openAtStart = localStorage.getItem(OPEN) !== '0'; } catch (e) {}
  setOpen(openAtStart);

  /* READ THE SITE BEFORE CHANGING IT. Deferred: fonts and the entrance
     animations land after load, and a read mid-swap is the fallback face's. */
  const mount = () => {
    document.body.append(panel);
    setTimeout(() => {
      ROLES.forEach(r => {
        const s = sample(r.sel);
        PROPS.forEach(p => {
          const id = idOf(r, p); const row = rows[id];
          if (!s) { row.row.setAttribute('data-off', ''); row.input.disabled = true; return; }
          const v = read(getComputedStyle(s), p);
          base[id] = v;
          /* a remembered tweak from an earlier visit wins over the site value */
          const t = (id in touched) ? touched[id] : null;
          vals[id] = (typeof t === 'number') ? t : v;
          row.input.value = vals[id]; row.val.textContent = fmt(p, vals[id]);
          /* the dot AFTER the text: assigning textContent wipes the <i> */
          if (typeof t === 'number') dot(row.val, true);
        });
      });
      touched = Object.fromEntries(Object.keys(touched).filter(k => typeof touched[k] === 'number' || touched[k] === true).map(k => [k, true]));
      write(); refresh();
    }, 900);
  };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, { once: true });
})();
