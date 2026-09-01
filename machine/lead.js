/* ═══════════════════════════════════════════════════════════════════════════
   LEAD.JS — the one lead-capture modal, for every page in the kit.

   WHY IT EXISTS. "Talk to an AI expert" used to mean three different things
   depending on where you clicked it: on "/" it opened b.js's inline modal and
   collected a name, an email and a role; on a product landing (/p/{id}) and on
   /ads it was a link to "/#cta", which collects nothing and just bounces the
   visitor to the homepage. The client's ask — "make it when someone clicks to
   talk to an AI expert, we collect their info immediately" — is exactly that
   gap. So the modal moved here, self-contained, and every surface calls the
   same thing:

       window.SAILEAD.open(kind [, prefill])

   b.js keeps openModal(kind) as its entry point and delegates to this; if
   lead.js ever fails to load, b.js falls back to its own inline copy, so the
   CTA never dead-ends. One implementation, no divergence.

   COPY LIVES IN DATA. Every string comes from /data/cta.json (fetched once,
   cached). FALLBACK below is a byte-identical mirror of that file, used only
   when the fetch fails — a CTA that opens with no words in it would be worse
   than a slightly stale one.

   WHAT IT SENDS. Three events, all from engine.js's existing 18-type
   vocabulary — nothing invented:

       capture_email     { domain, kind }   the DOMAIN only, never the address
       human_requested   { kind, text }     only for kinds that ask for a person
       journey_converted { kind }

   The address itself never leaves the browser: the demo console renders every
   payload on a projector, and a visitor's work email on a projector is a
   mistake you make once. snapshot-data.js already holds that line for the
   snapshot capture; this holds it for every other CTA on the site.

   STYLING. It reuses the site's own .modal classes (machine/styles.css), so
   the panel is pixel-identical to the one the client already signed off on.
   machine/lead.css carries only what those classes don't: the hero-input
   idiom's shake + inline hint, and a self-contained copy of the handful of
   .modal rules, so this works on campaign.html and /ads, which do not load
   b.css.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  /* ── the copy, mirrored from data/cta.json for the fetch-failed case ───── */
  const FALLBACK = {
    fine: 'Prototype only — nothing is submitted or stored.',
    fields: { name: 'Full name', email: 'Work email', role: 'Role — e.g. CMO, VP Marketing' },
    emailHint: 'That does not look like a work email — check the address.',
    success: {
      title: 'The machine has your brief.',
      line: 'Your {brand} analysis has been enriched by SATS and scored. Someone who already understands the account will be in touch — not an SDR reading a script.',
      close: 'Back to the page'
    },
    human: ['session', 'expert', 'callback'],
    kinds: {
      session:   { title: 'Book a strategy session', line: 'Sixty minutes with the team that built the machine. We arrive with your dashboard already open.', submit: 'Continue' },
      expert:    { title: 'Talk to an AI expert', line: 'A working conversation about the problem you’re facing — and which of the ten products solve it.', submit: 'Continue' },
      workspace: { title: 'Request your full AI workspace', line: 'All ten products, pointed at your brand and running continuously. We provision in five working days.', submit: 'Continue' },
      possible:  { title: 'See all ten products', line: 'Every solution in the Marketing Cloud, grouped by the problem it solves.', submit: 'Continue' },
      pdf:       { title: 'Export this dashboard', line: 'We will send the full analysis as a designed PDF, plus the raw engine outputs.', submit: 'Continue' },
      callback:  { title: 'The machine will call you', line: 'A NewVoices agent will call within two minutes, already briefed on what you told the agent.', submit: 'Call me now' }
    }
  };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  /* ── copy: one fetch, cached; a failure resolves to FALLBACK ──────────── */
  let copyPromise = null;
  let COPY = null;                       /* whatever we last resolved to */

  function merge(loaded) {
    if (!loaded || typeof loaded !== 'object') return FALLBACK;
    return {
      fine: loaded.fine || FALLBACK.fine,
      fields: Object.assign({}, FALLBACK.fields, loaded.fields || {}),
      emailHint: loaded.emailHint || FALLBACK.emailHint,
      success: Object.assign({}, FALLBACK.success, loaded.success || {}),
      human: Array.isArray(loaded.human) ? loaded.human : FALLBACK.human,
      kinds: Object.assign({}, FALLBACK.kinds, loaded.kinds || {})
    };
  }

  function copy() {
    if (!copyPromise) {
      copyPromise = fetch('/data/cta.json')
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null)
        .then(loaded => { COPY = merge(loaded); return COPY; });
    }
    return copyPromise;
  }
  copy();                                 /* warm it before the first click */

  /* ── the demo bus. engine.js may not have booted yet, and on a page that
        doesn't load it at all the modal still has to work. ─────────────── */
  function emit(type, payload) {
    try {
      if (window.SAI && window.SAI.events && typeof window.SAI.events.emit === 'function') {
        window.SAI.events.emit(type, payload);
      }
    } catch (e) { /* the log is a demo aid — it never costs the visitor a CTA */ }
  }

  function slots() {
    try { return (window.SAI && window.SAI.session && window.SAI.session.slots) || {}; }
    catch (e) { return {}; }
  }

  /* the qualifying fact, and the only part of the address that is ever
     logged — same shape snapshot-data.js already sends */
  function emailDomain(email) {
    const m = String(email == null ? '' : email).trim().toLowerCase()
      .match(/^[^\s@]+@([a-z0-9.-]+\.[a-z]{2,})$/);
    return m ? m[1] : null;
  }
  const validEmail = v => !!emailDomain(v);

  /* ── the element, built once and reused ───────────────────────────────── */
  let el = null, panel = null, body = null;
  let opener = null;                      /* what to hand focus back to */
  let openKind = null;

  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),' +
    'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function build() {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'modal lead';
    el.id = 'saiLead';
    el.hidden = true;
    el.innerHTML = `
      <div class="modal__scrim" data-lead-close></div>
      <div class="modal__panel lead__panel" role="dialog" aria-modal="true"
           aria-labelledby="saiLeadTitle" tabindex="-1">
        <button class="modal__x" type="button" data-lead-close aria-label="Close">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>
        </button>
        <div class="lead__body" id="saiLeadBody"></div>
      </div>`;
    document.body.appendChild(el);
    panel = el.querySelector('.modal__panel');
    body = el.querySelector('#saiLeadBody');

    el.addEventListener('click', e => {
      if (e.target.closest('[data-lead-close]')) { e.preventDefault(); close(); }
    });
    /* Escape closes; Tab stays inside — a dialog you can tab out of is not
       modal, whatever aria-modal says */
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const items = Array.prototype.filter.call(
        panel.querySelectorAll(FOCUSABLE), n => n.offsetParent !== null || n === document.activeElement);
      if (!items.length) { e.preventDefault(); panel.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });
    return el;
  }

  /* the site's own lockup, but only where the page actually carries the
     symbol — an empty <use> is worse than no mark */
  function brandHtml() {
    return document.getElementById('sw-logo')
      ? `<div class="modal__brand"><svg aria-hidden="true"><use href="#sw-logo"/></svg><span>AI</span></div>`
      : '';
  }

  function formHtml(c, kind, prefill) {
    const s = slots();
    const p = prefill || {};
    const name = p.name || '';
    const email = p.email || s.work_email || '';
    const role = p.role || s.role_seniority || '';

    return `
      ${brandHtml()}
      <h3 id="saiLeadTitle">${esc(c.kinds[kind].title)}</h3>
      <p>${esc(c.kinds[kind].line)}</p>
      <form class="modal__form lead__form" id="saiLeadForm" novalidate autocomplete="on">
        <label class="lead__row">
          <span class="vh">${esc(c.fields.name)}</span>
          <input type="text" name="name" autocomplete="name"
                 placeholder="${esc(c.fields.name)}" aria-label="${esc(c.fields.name)}"
                 value="${esc(name)}">
        </label>
        <label class="lead__row" id="saiLeadEmailRow">
          <span class="vh">${esc(c.fields.email)}</span>
          <input type="email" name="email" autocomplete="email" inputmode="email"
                 placeholder="${esc(c.fields.email)}" aria-label="${esc(c.fields.email)}"
                 aria-describedby="saiLeadHint" value="${esc(email)}">
        </label>
        <p class="lead__hint" id="saiLeadHint" role="alert" hidden>${esc(c.emailHint)}</p>
        <label class="lead__row">
          <span class="vh">${esc(c.fields.role)}</span>
          <input type="text" name="role" autocomplete="organization-title"
                 placeholder="${esc(c.fields.role)}" aria-label="${esc(c.fields.role)}"
                 value="${esc(role)}">
        </label>
        <button class="btn btn--dark" type="submit">${esc(c.kinds[kind].submit)}</button>
      </form>
      <p class="modal__fine">${esc(c.fine)}</p>`;
  }

  function successHtml(c, brand) {
    const line = String(c.success.line).replace('{brand}', brand || 'brand');
    return `
      <div class="modal__ok">
        <span class="modal__tick"><svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <h3 id="saiLeadTitle">${esc(c.success.title)}</h3>
        <p>${esc(line)}</p>
        <button class="btn btn--dark" type="button" data-lead-close>${esc(c.success.close)}</button>
      </div>`;
  }

  /* ── behaviour ────────────────────────────────────────────────────────── */
  function shake(row, hint) {
    row.classList.remove('is-shake');
    /* restart the animation on a second bad try */
    void row.offsetWidth;
    row.classList.add('is-shake');
    setTimeout(() => row.classList.remove('is-shake'), 440);
    if (hint) hint.hidden = false;
  }

  function wireForm(c, kind, prefill) {
    const form = body.querySelector('#saiLeadForm');
    if (!form) return;
    const emailRow = body.querySelector('#saiLeadEmailRow');
    const emailInput = form.elements.email;
    const hint = body.querySelector('#saiLeadHint');

    /* the hint clears itself the moment the address becomes plausible — no
       second submit needed to find out you fixed it */
    emailInput.addEventListener('input', () => {
      if (hint && !hint.hidden && validEmail(emailInput.value)) hint.hidden = true;
    });

    form.addEventListener('submit', e => {
      e.preventDefault();
      const email = String(emailInput.value || '').trim();
      if (!validEmail(email)) {
        /* no browser alert, no native bubble: the site's own shake + inline
           hint, the same idiom the prompt field uses */
        shake(emailRow, hint);
        emailInput.focus();
        return;
      }

      /* THE POINT OF THE SECOND ASK — the click on "Talk to an AI expert"
         has now captured a lead, and the demo console can prove it. */
      emit('capture_email', { domain: emailDomain(email), kind });
      if (c.human.indexOf(kind) !== -1) {
        /* console.js renders human_requested's `text`; the CTA's own title is
           the truest thing to show there, and it carries no personal data */
        emit('human_requested', { kind, text: c.kinds[kind].title });
      }
      emit('journey_converted', { kind });

      const brand = (prefill && prefill.brand) || slots().company || null;
      body.innerHTML = successHtml(c, brand);
      const back = body.querySelector('[data-lead-close]');
      if (back) back.focus();
    });

    /* focus the first EMPTY field: a visitor deep in the flow whose role and
       email the session already knows lands on the one thing still missing */
    const first = Array.prototype.find.call(
      form.querySelectorAll('input'), i => !String(i.value || '').trim()) || form.elements.name;
    setTimeout(() => { try { first.focus(); } catch (e) { panel.focus(); } }, 60);
  }

  function render(c, kind, prefill) {
    const k = c.kinds[kind] ? kind : 'expert';
    openKind = k;
    body.innerHTML = formHtml(c, k, prefill);
    el.hidden = false;
    document.body.classList.add('lead-open');
    wireForm(c, k, prefill);
  }

  function open(kind, prefill) {
    build();
    opener = (document.activeElement && document.activeElement !== document.body)
      ? document.activeElement : null;
    const k = String(kind || 'expert');

    if (COPY) { render(COPY, k, prefill); return; }
    /* first click before the JSON has landed: show the panel now and fill it
       the instant the copy resolves — never a dead CTA, never a blank frame */
    copy().then(c => render(c, k, prefill));
  }

  function close() {
    if (!el || el.hidden) return;
    el.hidden = true;
    document.body.classList.remove('lead-open');
    body.innerHTML = '';
    openKind = null;
    const back = opener;
    opener = null;
    if (back && document.contains(back)) { try { back.focus(); } catch (e) { /* gone */ } }
  }

  /* ── the opt-in delegate ──────────────────────────────────────────────────
     b.js and campaign.js each already own a [data-cta] click handler on their
     own page, and two handlers would open the modal twice. So this one is
     opt-in: a page with no CTA handler of its own — /ads — says so on <body>,
     and gets the same behaviour with the same markup. */
  if (document.body && document.body.hasAttribute('data-lead-cta')) {
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-cta]');
      if (!t || t.tagName === 'FORM') return;
      e.preventDefault();
      document.body.classList.remove('nav-open');
      open(t.dataset.cta || 'expert');
    });
  }

  window.SAILEAD = {
    open,
    close,
    isOpen: () => !!(el && !el.hidden),
    kind: () => openKind,
    copy                                  /* () => Promise<copy> — for tests */
  };
})();
