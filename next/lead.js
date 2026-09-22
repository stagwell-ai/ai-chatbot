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
    fine: 'Your details go to the Stagwell AI team.',
    fineLive: 'Sent to the Stagwell AI team — someone will be in touch.',
    fineHeld: 'Recorded. HubSpot is not connected yet, so this is held on our side for now.',
    fineFailed: 'We could not reach the CRM just now — your details were logged and nothing is lost.',
    fields: { name: 'Full name', email: 'Work email', phone: 'Phone — so we can reach you faster', role: 'Role — e.g. CMO, VP Marketing' },
    emailHint: 'That does not look like a work email — check the address.',
    success: {
      title: 'Stagwell AI has your brief.',
      /* no number in this line: the calendar card only appears when
         cta.json carries a url, so a count would be wrong two ways */
      line: 'Someone who already knows the account will be in touch — not an SDR reading a script. Faster ways in, while you are here:',
      close: 'Close',
      next: {
        call:     { title: 'Talk to someone now', line: 'We ring your phone in about a minute.' },
        calendar: { title: 'Pick a time', line: 'Choose a slot that suits you.', action: 'Open the calendar', url: '' },
        chat:     { title: 'Ask the AI first', line: 'Keep exploring what fits your brand.', action: 'Back to the agent', url: '/' }
      }
    },
    human: ['session', 'expert', 'callback', 'demo'],
    kinds: {
      session:   { title: 'Book a strategy session', line: 'Sixty minutes with the strategists behind Stagwell AI. We arrive with your dashboard already open.', submit: 'Continue' },
      expert:    { title: 'Talk to an AI expert', line: 'A working conversation about the problem you’re facing — and which products in the Stagwell AI suite solve it.', submit: 'Continue' },
      workspace: { title: 'Request your full AI workspace', line: 'The whole Stagwell AI suite, pointed at your brand and running continuously. We provision in five working days.', submit: 'Continue' },
      possible:  { title: 'See every product', line: 'Every solution in the Marketing Cloud, grouped by the problem it solves.', submit: 'Continue' },
      pdf:       { title: 'Export this dashboard', line: 'We will send the full analysis as a designed PDF, plus the raw engine outputs.', submit: 'Continue' },
      demo:      { title: 'Book a demo', line: 'Thirty minutes with the team who runs the product, walking through it against your brand — not a generic reel.', submit: 'Book my demo' },
      callback:  { title: 'Stagwell AI will call you', line: 'A NewVoices agent will call within two minutes, already briefed on what you told the agent.', submit: 'Call me now' }
    }
  };

  /* Every email ask carries a phone ask (client, Sep 1). It is never
     required — a visitor who will not give a number still converts — and the
     number itself never reaches an event: capture_phone says only whether one
     was given, the same discipline that keeps full addresses out of the bus. */
  const phoneLabel = c => (c && c.fields && c.fields.phone) || FALLBACK.fields.phone;

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
      /* what the small print says once the server has answered: delivered,
         held on our side, or not reached. merge() whitelists, so these have to
         be named or cta.json's versions are dropped on the floor. */
      fineLive: loaded.fineLive || FALLBACK.fineLive,
      fineHeld: loaded.fineHeld || FALLBACK.fineHeld,
      fineFailed: loaded.fineFailed || FALLBACK.fineFailed,
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

  /* ── WHICH ONES THEY WANT TO HEAR ABOUT ───────────────────────────────
     The catalog, as a set of toggles. Names come from data/solutions.json and
     nothing else — `displayName` where there is one, so a routing label
     ("Stagwell's Machines (family frame)") can never reach a visitor — and only
     products that are active. A product the conversation already landed on is
     ticked on arrival, because being asked to choose the thing you were just
     shown is a strange way to be treated. */
  let CATALOG = null, catalogPromise = null;
  const asProducts = d => {
    const list = Array.isArray(d) ? d : (d && d.solutions) || [];
    return list.filter(p => p && p.active !== false && p.id)
      .map(p => ({ id: p.id, name: p.displayName || p.name }));
  };
  function catalog() {
    if (CATALOG) return CATALOG;
    try {
      const d = window.SAI && window.SAI.data && window.SAI.data.solutions;
      if (d) { CATALOG = asProducts(d); return CATALOG; }
    } catch (e) { /* engine not on this page */ }
    return [];
  }
  /* /book and /ads do not load engine.js at all, so there is no catalog in
     memory there — fetched the same way the copy is, and warmed before the
     first click so the modal never opens without its products */
  function catalogReady() {
    if (CATALOG) return Promise.resolve(CATALOG);
    if (!catalogPromise) {
      catalogPromise = Promise.resolve()
        .then(() => { const c = catalog(); return c.length ? c : fetch('/data/solutions.json').then(r => (r.ok ? r.json() : null)).then(asProducts); })
        .catch(() => [])
        .then(list => { CATALOG = list || []; return CATALOG; });
    }
    return catalogPromise;
  }
  catalogReady();
  /* whatever the visitor was looking at when they clicked: the product on the
     recommendation card, the CTA's own data-kimi-product, or the product page */
  function wanted(prefill) {
    const p = prefill || {};
    const out = [];
    const add = id => { if (id && out.indexOf(id) === -1) out.push(id); };
    (Array.isArray(p.products) ? p.products : []).forEach(add);
    add(p.product);
    try {
      /* what the conversation actually put in front of them: state() publishes
         the cards, not the raw recommendation, and the best fit is the first */
      const k = window.SAIKIMI && window.SAIKIMI.state && window.SAIKIMI.state();
      (((k || {}).cards) || []).forEach(card => add(card && card.productId));
      if (k && k.exploreOffer) add(k.exploreOffer.productId);
    } catch (e) { /* no conversation on this page */ }
    /* …the product whose page they are on… */
    try {
      const own = document.body && String(document.body.className).match(/\bsp--([a-z0-9_]+)/);
      if (own) add(own[1]);
      const meta = document.querySelector('meta[name="sai-product"]');
      if (meta) add(meta.content);
    } catch (e) { /* not a product page */ }
    /* …and whatever the click that got them here was about. Most CTAs on this
       site NAVIGATE to /book rather than opening the panel in place, and the
       conversation does not survive that trip, so the product rides along in
       the URL or in sessionStorage. Ids only — never anything about a person. */
    try {
      const q = new URLSearchParams(location.search).get('p');
      if (q) q.split(',').forEach(x => add(x.trim()));
      const kept = sessionStorage.getItem('sai-lead-products');
      if (kept) kept.split(',').forEach(x => add(x.trim()));
    } catch (e) { /* private mode, or no storage */ }
    return out;
  }
  function productsHtml(c, prefill) {
    const all = catalog();
    if (all.length < 2) return '';               /* nothing to choose between */
    const on = wanted(prefill);
    const label = (c.fields && c.fields.products) || 'Which of these would you like to hear more about?';
    const note = (c.fields && c.fields.productsNote) || '';
    return `
        <fieldset class="lead__picks">
          <legend class="lead__lbl">${esc(label)}</legend>
          ${note ? `<p class="lead__pickshint">${esc(note)}</p>` : ''}
          <div class="lead__pickrow">
            ${all.map(p => `<label class="lead__pick">
              <input type="checkbox" name="products" value="${esc(p.id)}"${on.indexOf(p.id) !== -1 ? ' checked' : ''}>
              <span>${esc(p.name)}</span>
            </label>`).join('')}
          </div>
        </fieldset>`;
  }

  /* ── IT ACTUALLY GOES SOMEWHERE NOW ──────────────────────────────────────
     This form used to be scenery: it emitted its events for the demo console,
     showed the success panel and threw the answers away ("Prototype only —
     nothing is submitted or stored"). The chat has POSTed to /api/lead since
     the lead service was built; this now does too, in the same shape, so both
     roads end at the same contact in the same CRM.

     It does NOT make the visitor wait. The panel turns over at once and the
     POST runs behind it — the server keeps its own record of anything it
     could not deliver (leadService LEAD_UNDELIVERED), so a slow CRM costs a
     visitor nothing. The fine print under the panel says what really happened. */
  function leadPayload(form, kind, prefill) {
    const s = slots();
    const val = n => String((form.elements[n] && form.elements[n].value) || '').trim();
    const k = (() => { try { return window.SAIKIMI && window.SAIKIMI.state && window.SAIKIMI.state(); } catch (e) { return null; } })();
    const d = (k && k.discovery) || {};
    const picked = [].slice.call(form.querySelectorAll('input[name=products]:checked')).map(x => x.value);
    return {
      lead: { name: val('name') || null, email: val('email'), phone: val('phone') || null,
              company: (prefill && prefill.brand) || s.company || null },
      discovery: Object.assign({}, d, {
        sessionId: (k && k.sessionId) || s.sessionId || null,
        contactRequest: kind === 'expert' ? 'expert' : kind === 'demo' || kind === 'session' ? 'demo' : kind,
        roleText: val('role') || null,
        website: s.company_domain || d.website || null,
        productsRequested: picked
      }),
      page: location.pathname + location.search,
      ts: new Date().toISOString(),
      source: 'stagwell-ai · book a demo'
    };
  }
  function postLead(payload) {
    if (typeof fetch !== 'function') return Promise.resolve({ ok: false });
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    const t = ac ? setTimeout(() => ac.abort(), 12000) : 0;
    return fetch('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload), signal: ac ? ac.signal : undefined, keepalive: true })
      .then(r => r.json().catch(() => null).then(j => ({ ok: r.ok, status: r.status, body: j })))
      .catch(() => ({ ok: false }))
      .then(r => { if (t) clearTimeout(t); return r; });
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
      ? `<div class="modal__brand"><svg aria-hidden="true"><use href="#sw-logo"/></svg></div>`
      : '';
  }

  function formHtml(c, kind, prefill, inline) {
    const s = slots();
    const p = prefill || {};
    const name = p.name || '';
    const email = p.email || s.work_email || '';
    const role = p.role || s.role_seniority || '';

    return `
      ${inline ? '' : `${brandHtml()}
      <h3 id="saiLeadTitle">${esc(c.kinds[kind].title)}</h3>
      <p>${esc(c.kinds[kind].line)}</p>`}
      <form class="modal__form lead__form" id="saiLeadForm" novalidate autocomplete="on">
        <label class="lead__row">
          <span class="${inline ? 'lead__lbl' : 'vh'}">${esc(c.fields.name)}</span>
          <input type="text" name="name" autocomplete="name"
                 placeholder="${inline ? '' : esc(c.fields.name)}" aria-label="${esc(c.fields.name)}"
                 value="${esc(name)}">
        </label>
        <label class="lead__row" id="saiLeadEmailRow">
          <span class="${inline ? 'lead__lbl' : 'vh'}">${esc(c.fields.email)}</span>
          <input type="email" name="email" autocomplete="email" inputmode="email"
                 placeholder="${inline ? '' : esc(c.fields.email)}" aria-label="${esc(c.fields.email)}"
                 aria-describedby="saiLeadHint" value="${esc(email)}">
        </label>
        <p class="lead__hint" id="saiLeadHint" role="alert" hidden>${esc(c.emailHint)}</p>
        <label class="lead__row">
          <span class="${inline ? 'lead__lbl' : 'vh'}">${esc(phoneLabel(c))}</span>
          <input type="tel" name="phone" autocomplete="tel" inputmode="tel"
                 placeholder="${inline ? '' : esc(phoneLabel(c))}" aria-label="${esc(phoneLabel(c))}"
                 value="${esc(p.phone || s.phone || '')}">
        </label>
        <label class="lead__row">
          <span class="${inline ? 'lead__lbl' : 'vh'}">${esc(c.fields.role)}</span>
          <input type="text" name="role" autocomplete="organization-title"
                 placeholder="${inline ? '' : esc(c.fields.role)}" aria-label="${esc(c.fields.role)}"
                 value="${esc(role)}">
        </label>
        ${productsHtml(c, prefill)}
        <button class="btn btn--dark" type="submit">${esc(c.kinds[kind].submit)}</button>
      </form>
      <p class="modal__fine">${esc(c.fine)}</p>
      <!-- the other way to reach us, on the same panel: a call now instead of a
           form and a wait (client, 2026-09-15). OUTSIDE the form above — the
           widget has its own controls and a nested form would be dropped.
           call.js fills this; wireForm() asks it to. -->
      <div class="lead__alt">
        <span class="lead__or">${esc((window.SAICALL && window.SAICALL.copy.lead) || 'Or have us call you now.')}</span>
        <div data-lead-call></div>
      </div>`;
  }

  function successHtml(c, brand, inline) {
    const line = String(c.success.line).replace('{brand}', brand || 'brand');
    return `
      <div class="modal__ok">
        <span class="modal__tick"><svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <!-- the modal's thank-you carries saiLeadTitle; this one sits on the
             page at the same time, and two of an id is a broken label -->
        <h3>${esc(c.success.title)}</h3>
        <p>${esc(line)}</p>
        ${inline ? '<a class="btn btn--dark" href="/">Back to Stagwell AI</a>'
                 : `<button class="btn btn--dark" type="button" data-lead-close>${esc(c.success.close)}</button>`}
        <p class="modal__fine">${esc(c.fine)}</p>
      </div>`;
  }

  /* ── THE THANK-YOU, AS A DISMISSIBLE PANEL ──────────────────────────────
     What used to happen on /book: the tall form was replaced in place by a
     short confirmation, the page lost most of its height, and the viewport —
     which does not move — ended up parked on the footer. The visitor's own
     words for it were "the screen jumped weirdly. It came down low."

     So the confirmation now arrives as the modal this file already owns:
     nothing under it moves, Escape and the X and the scrim all dismiss it,
     and the page behind is left scrolled where the form was.

     It also stops being a dead end. Someone who has just asked for a demo is
     the single most willing person on the site, and the old panel's only verb
     was "Back to the page". Three ways forward instead, in the order of how
     soon they get a human: a call now, a slot in the calendar, or more of the
     agent. The calendar is data, not a guess — with no url in cta.json that
     card is not drawn at all, because an "Open the calendar" button that goes
     nowhere is worse than one less option. */
  function nextHtml(c, kind) {
    const n = (c.success && c.success.next) || {};
    const cards = [];

    if (n.call && window.SAICALL) {
      cards.push(`<li class="lead__opt" data-opt="call">
        <h4>${esc(n.call.title)}</h4>
        <p>${esc(n.call.line)}</p>
        <div data-lead-call></div>
      </li>`);
    }
    const url = String((n.calendar && n.calendar.url) || '').trim();
    if (n.calendar && /^(https:\/\/|\/)/.test(url)) {
      cards.push(`<li class="lead__opt" data-opt="calendar">
        <h4>${esc(n.calendar.title)}</h4>
        <p>${esc(n.calendar.line)}</p>
        <a class="btn btn--ghost" href="${esc(url)}" target="_blank" rel="noopener"
           data-thanks="calendar">${esc(n.calendar.action || 'Open the calendar')}</a>
      </li>`);
    }
    if (n.chat) {
      const to = String(n.chat.url || '/').trim() || '/';
      cards.push(`<li class="lead__opt" data-opt="chat">
        <h4>${esc(n.chat.title)}</h4>
        <p>${esc(n.chat.line)}</p>
        <a class="btn btn--ghost" href="${esc(to)}" data-thanks="chat">${esc(n.chat.action || 'Back to the agent')}</a>
      </li>`);
    }
    return cards.length ? `<ul class="lead__next">${cards.join('')}</ul>` : '';
  }

  function thanksHtml(c, brand, kind) {
    const line = String(c.success.line).replace('{brand}', brand || 'brand');
    return `
      <div class="modal__ok lead__thanks">
        <span class="modal__tick"><svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M4 10.5l4 4 8-9" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <h3 id="saiLeadTitle">${esc(c.success.title)}</h3>
        <p>${esc(line)}</p>
        ${nextHtml(c, kind)}
        <button class="btn btn--dark" type="button" data-lead-close>${esc(c.success.close)}</button>
        <p class="modal__fine">${esc(c.fine)}</p>
      </div>`;
  }

  /* Show it. The modal is built on demand, so this works from /book — which
     never opens the modal for anything else — as well as from the panel. */
  function openThanks(c, brand, kind) {
    build();
    openKind = kind;
    body.innerHTML = thanksHtml(c, brand, kind);
    el.hidden = false;
    document.body.classList.add('lead-open');
    wireThanks(body, c, kind);
    const done = body.querySelector('[data-lead-close]');
    if (done) { try { done.focus(); } catch (e) { panel.focus(); } } else { panel.focus(); }
    return body;
  }

  function wireThanks(root, c, kind) {
    const host = root.querySelector('[data-lead-call]');
    if (host && window.SAICALL && !host.children.length) {
      window.SAICALL.create(host, { variant: 'alt', placement: 'thanks-' + kind });
    }
    root.addEventListener('click', e => {
      const a = e.target.closest('[data-thanks]');
      if (a) emit('cta_clicked', { kind, to: a.dataset.thanks });
    });
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

  function wireForm(c, kind, prefill, root, inline) {
    root = root || body;
    const form = root.querySelector('#saiLeadForm');
    if (!form) return;
    const emailRow = root.querySelector('#saiLeadEmailRow');
    const emailInput = form.elements.email;
    const hint = root.querySelector('#saiLeadHint');

    /* "Call my phone", on the same panel as the form */
    const altHost = root.querySelector('[data-lead-call]');
    if (altHost && window.SAICALL && !altHost.children.length) {
      window.SAICALL.create(altHost, { variant: 'alt', placement: (inline ? 'book-' : 'modal-') + kind });
    }

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
      emit('capture_phone', {
        given: !!String((form.elements.phone && form.elements.phone.value) || '').trim(),
        kind
      });
      if (c.human.indexOf(kind) !== -1) {
        /* console.js renders human_requested's `text`; the CTA's own title is
           the truest thing to show there, and it carries no personal data */
        emit('human_requested', { kind, text: c.kinds[kind].title });
      }
      /* the products they ticked, by id, so the brief says what to talk about */
      const picked = [].slice.call(form.querySelectorAll('input[name=products]:checked')).map(x => x.value);
      if (picked.length) emit('products_requested', { kind, products: picked, count: picked.length });
      emit('journey_converted', { kind, products: picked });

      const payload = leadPayload(form, kind, prefill);
      const brand = (prefill && prefill.brand) || slots().company || null;

      /* In the panel we ARE the modal, so the thank-you simply replaces it.
         On /book the modal opens over the page, and the form underneath is
         swapped for the short confirmation it leaves behind — anchored, so
         dismissing does not drop the visitor into the footer. */
      const shown = [];
      if (inline) {
        root.innerHTML = successHtml(c, brand, inline);
        shown.push(root);
        shown.push(openThanks(c, brand, kind));
        try { root.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (e) { /* ancient */ }
      } else {
        root.innerHTML = thanksHtml(c, brand, kind);
        wireThanks(root, c, kind);
        shown.push(root);
        const done = root.querySelector('[data-lead-close]');
        if (done) done.focus();
      }

      /* …and the truth about it, once the server answers */
      postLead(payload).then(r => {
        const j = (r && r.body) || {};
        const live = r && r.ok && j.delivered && j.mode !== 'mock';
        emit('lead_delivered', { kind, delivered: !!(r && r.ok && j.delivered), mode: j.mode || null, destination: j.destination || null });
        const text = live ? (c.fineLive || 'Sent to the Stagwell AI team.')
          : (r && r.ok) ? (c.fineHeld || c.fine) : (c.fineFailed || c.fine);
        shown.forEach(where => {
          const line = where && where.querySelector('.modal__ok .modal__fine');
          if (line) line.textContent = text;
        });
      });
    });

    /* Focus the first EMPTY field: a visitor deep in the flow whose role and
       email the session already knows lands on the one thing still missing.

       The delay is what makes this safe on mobile — and what made it unsafe
       for a fast typist. Someone who clicks a field and starts typing inside
       those 60ms had their keystrokes yanked into another input when the
       timer fired (caught in QA: a phone number typed straight after opening
       landed in the name field, and a password manager filling the form does
       the same thing faster than any human). So the timer stands down the
       moment the visitor has put focus anywhere inside the form themselves. */
    if (inline) return;   /* a page never grabs focus on load: a phone would throw its keyboard up */
    const first = Array.prototype.find.call(
      form.querySelectorAll('input'), i => !String(i.value || '').trim()) || form.elements.name;
    setTimeout(() => {
      try {
        const active = document.activeElement;
        if (active && active !== document.body && form.contains(active)) return;
        first.focus();
      } catch (e) { panel.focus(); }
    }, 60);
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
    /* Book a demo and the strategy session have their own page now (client,
       2026-09-10: "not a scroll-down something that appears suddenly"). On
       that page the bar's Book a demo just takes you to the form. */
    if (kind === 'session' || kind === 'demo') {
      const here = document.getElementById('bookForm');
      if (here) {
        here.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const i = here.querySelector('input'); if (i) setTimeout(() => { try { i.focus({ preventScroll: true }); } catch (e) {} }, 450);
        return;
      }
      emit('cta_clicked', { kind, to: 'book' });
      /* the form is on ANOTHER PAGE, so what this click was about has to travel
         with it: the product page they were on, the card the conversation put
         in front of them, whatever the CTA named. Ids only. */
      remember(wanted(prefill));
      location.href = '/book';
      return;
    }
    build();
    opener = (document.activeElement && document.activeElement !== document.body)
      ? document.activeElement : null;
    const k = String(kind || 'expert');

    if (COPY && CATALOG) { render(COPY, k, prefill); return; }
    /* first click before the JSON has landed: show the panel now and fill it
       the instant the copy resolves — never a dead CTA, never a blank frame */
    Promise.all([copy(), catalogReady()]).then(r => render(r[0], k, prefill));
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

  /* ── the form in a page (/book) ─────────────────────────────────── */
  function mount(root, kind) {
    const go = c => {
      const k = c.kinds[kind] ? kind : 'session';
      root.innerHTML = formHtml(c, k, null, true);
      wireForm(c, k, null, root, true);
    };
    if (COPY && CATALOG) go(COPY); else Promise.all([copy(), catalogReady()]).then(r => go(r[0]));
  }
  const bookRoot = document.getElementById('bookForm');
  if (bookRoot) mount(bookRoot, bookRoot.dataset.kind || 'session');

  /* a CTA that is about to navigate says what it was about, so the form on the
     other side arrives with it ticked */
  function remember(ids) {
    try {
      const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
      if (list.length) sessionStorage.setItem('sai-lead-products', list.join(','));
    } catch (e) { /* nothing is lost that matters */ }
  }
  /* every CTA anywhere that names its product does it without being asked */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-kimi-product],[data-product]');
    if (!t) return;
    const cta = t.closest('[data-cta],[data-kimi-cta]') || (t.hasAttribute('data-cta') || t.hasAttribute('data-kimi-cta') ? t : null);
    if (cta) remember(t.dataset.kimiProduct || t.dataset.product);
  }, true);

  window.SAILEAD = {
    open,
    remember,
    mount,
    close,
    isOpen: () => !!(el && !el.hidden),
    kind: () => openKind,
    copy                                  /* () => Promise<copy> — for tests */
  };
})();
