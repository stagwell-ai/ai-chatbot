/* ═══════════════════════════════════════════════════════════════════════════
   S6 · THE EVENT CONSOLE — "everything sent to HubSpot", on screen.

   SPEC S6: a live list of attribution, answers/slots, consent state, the
   routing decision, handoff clicks and the per-journey conversion event,
   rolled up under "Qualified opportunities created by Stagwell.AI".

   This is a DEMO AID. It exists so a presenter can say "and here is what the
   CRM just received" and point at it. Three consequences run through the
   whole file:

     1 · OBSERVER ONLY. Nothing here ever calls SAI.events.emit(). A console
         that writes to the log it is displaying would be lying about what the
         demo does. The only mutation it is allowed is the presenter's own
         Clear button.

     2 · IT MUST NEVER BE THE THING THAT BREAKS. Every formatter is wrapped;
         an unknown event type, a null payload, a payload shape a future
         sprint invents — all of them render as `type · {json}` rather than
         throwing. It works whether the engine is ready, still loading, or
         absent entirely (then it listens on the document and shows whatever
         arrives). Load order is not a contract it depends on.

     3 · THIS SESSION IS THE STORY. The stream seeds from SAI.events.list() —
         the in-memory log of *this* visit — and never from stored(), because
         a log full of last Tuesday's run is the fastest way to confuse a live
         demo. The 200-entry localStorage ring still earns one muted footer
         line, so the persistence is honest without being in the way.

   window.SAICONSOLE (small on purpose — the tests and nothing else use it):
     .open() .close() .toggle() .isOpen()
     .line(rec)     → the one-liner for an event record   (pure, never throws)
     .family(type)  → 'session' | 'slots' | 'research' | 'capture' | 'routing'
     .rollup(list)  → { events, opportunities, slots, consent, route }
     .events()      → the list currently being rendered
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

if (typeof document === 'undefined') return;
if (window.SAICONSOLE) return;                 /* one console per page */

/* ═══════════════════════════════════════════════════════════════════════════
   FAMILIES — the five colours in console.css. Every one of engine.js's 18
   types is claimed by exactly one; anything unclaimed (a type a later sprint
   adds) falls back to 'session' grey rather than going unstyled.
   ═══════════════════════════════════════════════════════════════════════════ */
const FAMILY = {
  session_started:      'session',
  attribution_captured: 'session',

  slot_filled:      'slots',
  slot_corrected:   'slots',
  question_asked:   'slots',
  question_skipped: 'slots',
  answer_given:     'slots',

  research_started: 'research',
  research_step:    'research',
  research_done:    'research',
  snapshot_viewed:  'research',

  capture_email:    'capture',
  capture_phone:    'capture',
  capture_consent:  'capture',
  capture_declined: 'capture',

  route_decided:    'routing',
  handoff_click:    'routing',
  human_requested:  'routing',
  journey_converted:'routing'
};

const family = type => FAMILY[String(type)] || 'session';

/* the routes that mean a real opportunity exists. follow_up is deliberately
   not one of them: override 2 is "capture, deliver the snapshot, don't force
   a meeting", which is a lead, not an opportunity. */
const QUALIFYING_ROUTES = ['consultative', 'demo', 'self_serve'];

/* ═══════════════════════════════════════════════════════════════════════════
   SMALL SAFE HELPERS — every one of these is total: any input, a string out.
   ═══════════════════════════════════════════════════════════════════════════ */
const str = v => (v == null ? '' : String(v));

/* a payload value as one line of JSON, with a plain-string shortcut so a
   value reads `visitor` and not `"visitor"` where that is clearer */
function j1(v) {
  try {
    const s = JSON.stringify(v);
    return s === undefined ? str(v) : s;
  } catch (e) { return str(v); }
}

function clip(s, n) {
  const t = str(s).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

/* google.com out of https://www.google.com/search?q=… */
function host(u) {
  const t = str(u).trim();
  if (!t) return '';
  const m = t.match(/^[a-z]+:\/\/([^/?#]+)/i);
  return (m ? m[1] : t.split(/[/?#]/)[0]).replace(/^www\./i, '');
}

/* 79,000 — deterministic, no locale in the way of a test */
const num = n => (typeof n === 'number' && isFinite(n))
  ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  : str(n);

const isEmpty = v => v == null || v === '' || (Array.isArray(v) && !v.length);

/* flow.js names its skip reasons as ids — `website_in_first_message`. On a
   projector that reads like a log file, so a bare snake_case token becomes
   words. Anything already written as prose is left exactly as it is: this
   only ever fires on a single lower-case token with no spaces in it. */
function human(s) {
  const t = str(s);
  return /^[a-z0-9]+(_[a-z0-9]+)+$/.test(t) ? t.replace(/_/g, ' ') : t;
}

/* 'now' under five seconds, then s / m / h / d. Coarse on purpose: the
   presenter wants "that just happened", not a stopwatch. */
function rel(t, now) {
  const ms = (typeof now === 'number' ? now : Date.now()) - Number(t || 0);
  const s = Math.max(0, Math.round(ms / 1000));
  if (!isFinite(s)) return '';
  if (s < 5) return 'now';
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE FORMATTERS — one human sentence per event type, written for a room
   reading over the presenter's shoulder, not for a log file. Each receives
   the payload (never null: {} stands in) and the whole record.

   Anything not in this table renders generically. That is not a fallback we
   tolerate, it is the contract: sprint N+1 can invent an event type and this
   file keeps working untouched.
   ═══════════════════════════════════════════════════════════════════════════ */
const FORMAT = {

  /* ── session & attribution ────────────────────────────────────────────── */
  session_started: p =>
    'Session started · ' + (p.landing || 'this page'),

  attribution_captured: p => {
    const bits = [];
    ['utm_campaign', 'utm_source', 'utm_medium', 'utm_content', 'utm_term']
      .forEach(k => { if (p[k]) bits.push(k + '=' + clip(p[k], 40)); });
    if (p.product_interest) bits.push('product=' + clip(p.product_interest, 30));
    const ref = p.referrer ? 'referrer ' + host(p.referrer) : 'direct visit';
    return 'Attribution: ' + (bits.length ? bits.join(' · ') : 'no campaign') + ' · ' + ref;
  },

  /* ── the slot model ───────────────────────────────────────────────────── */
  slot_filled: p =>
    'Slot ' + str(p.name) + ' ← ' + j1(p.value) + ' (' + (p.source || 'visitor') + ')',

  slot_corrected: p =>
    'Correction ' + str(p.name) + ': ' + j1(p.from) + ' → ' + j1(p.to) + ' (visitor wins)',

  question_asked: p =>
    'Asked ' + str(p.id) + (p.slot ? ' (' + p.slot + ')' : '') +
    (p.copy ? ' · "' + clip(p.copy, 72) + '"' : '') +
    (p.mode && p.mode !== 'ask' ? ' · ' + p.mode + ' mode' : ''),

  question_skipped: p =>
    'Skipped ' + str(p.id) + (p.slot ? ' (' + p.slot + ')' : '') +
    (p.reason ? ' — ' + clip(human(p.reason), 72) : ''),

  answer_given: p =>
    'Answered ' + str(p.id) + (p.slot ? ' (' + p.slot + ')' : '') +
    (p.chip ? ' · chip "' + clip(p.chip, 40) + '"'
            : (p.text ? ' · "' + clip(p.text, 72) + '"' : '')) +
    (p.source === 'chip' && !p.chip ? ' · from a landing chip' : ''),

  /* ── research ─────────────────────────────────────────────────────────── */
  research_started: p =>
    'Research started · ' + (p.domain || p.company || 'unknown company'),

  research_step: p =>
    'Research ' + str(p.index) + '/' + str(p.total) + ' · ' + clip(p.label, 60) +
    ' · ' + (p.live ? 'live' : 'seeded'),

  research_done: p => {
    const r = (p && p.research) || {};
    const bits = [r.name || r.domain || 'unknown'];
    if (r.employees != null) bits.push(num(r.employees) + ' people');
    if (r.industry) bits.push(clip(r.industry, 32));
    if (r.competitors && r.competitors.length) bits.push(r.competitors.length + ' peers');
    return 'Research done · ' + bits.join(' · ') +
      ' · ' + (r.live ? 'live' : 'seeded') +
      (r.confidence ? ' · confidence ' + r.confidence : '');
  },

  snapshot_viewed: p =>
    'Snapshot viewed · ' + (p.company || 'this visitor'),

  /* ── capture & consent ────────────────────────────────────────────────── */
  /* the address itself never reaches this console — snapshot-data.js sends
     the domain and nothing else, on purpose (a work email on a projector is
     a mistake you make once). Consent rides the same submit, so it lands as
     its own event a beat later rather than as a second decision. */
  capture_email: p =>
    'Email captured @' + (p.domain || 'unknown domain'),

  /* the number itself never reaches this bus — only whether one was given */
  capture_phone: p =>
    p.given ? 'Phone captured — direct line on the record'
            : 'Phone asked, not given — email only',

  capture_consent: p =>
    p.consent ? 'Consent granted with the send — follow-up permitted'
              : 'Consent withheld — report sent, no follow-up',

  capture_declined: () =>
    'Report declined — snapshot kept, logged anonymously',

  /* ── routing, handoff, conversion ─────────────────────────────────────── */
  route_decided: p => {
    const why = (p.override && p.override.why) || p.cellNote ||
      (p.primaryDomain ? p.primaryDomain + (p.tier ? ' × ' + p.tier : '') : '');
    return 'Route: ' + (p.route || 'undecided') + (why ? ' — ' + clip(why, 90) : '');
  },

  /* path.js sends { solution, url, route } and tags the url itself
     (utm_source=stagwell-ai · utm_medium=routing · utm_campaign=…), which is
     the SPEC's "handoff links carry attribution" — so the console reads the
     claim off the actual link rather than trusting a flag. Other key names
     are accepted too: this row must never be the reason a later sprint's
     handoff reads "[object Object]". */
  handoff_click: p => {
    const name = p.solution || p.name || p.label || p.target || p.id || 'link';
    const route = p.route || p.kind || null;
    const attributed = !!(p.attribution || p.attributed || p.utm_campaign || p.campaign ||
      /[?&]utm_/.test(str(p.url)));
    return 'Handoff → ' + clip(name, 44) + (route ? ' (' + route + ')' : '') +
      (attributed ? ' with attribution' : '');
  },

  human_requested: p =>
    'Human requested' + (p.text ? ' — "' + clip(p.text, 72) + '"' : ' — override 4 wins'),

  journey_converted: p =>
    'Journey converted · ' + (p.kind || 'conversion')
};

/* one line for one record — the only entry point, and it cannot throw */
function line(rec) {
  const r = rec || {};
  const type = str(r.type);
  const payload = (r.payload && typeof r.payload === 'object') ? r.payload : {};
  const fn = FORMAT[type];
  if (fn) {
    try {
      const out = fn(payload, r);
      if (out) return String(out);
    } catch (e) { /* fall through to the generic shape */ }
  }
  /* unknown, future, or a formatter that met a payload it did not expect */
  return type + ' · ' + clip(j1(r.payload === undefined ? null : r.payload), 150);
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE ROLLUP — the block the SPEC actually names, plus the live tallies that
   make it useful in a single-session demo (where the headline number can only
   ever be 0 or 1).

   A "journey" is one session_started onwards. It counts as a qualified
   opportunity the moment a route_decided in it lands on consultative, demo or
   self_serve. Segmenting this way costs nothing today and stays correct if a
   later build ever replays several journeys into one log.
   ═══════════════════════════════════════════════════════════════════════════ */
function rollup(list) {
  const evs = Array.isArray(list) ? list : events();
  const journeys = [{ qualified: false }];
  const slots = Object.create(null);
  let consent = 'not asked yet';
  let route = null;

  for (let i = 0; i < evs.length; i++) {
    const e = evs[i];
    if (!e || typeof e !== 'object') continue;
    const p = (e.payload && typeof e.payload === 'object') ? e.payload : {};

    switch (e.type) {
      case 'session_started':
        journeys.push({ qualified: false });
        break;
      case 'slot_filled':
        if (p.name && !isEmpty(p.value)) slots[p.name] = true;
        break;
      case 'capture_consent':
        consent = p.consent ? 'granted' : 'declined';
        break;
      case 'capture_declined':
        consent = 'declined';
        break;
      case 'route_decided':
        route = p.route || null;
        if (QUALIFYING_ROUTES.indexOf(String(p.route)) !== -1) {
          journeys[journeys.length - 1].qualified = true;
        }
        break;
      default: break;
    }
  }

  let opportunities = 0;
  journeys.forEach(j => { if (j.qualified) opportunities++; });

  return {
    events: evs.length,
    opportunities,
    slots: Object.keys(slots).length,
    consent,
    route
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE SOURCE — SAI.events.list() returns its live array by design (engine.js
   says so), so the console holds that reference and never keeps a second
   copy that could drift or double-count. `local` is only ever used when there
   is no engine at all: then the document listener is the whole world.
   ═══════════════════════════════════════════════════════════════════════════ */
const local = [];

function bus() {
  try { return (window.SAI && window.SAI.events) || null; } catch (e) { return null; }
}

function events() {
  const b = bus();
  if (b && typeof b.list === 'function') {
    try {
      const l = b.list();
      if (Array.isArray(l)) return l;
    } catch (e) { /* fall through */ }
  }
  return local;
}

/* how many events earlier visits left in the 200-entry ring. stored() also
   contains this session, so this session's count comes back off — claiming
   otherwise would make the footer a lie the first time anyone read it. */
function priorCount() {
  const b = bus();
  if (!b || typeof b.stored !== 'function') return 0;
  try {
    const ring = b.stored();
    if (!Array.isArray(ring)) return 0;
    return Math.max(0, ring.length - events().length);
  } catch (e) { return 0; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE DOM — built once, in JS, so b.html carries two tags and no markup for
   a panel that is not part of the product.
   ═══════════════════════════════════════════════════════════════════════════ */
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

let pill, count, drawer, log, foot, heroN, tally = {}, lastCount = -1, open = false;

function tallyCell(label, key) {
  const wrap = el('div', 'sc__tally');
  wrap.appendChild(el('dt', null, label));
  const dd = el('dd', null, '—');
  wrap.appendChild(dd);
  tally[key] = dd;
  return wrap;
}

function build() {
  /* ── the pill ── */
  pill = el('button', 'sc-pill');
  pill.type = 'button';
  pill.id = 'saiConsolePill';
  pill.setAttribute('aria-expanded', 'false');
  pill.setAttribute('aria-controls', 'saiConsole');
  pill.title = 'HubSpot event console — press ` to toggle';
  pill.appendChild(el('i', 'sc-pill__dot'));
  pill.appendChild(el('span', 'sc-pill__label', 'HubSpot console'));
  count = el('span', 'sc-pill__count', '0');
  count.setAttribute('aria-hidden', 'true');   /* the button's label carries it */
  pill.appendChild(count);
  pill.addEventListener('click', toggle);

  /* ── the drawer ── */
  drawer = el('aside', 'sc');
  drawer.id = 'saiConsole';
  drawer.setAttribute('aria-label', 'HubSpot event console');

  const head = el('header', 'sc__head');
  const top = el('div', 'sc__top');
  top.appendChild(el('h2', 'sc__title', 'Sent to HubSpot'));
  const x = el('button', 'sc__x');
  x.type = 'button';
  x.setAttribute('aria-label', 'Close console');
  x.innerHTML = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">' +
    '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>';
  x.addEventListener('click', close);
  top.appendChild(x);
  head.appendChild(top);

  head.appendChild(el('p', 'sc__honesty',
    'Demo console — events are logged locally, nothing leaves this page.'));

  const roll = el('div', 'sc__rollup');
  const hero = el('div', 'sc__hero');
  heroN = el('b', null, '0');
  hero.appendChild(heroN);
  hero.appendChild(el('span', null, 'Qualified opportunities created by Stagwell.AI'));
  roll.appendChild(hero);

  const dl = el('dl', 'sc__tallies');
  dl.appendChild(tallyCell('Events', 'events'));
  dl.appendChild(tallyCell('Slots filled', 'slots'));
  dl.appendChild(tallyCell('Consent', 'consent'));
  dl.appendChild(tallyCell('Route', 'route'));
  roll.appendChild(dl);
  head.appendChild(roll);

  const acts = el('div', 'sc__acts');
  const clearBtn = el('button', 'sc__clear', 'Clear');
  clearBtn.type = 'button';
  clearBtn.addEventListener('click', clear);
  acts.appendChild(clearBtn);
  const hint = el('span', 'sc__hint');
  hint.innerHTML = '<kbd>`</kbd> toggles';
  acts.appendChild(hint);
  head.appendChild(acts);

  drawer.appendChild(head);

  /* role="log" is permanent; aria-live is only switched on while the drawer
     is open, so a closed console never narrates the demo to a screen reader */
  log = el('ol', 'sc__log scroll');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-label', 'Event stream, newest first');
  drawer.appendChild(log);

  foot = el('footer', 'sc__foot', '');
  drawer.appendChild(foot);

  document.body.appendChild(pill);
  document.body.appendChild(drawer);
}

/* ═══════════════════════════════════════════════════════════════════════════
   RENDERING — newest first. A full rebuild of ≤200 rows is cheaper than the
   bookkeeping needed to patch the list, and it keeps "what is on screen" and
   "what is in the log" impossible to disagree.
   ═══════════════════════════════════════════════════════════════════════════ */
function renderRow(rec, now, fresh) {
  const li = el('li', 'sc__row sc__row--' + family(rec && rec.type) + (fresh ? ' is-new' : ''));
  li.appendChild(el('span', 'sc__chip', str(rec && rec.type) || 'unknown'));
  const t = el('time', 'sc__t', rel(rec && rec.t, now));
  try {
    const d = new Date(Number(rec && rec.t));
    if (!isNaN(d.getTime())) t.setAttribute('datetime', d.toISOString());
  } catch (e) { /* a record with a broken timestamp still renders */ }
  li.appendChild(t);
  li.appendChild(el('span', 'sc__line', line(rec)));
  return li;
}

function renderLog() {
  const list = events();
  const now = Date.now();
  const frag = document.createDocumentFragment();

  if (!list.length) {
    frag.appendChild(el('li', 'sc__empty',
      'Nothing sent yet. Start a conversation on the page and every event lands here as it fires.'));
  } else {
    /* newest first */
    for (let i = list.length - 1; i >= 0; i--) {
      frag.appendChild(renderRow(list[i], now, lastCount >= 0 && i >= lastCount));
    }
  }

  log.textContent = '';
  log.appendChild(frag);

  const prior = priorCount();
  foot.textContent = prior
    ? 'Previous sessions on this browser: ' + prior + ' event' + (prior === 1 ? '' : 's')
    : 'Previous sessions on this browser: none';
}

function renderStats() {
  const r = rollup();
  heroN.textContent = String(r.opportunities);
  tally.events.textContent = String(r.events);
  tally.slots.textContent = String(r.slots);
  tally.consent.textContent = r.consent;
  tally.route.textContent = r.route || 'not decided yet';
  tally.consent.className = r.consent === 'granted' ? 'is-amber' : '';
  tally.route.className = r.route ? 'is-amber' : '';
}

function renderBadge() {
  const n = events().length;
  if (String(n) === count.textContent) return;
  count.textContent = String(n);
  pill.setAttribute('aria-label',
    'HubSpot console — ' + n + ' event' + (n === 1 ? '' : 's') +
    (open ? ', open' : ', closed'));
  /* one beat of marigold; restart it cleanly if events arrive in a burst */
  count.classList.remove('is-tick');
  void count.offsetWidth;
  count.classList.add('is-tick');
}

let frame = 0;
function schedule() {
  if (frame) return;
  const run = () => { frame = 0; paint(); };
  frame = (typeof requestAnimationFrame === 'function')
    ? requestAnimationFrame(run) : setTimeout(run, 16);
}

function paint() {
  renderBadge();
  if (!open) return;              /* closed: the badge is the whole cost */
  renderStats();
  renderLog();
  lastCount = events().length;
}

/* relative timestamps go stale; refresh them only while anyone can see them */
let ticker = 0;
function startTicker() {
  if (ticker) return;
  ticker = setInterval(() => { if (open) { renderLog(); } }, 10000);
}
function stopTicker() {
  if (ticker) { clearInterval(ticker); ticker = 0; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   OPEN / CLOSE — deliberately not a modal. The presenter clicks the page
   *while* this is up, so there is no scrim, no focus trap and no lock on the
   body: the drawer's own scroller contains its overscroll and that is all.
   Escape closes it, which is the one key it takes off the page.
   ═══════════════════════════════════════════════════════════════════════════ */
function setOpen(next) {
  if (open === next) return open;
  open = next;
  drawer.classList.toggle('is-open', open);
  pill.setAttribute('aria-expanded', open ? 'true' : 'false');
  document.body.classList.toggle('sc-open', open);

  if (open) {
    log.setAttribute('aria-live', 'polite');
    lastCount = -1;                 /* a fresh open animates nothing */
    renderStats();
    renderLog();
    lastCount = events().length;
    renderBadge();
    startTicker();
  } else {
    log.removeAttribute('aria-live');
    stopTicker();
    renderBadge();
  }
  return open;
}

function openConsole() { setOpen(true); return open; }

function close(e) {
  if (e && e.preventDefault) e.preventDefault();
  const wasOpen = open;
  setOpen(false);
  /* give the keyboard somewhere sensible to land, but only if it was in here */
  if (wasOpen && drawer.contains(document.activeElement)) {
    try { pill.focus(); } catch (err) { /* nothing to focus, fine */ }
  }
  return open;
}

function toggle() { return open ? close() : openConsole(); }

function clear() {
  const b = bus();
  if (b && typeof b.clear === 'function') {
    try { b.clear(); } catch (e) { /* an engine that won't clear keeps its log */ }
  }
  local.length = 0;
  lastCount = -1;
  paint();
  lastCount = events().length;
  return events().length;
}

/* ═══════════════════════════════════════════════════════════════════════════
   WIRING
   ═══════════════════════════════════════════════════════════════════════════ */
function typing(node) {
  if (!node) return false;
  if (node.isContentEditable) return true;
  const tag = String(node.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

function onKey(e) {
  if (e.key === 'Escape' && open) { close(); return; }
  if (e.key !== '`') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;   /* leave chords alone */
  if (typing(e.target)) return;                     /* a backtick in the prompt is a backtick */
  e.preventDefault();
  toggle();
}

function start() {
  build();
  paint();

  /* live, regardless of drawer state — the badge ticks while closed */
  document.addEventListener('sai:event', ev => {
    const rec = ev && ev.detail;
    if (!rec || typeof rec !== 'object') return;
    /* only own the record when there is no engine holding it for us */
    if (events() === local) local.push(rec);
    schedule();
  });

  document.addEventListener('keydown', onKey);

  /* the engine emits session_started and attribution_captured inside its
     ready promise. Await it when it exists so the first paint has them;
     degrade to listener-only when it does not. */
  const S = window.SAI;
  if (S && S.ready && typeof S.ready.then === 'function') {
    S.ready.then(() => paint(), () => paint());
  }
}

if (document.body) start();
else document.addEventListener('DOMContentLoaded', start, { once: true });

window.SAICONSOLE = {
  open: openConsole,
  close,
  toggle,
  isOpen: () => open,
  line,
  family,
  rollup,
  events,
  priorCount,
  clear,
  _formatters: FORMAT
};

})();
