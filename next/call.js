/* ═══════════════════════════════════════════════════════════════════════════
   CALL MY PHONE — the callback widget, everywhere it belongs.

   One button that asks for a phone number and nothing else; once there is a
   number, it grows into the short form that asks who to ask for, with the
   consent line and the two policy links under the button. Sent, it says an AI
   voice agent will call shortly. /api/callback does the rest.

   Why this is its own file and not part of home.js (client, 2026-09-15: "think
   of all the places that this makes sense to put"):

     · home.js is not on every page — /agent and /why do not load it — and the
       widget now appears inside the lead modal, which every page can open.
     · the markup used to be copied into twenty HTML files. It is written ONCE
       here; a page carries `<div data-call="someId"></div>` and that is all.
     · NOTHING HERE IS A <form>. The two steps are divs with a button and an
       Enter handler, so the widget can sit inside another form — the thread,
       the ask box, the lead form — without the parser dropping it. That trap
       has bitten this codebase twice already.

   API
     SAICALL.create(host, {id, variant, compact}) → the element, wired
     SAICALL.wire(el)                             → wire markup already present
     SAICALL.copy                                 → every string, editable
   Auto: every [data-call] on the page is created on load.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const PRIVACY = 'https://www.stagwellglobal.com/privacy-policy/';
  const TERMS = 'https://www.stagwellglobal.com/wp-content/uploads/2021/11/Stagwell-Inc-Terms-of-Use_Oct-2021.pdf';

  /* every visitor-facing string, in one place — the consent line especially,
     which used to live in twenty copies of the same HTML */
  const copy = {
    button: 'Call my phone',
    heading: 'Who should the agent ask for?',
    calling: 'Calling',
    change: 'change',
    first: 'First name',
    last: 'Last name',
    email: 'Work email',
    submit: 'Call my phone',
    sending: 'Requesting…',
    placeholder: 'Phone number',
    country: 'Country',
    lead: 'Or have us call you now.',
    done: 'Our AI voice agent will call you shortly.',
    doneTo: 'We will ring {phone}.',
    failed: 'We could not book that call.',
    failedTo: 'Please try again in a moment, or book a demo instead.',
    errFirst: 'Please add a first name so the agent knows who to ask for.',
    errLast: 'Please add a last name.',
    errEmail: 'That does not look like an email address — check it over.',
    fine: 'By requesting a call you agree that an automated AI voice agent from Stagwell AI may ' +
          'call the number above, and that the call may be recorded and transcribed so we can ' +
          'follow up. Your carrier’s usual charges apply. You can ask the agent to stop at ' +
          'any time. See our <a href="' + PRIVACY + '" target="_blank" rel="noopener">Privacy Notice</a> ' +
          'and <a href="' + TERMS + '" target="_blank" rel="noopener">Terms of Use</a>.'
  };

  /* the dial codes the server accepts, newest list; name first so the select
     reads as a country picker rather than a list of numbers */
  const COUNTRIES = [
    ['1', 'United States / Canada'], ['44', 'United Kingdom'], ['61', 'Australia'], ['43', 'Austria'],
    ['32', 'Belgium'], ['55', 'Brazil'], ['56', 'Chile'], ['86', 'China'], ['57', 'Colombia'],
    ['420', 'Czechia'], ['45', 'Denmark'], ['20', 'Egypt'], ['358', 'Finland'], ['33', 'France'],
    ['49', 'Germany'], ['30', 'Greece'], ['852', 'Hong Kong'], ['36', 'Hungary'], ['91', 'India'],
    ['62', 'Indonesia'], ['353', 'Ireland'], ['972', 'Israel'], ['39', 'Italy'], ['81', 'Japan'],
    ['60', 'Malaysia'], ['52', 'Mexico'], ['31', 'Netherlands'], ['64', 'New Zealand'],
    ['234', 'Nigeria'], ['47', 'Norway'], ['63', 'Philippines'], ['48', 'Poland'], ['351', 'Portugal'],
    ['974', 'Qatar'], ['40', 'Romania'], ['966', 'Saudi Arabia'], ['65', 'Singapore'],
    ['27', 'South Africa'], ['82', 'South Korea'], ['34', 'Spain'], ['46', 'Sweden'],
    ['41', 'Switzerland'], ['886', 'Taiwan'], ['66', 'Thailand'], ['90', 'Turkey'],
    ['971', 'United Arab Emirates'], ['380', 'Ukraine'], ['84', 'Vietnam']
  ];

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const EMAIL = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
  const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const WAVE = '<svg class="btn__ic btn__ic--wave" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="1.5" y="8" width="2" height="4" rx="1" fill="currentColor"/><rect x="5.5" y="5" width="2" height="10" rx="1" fill="currentColor"/><rect x="9.5" y="2" width="2" height="16" rx="1" fill="currentColor"/><rect x="13.5" y="5" width="2" height="10" rx="1" fill="currentColor"/><rect x="17.5" y="8" width="2" height="4" rx="1" fill="currentColor"/></svg>';
  const X = '<button type="button" class="call__x" data-close aria-label="Close"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>';
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function html(o) {
    const opts = COUNTRIES.map(([v, n]) => '<option value="' + v + '"' + (v === '1' ? ' selected' : '') + '>' + esc(n) + ' (+' + v + ')</option>').join('');
    return '' +
      '<button type="button" class="btn btn--line btn--lg btn--ic call__btn">' + WAVE + ' ' + esc(o.button || copy.button) + '</button>' +
      /* step 1 — a country and a number, nothing else */
      '<div class="call__form" role="group" aria-label="' + esc(copy.button) + '">' + X +
        /* the pill shows the dial code, which always fits; the native list still
           shows whole country names. The select lies transparent over the label
           so it keeps its own keyboard and screen-reader behaviour. */
        '<span class="call__ccwrap">' +
          '<span class="call__ccv" aria-hidden="true">+1</span>' +
          '<select class="call__cc" aria-label="' + esc(copy.country) + '">' + opts + '</select>' +
        '</span>' +
        '<span class="call__sep" aria-hidden="true"></span>' +
        '<input class="call__num" type="tel" inputmode="tel" placeholder="' + esc(copy.placeholder) + '" aria-label="' + esc(copy.placeholder) + '" autocomplete="tel-national" spellcheck="false">' +
        '<button type="button" class="call__go" aria-label="Continue">' + ARROW + '</button>' +
      '</div>' +
      /* step 2 — who to ask for, and where to follow up */
      '<div class="call__more" role="group" aria-label="' + esc(copy.heading) + '">' + X +
        '<p class="call__h">' + esc(copy.heading).replace(/\?$/, '<span class="q">?</span>') + '</p>' +
        '<p class="call__sub">' + esc(copy.calling) + ' <b class="call__tonum"></b> &middot; <button type="button" class="call__edit" data-back>' + esc(copy.change) + '</button></p>' +
        '<div class="call__row">' +
          '<label class="call__f"><span>' + esc(copy.first) + '</span><input name="first_name" type="text" autocomplete="given-name" spellcheck="false"></label>' +
          '<label class="call__f"><span>' + esc(copy.last) + '</span><input name="last_name" type="text" autocomplete="family-name" spellcheck="false"></label>' +
        '</div>' +
        '<label class="call__f"><span>' + esc(copy.email) + '</span><input name="email" type="email" inputmode="email" autocomplete="email" spellcheck="false"></label>' +
        '<p class="call__hint" role="alert" hidden></p>' +
        '<button type="button" class="btn btn--ink call__send">' + esc(copy.submit) + '</button>' +
        '<p class="call__fine">' + copy.fine + '</p>' +
      '</div>' +
      /* the confirmation */
      '<div class="call__done" role="status" aria-live="polite">' + X +
        '<span class="call__wave" aria-hidden="true">' + WAVE + '</span>' +
        '<span class="call__status"><b class="call__line"></b><span class="call__to"></span></span>' +
        '<p class="call__fine call__fine--done">' + copy.fine + '</p>' +
      '</div>';
  }

  /* +41 763 284 000 — groups of three, a lone last digit joins the group before it */
  function pretty(code, digits) {
    let g = digits.length === 10 ? [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)] : (digits.match(/\d{1,3}/g) || [digits]);
    if (g.length > 1 && g[g.length - 1].length === 1) g[g.length - 2] += g.pop();
    return '+' + code + ' ' + g.join(' ');
  }

  function wire(call) {
    if (!call || call.dataset.wired === '1') return call;
    const $ = (s) => call.querySelector(s);
    const $$ = (s) => Array.prototype.slice.call(call.querySelectorAll(s));
    const btn = $('.call__btn'), step1 = $('.call__form'), more = $('.call__more'), done = $('.call__done'),
          cc = $('.call__cc'), num = $('.call__num'), line = $('.call__line'), to = $('.call__to'),
          toNum = $('.call__tonum'), hint = $('.call__hint'), send = $('.call__send');
    if (!(btn && step1 && done && cc && num && line)) return call;
    call.dataset.wired = '1';
    if (!call.dataset.state) call.dataset.state = 'idle';

    const wide = () => Math.min(360, Math.round((call.parentElement && call.parentElement.getBoundingClientRect().width) || 360));
    const setW = px => call.style.setProperty('--call-w', px + 'px');
    let restW = 0;
    const rest = () => { restW = Math.round(btn.getBoundingClientRect().width) || restW; if (restW) setW(restW); };
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(rest);

    let dial = '', national = '';
    const openPill = () => { if (!restW) rest(); call.dataset.state = 'phone'; call.classList.remove('is-bad', 'is-placed'); setW(wide()); setTimeout(() => num.focus({ preventScroll: true }), 200); };
    const closePill = () => { call.dataset.state = 'idle'; if (restW) setW(restW); btn.focus({ preventScroll: true }); };
    const openMore = () => {
      call.dataset.state = 'details';
      setW(Math.min(420, Math.round((call.parentElement && call.parentElement.getBoundingClientRect().width) || 420)));
      if (toNum) toNum.textContent = pretty(dial, national);
      const f = more && more.querySelector('input[name=first_name]');
      setTimeout(() => { if (f) f.focus({ preventScroll: true }); }, 200);
    };
    const backToPhone = () => { call.dataset.state = 'phone'; setW(wide()); setTimeout(() => num.focus({ preventScroll: true }), 160); };

    btn.addEventListener('click', openPill);
    $$('.call__x').forEach(x => x.addEventListener('click', closePill));
    $$('[data-back]').forEach(b => b.addEventListener('click', backToPhone));
    addEventListener('keydown', e => { if (e.key === 'Escape' && call.dataset.state !== 'idle') closePill(); });
    addEventListener('pointerdown', e => { if (call.dataset.state === 'phone' && !call.contains(e.target) && !num.value.trim()) closePill(); });
    num.addEventListener('input', () => call.classList.remove('is-bad'));
    /* keep the visible dial code in step with the choice */
    const ccv = $('.call__ccv');
    const showCode = () => { if (ccv) ccv.textContent = '+' + cc.value; };
    cc.addEventListener('change', showCode);
    showCode();
    addEventListener('resize', () => { if (call.dataset.state === 'idle') { call.style.removeProperty('--call-w'); rest(); } });

    function step1Done() {
      const digits = num.value.replace(/\D/g, '');
      if (digits.length < 6 || digits.length > 14) { call.classList.add('is-bad'); num.focus(); return; }
      /* the trunk zero is national shorthand: +41 076… does not dial */
      dial = cc.value; national = digits.replace(/^0+/, '') || digits;
      openMore();
    }
    $('.call__go').addEventListener('click', step1Done);
    num.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); step1Done(); } });

    const say = m => { if (hint) { hint.textContent = m || ''; hint.hidden = !m; } };
    if (more) $$('.call__more input').forEach(i => {
      i.addEventListener('input', () => say(''));
      i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    });

    async function submit() {
      const val = n => String((more.querySelector('input[name=' + n + ']') || {}).value || '').trim();
      const first = val('first_name'), last = val('last_name'), email = val('email');
      if (!first) { say(copy.errFirst); return; }
      if (!last) { say(copy.errLast); return; }
      if (!EMAIL.test(email)) { say(copy.errEmail); return; }
      say('');
      if (send) { send.disabled = true; send.textContent = copy.sending; }
      line.textContent = copy.done;
      if (to) to.textContent = String(copy.doneTo).replace('{phone}', pretty(dial, national));
      call.dataset.state = 'done';
      const x = done.querySelector('.call__x'); if (x) x.focus({ preventScroll: true });
      let ok = false;
      try {
        const r = await fetch('/api/callback', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ first_name: first, last_name: last, email: email, dial_code: dial, national_number: national, page: location.pathname, placement: call.dataset.placement || call.id || '' })
        });
        const j = await r.json().catch(() => null);
        ok = !!(r.ok && j && j.ok);
      } catch (e) { ok = false; }
      if (send) { send.disabled = false; send.textContent = copy.submit; }
      if (ok) {
        line.textContent = copy.done;
        call.classList.add('is-placed');
        try { const a = window.SAIANALYTICS; if (a) a.track('callback_requested', { dial: dial, placement: call.dataset.placement || call.id || '', page: location.pathname }); } catch (e) {}
      } else {
        line.textContent = copy.failed;
        if (to) to.textContent = copy.failedTo;
        call.classList.add('is-bad');
      }
    }
    if (send) send.addEventListener('click', submit);
    return call;
  }

  function create(host, o) {
    const opt = o || {};
    if (!host) return null;
    const el = document.createElement('div');
    el.className = 'call' + (opt.variant ? ' call--' + opt.variant : '');
    if (opt.id) el.id = opt.id;
    el.dataset.state = 'idle';
    el.dataset.placement = opt.placement || opt.id || opt.variant || '';
    el.innerHTML = html(opt);
    host.appendChild(el);
    return wire(el);
  }

  /* a page says where it wants one: <div data-call="callEnd" data-variant="hero"> */
  function boot(root) {
    (root || document).querySelectorAll('[data-call]').forEach(m => {
      if (m.dataset.callDone === '1') return;
      m.dataset.callDone = '1';
      create(m, { id: m.dataset.call || '', variant: m.dataset.variant || '', placement: m.dataset.placement || m.dataset.call || '' });
    });
    (root || document).querySelectorAll('.call').forEach(wire);   /* any static markup still in a page */
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot());
  else boot();

  window.SAICALL = { create, wire, boot, html, copy, countries: COUNTRIES, pretty };
})();
